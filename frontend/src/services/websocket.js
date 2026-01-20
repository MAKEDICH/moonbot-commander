/**
 * WebSocket Service для real-time обновлений
 * 
 * Подключается к backend WebSocket endpoint и обрабатывает push-уведомления
 */

import { getApiBaseUrl } from '../utils/apiUrl';

// Условный логгер - логирует только в dev режиме
const isDev = import.meta.env.DEV;
const log = (...args) => isDev && console.log(...args);
const logError = (...args) => console.error(...args);  // Ошибки всегда показываем

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
      log('[WS] Already connected');
      return;
    }

    if (this.isConnecting) {
      log('[WS] Connection already in progress');
      return;
    }

    this.isConnecting = true;

    const token = localStorage.getItem('token');
    if (!token) {
      logError('[WS] No token found, cannot connect');
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

      log('[WS] Connecting to:', wsUrl.replace(token, 'TOKEN'));

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        log('[WS] ✅ Connected');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.startPingInterval();
        this.notifyListeners('connected', { connected: true });
      };

      this.ws.onmessage = async (event) => {
        try {
          // Игнорируем ping/pong текстовые сообщения
          if (event.data === 'pong' || event.data === 'ping') {
            return;
          }
          
          let data;
          
          // Проверяем, является ли сообщение бинарным (сжатым gzip)
          if (event.data instanceof Blob) {
            const arrayBuffer = await event.data.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            
            // Первый байт = 0x01 означает gzip сжатие
            if (bytes[0] === 0x01) {
              // Декомпрессия gzip
              const compressedData = bytes.slice(1);
              const decompressed = await this.decompressGzip(compressedData);
              data = JSON.parse(decompressed);
            } else {
              // Обычные бинарные данные
              const decoder = new TextDecoder();
              data = JSON.parse(decoder.decode(bytes));
            }
          } else {
            // Текстовое сообщение
            data = JSON.parse(event.data);
          }
          
          log('[WS] 📥 Message received:', data.type);
          this.handleMessage(data);
        } catch (error) {
          logError('[WS] Error parsing message:', error);
        }
      };

      this.ws.onerror = (error) => {
        logError('[WS] ❌ Error:', error);
        this.isConnecting = false;
      };

      this.ws.onclose = (event) => {
        log('[WS] Disconnected:', event.code, event.reason);
        this.isConnecting = false;
        this.stopPingInterval();
        this.notifyListeners('disconnected', { connected: false });

        if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          log(`[WS] Reconnecting in ${this.reconnectDelay}ms... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
          setTimeout(() => this.connect(), this.reconnectDelay);
        } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          logError('[WS] Max reconnect attempts reached');
          this.notifyListeners('error', { error: 'Max reconnect attempts reached' });
        }
      };

    } catch (error) {
      logError('[WS] Connection error:', error);
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
    
    log('[WS] Disconnected by user');
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
        log('[WS] Connection established');
        break;

      case 'pong':
        // Ответ на ping - игнорируем
        break;

      case 'batch':
        // Обработка пакета сообщений от сервера (high-load mode)
        if (data.messages && Array.isArray(data.messages)) {
          data.messages.forEach(msg => this.handleMessage(msg));
        }
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

      case 'chart_update':
        this.notifyListeners('chart_update', data);
        break;

      case 'api_error':
        this.notifyListeners('api_error', data);
        break;

      case 'balance_update':
        this.notifyListeners('balance_update', data);
        break;

      default:
        log('[WS] Unknown message type:', type);
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
   * Декомпрессия gzip данных
   */
  async decompressGzip(compressedData) {
    // Используем DecompressionStream API (доступен в современных браузерах)
    if (typeof DecompressionStream !== 'undefined') {
      const ds = new DecompressionStream('gzip');
      const blob = new Blob([compressedData]);
      const decompressedStream = blob.stream().pipeThrough(ds);
      const decompressedBlob = await new Response(decompressedStream).blob();
      return await decompressedBlob.text();
    }
    
    // Fallback: используем pako если DecompressionStream недоступен
    // Но для простоты просто логируем ошибку
    logError('[WS] DecompressionStream not available, cannot decompress gzip');
    throw new Error('Gzip decompression not supported');
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
          logError(`[WS] Error in listener for ${event}:`, error);
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





