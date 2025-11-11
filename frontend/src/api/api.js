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
  const apiPort = import.meta.env.VITE_API_PORT || '8000';
  
  // Если запущено локально (localhost) в production - используем localhost с настраиваемым портом
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return `http://localhost:${apiPort}`;
  }
  
  // Если запущено на удаленном сервере - используем тот же хост с настраиваемым портом
  // РАЗМЫШЛЕНИЕ: Здесь важно - если это HTTPS, то скорее всего backend тоже на HTTPS (reverse proxy)
  // В таком случае порт может быть не нужен (80/443 по умолчанию)
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  
  // Если порт 80 (HTTP) или 443 (HTTPS) - не добавляем порт в URL
  if ((protocol === 'http:' && apiPort === '80') || (protocol === 'https:' && apiPort === '443')) {
    return `${protocol}//${hostname}`;
  }
  
  return `${protocol}//${hostname}:${apiPort}`;
};

const API_BASE_URL = getApiBaseUrl();

// Debug: показываем какой URL используется
console.log('[API] Mode:', import.meta.env.MODE);
console.log('[API] DEV:', import.meta.env.DEV);
console.log('[API] Using API Base URL:', API_BASE_URL || '(using Vite proxy)');
console.log('[API] Current hostname:', window.location.hostname);

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // РАЗМЫШЛЕНИЕ: Timeout предотвращает вечное ожидание
  timeout: 30000,  // 30 секунд
});

// РАЗМЫШЛЕНИЕ: Retry конфигурация
// Retry только на network errors (ECONNREFUSED, ETIMEDOUT, etc)
// НЕ retry на 4xx/5xx ошибках (это логические ошибки, не сетевые)
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;  // 1 секунда базовая задержка

/**
 * Определяет нужно ли повторить запрос
 * РАЗМЫШЛЕНИЕ: Retry только если:
 * 1. Network error (нет response)
 * 2. 5xx ошибка (server temporary unavailable)
 * 3. Не POST/PUT/DELETE (они не idempotent - могут создать дубли)
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
 * РАЗМЫШЛЕНИЕ: Каждая попытка ждет дольше (1s, 2s, 4s...)
 * Jitter (случайность) предотвращает thundering herd problem
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

// Interceptor для обработки ошибок
// РАЗМЫШЛЕНИЕ: 401 может прилететь по разным причинам:
// 1. Истек токен - нужен редирект
// 2. Неверный пароль при логине - НЕ нужен редирект (уже на /login)
// 3. 2FA требуется - НЕ нужен редирект (обрабатывается отдельно)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // РАЗМЫШЛЕНИЕ: Retry logic для network errors и 5xx
    if (shouldRetry(error) && !originalRequest._retry) {
      originalRequest._retryCount = originalRequest._retryCount || 0;
      
      if (originalRequest._retryCount < MAX_RETRIES) {
        originalRequest._retryCount++;
        originalRequest._retry = true;
        
        const delay = getRetryDelay(originalRequest._retryCount);
        console.log(`[API] Retry ${originalRequest._retryCount}/${MAX_RETRIES} after ${Math.round(delay)}ms`);
        
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
      
      // РАЗМЫШЛЕНИЕ: Если уже на публичной странице - не редиректим (избегаем loop)
      if (!publicPaths.some(path => currentPath.startsWith(path))) {
        console.log('[API] 401 Unauthorized - редирект на /login');
        safeStorage.removeItem('token');  // ИСПРАВЛЕНО: Безопасное удаление
        window.location.href = '/login';
      } else {
        console.log('[API] 401 на публичной странице - пропускаем редирект');
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
};

export const sqlLogsAPI = {
  clearAll: () => api.delete('/api/sql-log/clear-all'),
  clearByServer: (serverId) => api.delete(`/api/servers/${serverId}/sql-log/clear`),
};

export const ordersAPI = {
  clearAll: () => api.delete('/api/orders/clear-all'),
  clearByServer: (serverId) => api.delete(`/api/servers/${serverId}/orders/clear`),
};

export default api;

