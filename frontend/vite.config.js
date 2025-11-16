import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// РАЗМЫШЛЕНИЕ: Конфигурация должна использовать переменные окружения,
// чтобы быть гибкой для разных окружений (dev/staging/prod)
export default defineConfig(({ mode }) => {
  // Загружаем переменные окружения
  const env = loadEnv(mode, process.cwd(), '');
  
  // Определяем backend URL из переменных окружения или дефолт
  const apiPort = env.VITE_API_PORT || '8000';
  const apiUrl = env.VITE_API_URL || `http://127.0.0.1:${apiPort}`;  // FIXED: Use 127.0.0.1 instead of localhost to force IPv4
  
  return {
    plugins: [react()],
    server: {
      port: 3000,
      open: false,
      proxy: {
        '/api': {
          // ИСПРАВЛЕНО: Используем переменные окружения вместо хардкода
          target: apiUrl,
          changeOrigin: true,
          // РАЗМЫШЛЕНИЕ: secure: false нужен для самоподписанных сертификатов в dev
          secure: false,
          // Логирование proxy запросов для отладки
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              console.log('[Vite Proxy]', req.method, req.url, '→', options.target);
            });
          }
        },
        '/ws': {
          // WebSocket proxy для real-time обновлений
          target: apiUrl.replace('http', 'ws'),
          ws: true,
          changeOrigin: true,
          secure: false,
          configure: (proxy, options) => {
            proxy.on('error', (err, req, res) => {
              console.error('[Vite WS Proxy] Error:', err);
            });
            proxy.on('proxyReqWs', (proxyReq, req, socket, options, head) => {
              console.log('[Vite WS Proxy] WebSocket connection:', req.url);
            });
          }
        }
      }
    },
    build: {
      // РАЗМЫШЛЕНИЕ: В production нужна минификация!
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

