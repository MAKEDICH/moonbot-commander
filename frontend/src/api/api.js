import axios from 'axios';

// Автоматически определяем API URL на основе текущего хоста
const getApiBaseUrl = () => {
  // Если задана переменная окружения - используем её
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // В development режиме Vite использует proxy, поэтому возвращаем пустую строку
  // Это позволит использовать относительные пути которые будут проксированы
  if (import.meta.env.DEV) {
    return ''; // Используем Vite proxy для /api
  }
  
  // Если запущено локально (localhost) в production - используем localhost:8000
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:8000';
  }
  
  // Если запущено на удаленном сервере - используем тот же хост с портом 8000
  return `${window.location.protocol}//${window.location.hostname}:8000`;
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
});

// Interceptor для добавления токена
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
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
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
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

export default api;

