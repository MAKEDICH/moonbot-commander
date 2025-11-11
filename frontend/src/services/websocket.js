/**
 * WebSocket Service для real-time обновлений
 * 
 * Подключается к backend WebSocket endpoint и обрабатывает push-уведомления
 */

import { getApiBaseUrl } from '../utils/apiUrl';

class WebSocketService {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 3000; // 3 секунды
    this.listeners = new Map(); // Подписчики на события
    this.isConnecting = false;
    this.shouldReconnect = true;
    this.pingInterval = null;
  }

  /**
   * Подключиться к WebSocket серверу
   */
  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('[WS] Already connected');
      return;
    }

    if (this.isConnecting) {
      console.log('[WS] Connection already in progress');
      return;
    }

    this.isConnecting = true;

    const token = localStorage.getItem('token');
    if (!token) {
      console.error('[WS] No token found, cannot connect');
      this.isConnecting = false;
      return;
    }

    try {
      // Определяем WebSocket URL
      const apiUrl = getApiBaseUrl();
      let wsUrl;
      
      if (apiUrl === '' || !apiUrl) {
        // Vite proxy - используем относительный путь
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl = `${protocol}//${window.location.host}/ws?token=${token}`;
      } else {
        // Прямое подключение
        const wsProtocol = apiUrl.startsWith('https') ? 'wss:' : 'ws:';
        const wsHost = apiUrl.replace('http://', '').replace('https://', '');
        wsUrl = `${wsProtocol}//${wsHost}/ws?token=${token}`;
      }

      console.log('[WS] Connecting to:', wsUrl.replace(token, 'TOKEN'));

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[WS] ✅ Connected');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.startPingInterval();
        this.notifyListeners('connected', { connected: true });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[WS] 📥 Message received:', data.type, data);
          this.handleMessage(data);
        } catch (error) {
          console.error('[WS] Error parsing message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[WS] ❌ Error:', error);
        this.isConnecting = false;
      };

      this.ws.onclose = (event) => {
        console.log('[WS] Disconnected:', event.code, event.reason);
        this.isConnecting = false;
        this.stopPingInterval();
        this.notifyListeners('disconnected', { connected: false });

        if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          console.log(`[WS] Reconnecting in ${this.reconnectDelay}ms... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
          setTimeout(() => this.connect(), this.reconnectDelay);
        } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.error('[WS] Max reconnect attempts reached');
          this.notifyListeners('error', { error: 'Max reconnect attempts reached' });
        }
      };

    } catch (error) {
      console.error('[WS] Connection error:', error);
      this.isConnecting = false;
    }
  }

  /**
   * Отключиться от WebSocket
   */
  disconnect() {
    this.shouldReconnect = false;
    this.stopPingInterval();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    console.log('[WS] Disconnected by user');
  }

  /**
   * Запустить периодический ping для поддержания соединения
   */
  startPingInterval() {
    this.stopPingInterval();
    
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send('ping');
      }
    }, 30000); // Каждые 30 секунд
  }

  /**
   * Остановить ping interval
   */
  stopPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Обработка входящих сообщений
   */
  handleMessage(data) {
    const { type } = data;

    switch (type) {
      case 'connected':
        console.log('[WS] Connection established:', data);
        break;

      case 'pong':
        // Ответ на ping - игнорируем
        break;

      case 'sql_log':
        this.notifyListeners('sql_log', data);
        break;

      case 'order_update':
        this.notifyListeners('order_update', data);
        break;

      case 'server_status':
        this.notifyListeners('server_status', data);
        break;

      default:
        console.warn('[WS] Unknown message type:', type);
    }
  }

  /**
   * Подписаться на события
   * 
   * @param {string} event - Тип события ('sql_log', 'order_update', 'connected', etc.)
   * @param {function} callback - Функция обработчик
   * @returns {function} Функция для отписки
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    
    this.listeners.get(event).push(callback);

    // Возвращаем функцию для отписки
    return () => {
      const listeners = this.listeners.get(event);
      if (listeners) {
        const index = listeners.indexOf(callback);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    };
  }

  /**
   * Отписаться от события
   */
  off(event, callback) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Уведомить всех подписчиков о событии
   */
  notifyListeners(event, data) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[WS] Error in listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Проверить статус подключения
   */
  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}

// Создаем глобальный экземпляр
const wsService = new WebSocketService();

export default wsService;



