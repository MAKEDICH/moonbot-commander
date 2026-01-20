import { defineConfig, loadEnv, createLogger } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

// Конфигурация использует переменные окружения для гибкости (dev/staging/prod)
export default defineConfig(({ mode }) => {
  // Загружаем переменные окружения
  const env = loadEnv(mode, process.cwd(), '');
  
  // Определяем backend URL из переменных окружения или дефолт
  const apiPort = env.VITE_API_PORT || '8000';
  const apiUrl = env.VITE_API_URL || `http://127.0.0.1:${apiPort}`;  // FIXED: Use 127.0.0.1 instead of localhost to force IPv4

  // Кастомный logger который подавляет ECONNREFUSED ошибки при старте
  const customLogger = createLogger();
  const originalError = customLogger.error.bind(customLogger);
  customLogger.error = (msg, options) => {
    // Подавляем ошибки прокси при подключении к backend
    if (msg.includes('http proxy error') && msg.includes('ECONNREFUSED')) {
      return; // Тихо игнорируем
    }
    if (msg.includes('ws proxy error') && msg.includes('ECONNREFUSED')) {
      return; // Тихо игнорируем WebSocket ошибки
    }
    originalError(msg, options);
  };
  
  // Плагины - visualizer только для dev и если явно включён
  const plugins = [react()];
  
  // Visualizer потребляет много памяти - включаем только при необходимости
  if (env.VITE_BUNDLE_ANALYZE === 'true') {
    plugins.push(visualizer({
      open: false,
      filename: 'bundle-stats.html',
      gzipSize: true,
      brotliSize: true,
      template: 'treemap',
    }));
  }
  
  return {
    plugins,
    customLogger,  // Используем кастомный logger для подавления ECONNREFUSED
    server: {
      host: '0.0.0.0',  // Слушаем на всех интерфейсах для доступа по IP
      port: 3000,
      open: false,
      proxy: {
        '/api': {
          target: apiUrl,
          changeOrigin: true,
          secure: false,
          configure: (proxy, options) => {
            // Подавляем ECONNREFUSED при старте
            proxy.on('error', (err, req, res) => {
              if (err.code !== 'ECONNREFUSED') {
                console.error('[Vite Proxy] Error:', err.message);
              }
              if (res && !res.headersSent) {
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ detail: 'Backend starting, please retry' }));
              }
            });
          }
        },
        '/ws': {
          target: apiUrl.replace('http', 'ws'),
          ws: true,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            proxy.on('error', () => {}); // Тихо игнорируем WS ошибки при старте
          }
        }
      }
    },
    // Настройки для preview (production serve)
    preview: {
      host: '0.0.0.0',
      port: 3000,
      strictPort: false,  // Если порт занят - использовать другой
      allowedHosts: true,  // Разрешить все хосты (важно для серверов)
      proxy: {
        '/api': {
          target: apiUrl,
          changeOrigin: true,
          secure: false,
          // Подавляем ошибки подключения при старте (backend может быть не готов)
          configure: (proxy) => {
            proxy.on('error', (err, req, res) => {
              // Не логируем ECONNREFUSED - это нормально при старте
              if (err.code !== 'ECONNREFUSED') {
                console.error('[Vite Preview Proxy] Error:', err.message);
              }
              // Отправляем 503 вместо краша
              if (res && !res.headersSent) {
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ detail: 'Backend starting, please retry' }));
              }
            });
          }
        },
        '/ws': {
          target: apiUrl.replace('http', 'ws'),
          ws: true,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            proxy.on('error', () => {}); // Тихо игнорируем WS ошибки при старте
          }
        }
      }
    },
    build: {
      minify: mode === 'production' ? 'terser' : false,
      sourcemap: mode !== 'production',  // Sourcemap только в dev
      // Удаляем console.log в production
      terserOptions: mode === 'production' ? {
        compress: {
          drop_console: true,
          drop_debugger: true
        }
      } : {},
      // Оптимизации для production
      rollupOptions: {
        output: {
          manualChunks: {
            // Разделяем vendor код для лучшего кеширования
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'ui-vendor': ['@emotion/react', '@emotion/styled', 'framer-motion'],
          }
        }
      }
    }
  };
});

