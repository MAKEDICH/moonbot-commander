import axios from 'axios';
import safeStorage from '../utils/safeStorage';

// Автоматически определяем API URL на основе текущего хоста
const getApiBaseUrl = () => {
  // Если задана переменная окружения VITE_API_URL - используем её (высший приоритет)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // В development режиме Vite использует proxy, поэтому возвращаем пустую строку
  // Это позволит использовать относительные пути которые будут проксированы
  if (import.meta.env.DEV) {
    return ''; // Используем Vite proxy для /api
  }
  
  // Получаем порт из переменной окружения или дефолт
  const apiPort = import.meta.env.VITE_API_PORT || '3000';
  
  // Если запущено локально (localhost) в production - используем localhost с настраиваемым портом
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return `http://localhost:${apiPort}`;
  }
  
  // Если запущено на удаленном сервере - используем тот же хост с настраиваемым портом
  // При HTTPS backend тоже на HTTPS (reverse proxy), порт 80/443 по умолчанию
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  
  // Если порт 80 (HTTP) или 443 (HTTPS) - не добавляем порт в URL
  if ((protocol === 'http:' && apiPort === '80') || (protocol === 'https:' && apiPort === '443')) {
    return `${protocol}//${hostname}`;
  }
  
  return `${protocol}//${hostname}:${apiPort}`;
};

const API_BASE_URL = getApiBaseUrl();

// Debug: показываем какой URL используется (только в dev режиме)
if (import.meta.env.DEV) {
  console.log('[API] Mode:', import.meta.env.MODE);
  console.log('[API] DEV:', import.meta.env.DEV);
  console.log('[API] Using API Base URL:', API_BASE_URL || '(using Vite proxy)');
  console.log('[API] Current hostname:', window.location.hostname);
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,  // 30 секунд - предотвращает вечное ожидание
});

// Retry конфигурация: только на network errors (ECONNREFUSED, ETIMEDOUT)
// НЕ retry на 4xx/5xx (логические ошибки)
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;  // 1 секунда базовая задержка

/**
 * Определяет нужно ли повторить запрос
 * Retry только для network errors и 5xx (временные проблемы сервера)
 */
const shouldRetry = (error) => {
  // Нет response = network error
  if (!error.response) {
    return true;
  }
  
  // 5xx errors можно retry (server перезагружается)
  if (error.response.status >= 500 && error.response.status <= 599) {
    return true;
  }
  
  return false;
};

/**
 * Exponential backoff с jitter
 * Каждая попытка ждет дольше (1s, 2s, 4s...), jitter предотвращает thundering herd
 */
const getRetryDelay = (retryCount) => {
  const exponentialDelay = RETRY_DELAY * Math.pow(2, retryCount);
  const jitter = Math.random() * 500;  // До 500ms случайности
  return exponentialDelay + jitter;
};

// Interceptor для добавления токена
api.interceptors.request.use(
  (config) => {
    const token = safeStorage.getItem('token');  // ИСПРАВЛЕНО: Безопасное чтение
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor для обработки ошибок (401 - редирект на /login если не на публичной странице)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Retry logic для network errors и 5xx
    if (shouldRetry(error) && !originalRequest._retry) {
      originalRequest._retryCount = originalRequest._retryCount || 0;
      
      if (originalRequest._retryCount < MAX_RETRIES) {
        originalRequest._retryCount++;
        originalRequest._retry = true;
        
        const delay = getRetryDelay(originalRequest._retryCount);
        if (import.meta.env.DEV) {
          console.log(`[API] Retry ${originalRequest._retryCount}/${MAX_RETRIES} after ${Math.round(delay)}ms`);
        }
        
        // Ждем перед retry
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return api(originalRequest);
      }
    }
    
    // 401 handling (после retry попыток)
    if (error.response?.status === 401) {
      // Проверяем что мы НЕ на страницах авторизации
      const publicPaths = ['/login', '/register', '/2fa-verify', '/2fa-recover', '/recover-password'];
      const currentPath = window.location.pathname;
      
      // Если уже на публичной странице - не редиректим (избегаем loop)
      if (!publicPaths.some(path => currentPath.startsWith(path))) {
        safeStorage.removeItem('token');
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (data) => api.post('/api/auth/register', data),
  login: (username, password) => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);
    return api.post('/api/auth/login', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  me: () => api.get('/api/auth/me'),
  changePassword: (data) => api.put('/api/auth/change-password', data),
  recoverPassword: (data) => api.post('/api/auth/recover-password', data),
  
  // 2FA endpoints
  setup2FA: () => api.get('/api/auth/2fa/setup'),
  enable2FA: (data) => api.post('/api/auth/2fa/enable', data),
  disable2FA: (data) => api.post('/api/auth/2fa/disable', data),
  verify2FA: (data, username) => api.post(`/api/auth/2fa/verify?username=${username}`, data),
  recover2FAPassword: (data) => api.post('/api/auth/2fa/recover-password', data),
};

export const serversAPI = {
  getAll: () => api.get('/api/servers'),
  getOne: (id) => api.get(`/api/servers/${id}`),
  create: (data) => api.post('/api/servers', data),
  update: (id, data) => api.put(`/api/servers/${id}`, data),
  delete: (id) => api.delete(`/api/servers/${id}`),
  test: (id) => api.post(`/api/servers/${id}/test`),
  listenerStatus: (id) => api.get(`/api/servers/${id}/listener/status`),
  listenerStart: (id) => api.post(`/api/servers/${id}/listener/start`),
  listenerStop: (id) => api.post(`/api/servers/${id}/listener/stop`),
};

export const commandsAPI = {
  send: (data) => api.post('/api/commands/send', data),
  sendBulk: (data) => api.post('/api/commands/send-bulk', data),
  getHistory: (serverId = null, limit = 50) => 
    api.get('/api/commands/history', { params: { server_id: serverId, limit } }),
  clearHistory: (serverId = null) => 
    api.delete('/api/commands/history', { params: { server_id: serverId } }),
};

export const groupsAPI = {
  getAll: () => api.get('/api/groups'),
  getOne: (id) => api.get(`/api/groups/${id}`),
};

export const statsAPI = {
  get: () => api.get('/api/stats'),
};

export const scheduledCommandsAPI = {
  create: (data) => api.post('/api/scheduled-commands', data),
  getAll: (statusFilter) => api.get('/api/scheduled-commands', { params: { status_filter: statusFilter } }),
  getOne: (id) => api.get(`/api/scheduled-commands/${id}`),
  update: (id, data) => api.put(`/api/scheduled-commands/${id}`, data),
  delete: (id) => api.delete(`/api/scheduled-commands/${id}`),
  cancel: (id) => api.post(`/api/scheduled-commands/${id}/cancel`),
  getSettings: () => api.get('/api/scheduler/settings'),
  updateSettings: (data) => api.put('/api/scheduler/settings', data),
};

export const quickCommandsAPI = {
  getAll: () => api.get('/api/quick-commands'),
  create: (data) => api.post('/api/quick-commands', data),
  update: (id, data) => api.put(`/api/quick-commands/${id}`, data),
  delete: (id) => api.delete(`/api/quick-commands/${id}`),
  removeDuplicates: () => api.post('/api/quick-commands/remove-duplicates'),
};

export const presetsAPI = {
  getAll: () => api.get('/api/presets'),
  create: (data) => api.post('/api/presets', data),
  update: (id, data) => api.put(`/api/presets/${id}`, data),
  delete: (id) => api.delete(`/api/presets/${id}`),
  execute: (presetId, serverId) => api.post(`/api/presets/${presetId}/execute`, null, { params: { server_id: serverId } }),
};

export const botCommandsAPI = {
  getAll: () => api.get('/api/bot-commands'),
};

export const userSettingsAPI = {
  get: () => api.get('/api/user/settings'),
  update: (data) => api.put('/api/user/settings', data),
};

export const serverStatusAPI = {
  getAllWithStatus: () => api.get('/api/servers-with-status'),
  ping: (serverId) => api.post(`/api/servers/${serverId}/ping`),
};

export const dashboardAPI = {
  getStats: () => api.get('/api/dashboard/stats'),
  getCommandsDaily: (days = 7) => api.get('/api/dashboard/commands-daily', { params: { days } }),
  getServerUptime: () => api.get('/api/dashboard/server-uptime'),
  getMonthlyProfit: (year, month) => api.get('/api/dashboard/monthly-profit', { params: { year, month } }),
};

export const sqlLogsAPI = {
  clearAll: () => api.delete('/api/sql-log/clear-all'),
  clearByServer: (serverId) => api.delete(`/api/servers/${serverId}/sql-log/clear`),
};

export const ordersAPI = {
  clearAll: () => api.delete('/api/orders/clear-all'),
  clearByServer: (serverId) => api.delete(`/api/servers/${serverId}/orders/clear`),
};

export const apiErrorsAPI = {
  getAll: (params) => api.get('/api/errors', { params }),
  getStats: (hours = 24) => api.get('/api/errors/stats', { params: { hours } }),
  clear: (serverId = null) => api.delete('/api/errors/clear', { params: serverId ? { server_id: serverId } : {} }),
  markViewed: () => api.post('/api/errors/mark-viewed'),
};

export const chartsAPI = {
  subscribe: (serverId) => api.post(`/api/servers/${serverId}/charts/subscribe`),
  unsubscribe: (serverId) => api.post(`/api/servers/${serverId}/charts/unsubscribe`),
  getAll: (serverId, limit = 50) => api.get(`/api/servers/${serverId}/charts`, { params: { limit } }),
  getAllCharts: (limit = 100) => api.get('/api/charts/all', { params: { limit } }),
  getChart: (serverId, orderId) => api.get(`/api/servers/${serverId}/charts/${orderId}`),
  clear: (serverId) => api.delete(`/api/servers/${serverId}/charts/clear`),
  clearAll: () => api.delete('/api/charts/clear-all'),
};

export const tradingStatsAPI = {
  get: (params = {}) => api.get('/api/trading-stats', { params }),
  getDetails: (serverId, params = {}) => api.get(`/api/servers/${serverId}/trading-stats`, { params }),
  getProfitChart: (params = {}) => api.get('/api/profit-chart-all', { params }),
};

export const ordersListAPI = {
  getAll: (params = {}) => api.get('/api/orders', { params }),
  getByServer: (serverId, params = {}) => api.get(`/api/servers/${serverId}/orders`, { params }),
  sync: (serverId, params = {}) => api.post(`/api/servers/${serverId}/sync-orders`, params),
};

export default api;

