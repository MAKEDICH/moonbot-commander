/**
 * Глобальный контекст для автопроверки серверов
 * 
 * Работает независимо от текущей страницы - автопроверка продолжается
 * при переключении между вкладками приложения.
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { serverStatusAPI, userSettingsAPI } from '../api/api';

const AutoPingContext = createContext(null);

export const useAutoPing = () => {
  const context = useContext(AutoPingContext);
  if (!context) {
    throw new Error('useAutoPing must be used within AutoPingProvider');
  }
  return context;
};

export const AutoPingProvider = ({ children }) => {
  const [autoPingEnabled, setAutoPingEnabled] = useState(() => {
    const saved = localStorage.getItem('dashboardAutoPingEnabled');
    return saved === 'true';
  });
  const [pingInterval, setPingInterval] = useState(30);
  const [isPinging, setIsPinging] = useState(false);
  const [lastPingTime, setLastPingTime] = useState(null);
  const [serversCount, setServersCount] = useState(0);
  
  const intervalRef = useRef(null);
  const isInitialized = useRef(false);

  // Загрузка настроек при инициализации
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await userSettingsAPI.get();
        if (response.data?.ping_interval) {
          setPingInterval(response.data.ping_interval);
        }
      } catch (error) {
        console.error('[AutoPing] Failed to load settings:', error);
      }
      isInitialized.current = true;
    };
    
    loadSettings();
  }, []);

  // Функция пинга всех серверов
  const pingAllServers = useCallback(async () => {
    if (isPinging) return;
    
    setIsPinging(true);
    try {
      const serversRes = await serverStatusAPI.getAllWithStatus();
      const servers = serversRes.data || [];
      setServersCount(servers.length);
      
      if (servers.length === 0) {
        setIsPinging(false);
        return;
      }

      // Пингуем серверы последовательно с небольшой задержкой
      for (const server of servers) {
        try {
          await serverStatusAPI.ping(server.id);
        } catch (error) {
          console.error(`[AutoPing] Error pinging server ${server.id}:`, error);
        }
        // Небольшая задержка между пингами чтобы не перегружать
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      setLastPingTime(new Date());
    } catch (error) {
      console.error('[AutoPing] Error during auto-ping:', error);
    } finally {
      setIsPinging(false);
    }
  }, [isPinging]);

  // Основной эффект автопроверки
  useEffect(() => {
    if (!isInitialized.current) return;
    
    // Очищаем предыдущий интервал
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!autoPingEnabled) {
      console.log('[AutoPing] Disabled');
      return;
    }

    console.log(`[AutoPing] Starting with interval ${pingInterval}s`);
    
    // Первый пинг сразу
    pingAllServers();

    // Устанавливаем интервал
    intervalRef.current = setInterval(() => {
      pingAllServers();
    }, pingInterval * 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [autoPingEnabled, pingInterval, pingAllServers]);

  // Обработка видимости вкладки браузера
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && autoPingEnabled && !intervalRef.current) {
        console.log('[AutoPing] Browser tab active, restarting');
        pingAllServers();
        intervalRef.current = setInterval(() => {
          pingAllServers();
        }, pingInterval * 1000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [autoPingEnabled, pingInterval, pingAllServers]);

  // Переключение автопроверки
  const toggleAutoPing = useCallback(() => {
    setAutoPingEnabled(prev => {
      const newValue = !prev;
      localStorage.setItem('dashboardAutoPingEnabled', newValue.toString());
      console.log(`[AutoPing] ${newValue ? 'Enabled' : 'Disabled'}`);
      return newValue;
    });
  }, []);

  // Обновление интервала
  const updatePingInterval = useCallback((newInterval) => {
    setPingInterval(newInterval);
    // Перезапуск с новым интервалом произойдёт автоматически через useEffect
  }, []);

  // Принудительный пинг
  const forcePing = useCallback(() => {
    if (!isPinging) {
      pingAllServers();
    }
  }, [isPinging, pingAllServers]);

  const value = {
    autoPingEnabled,
    toggleAutoPing,
    isPinging,
    lastPingTime,
    serversCount,
    pingInterval,
    updatePingInterval,
    forcePing
  };

  return (
    <AutoPingContext.Provider value={value}>
      {children}
    </AutoPingContext.Provider>
  );
};

export default AutoPingContext;



