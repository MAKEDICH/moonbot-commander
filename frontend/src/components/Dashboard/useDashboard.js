import { useState, useEffect, useRef } from 'react';
import { dashboardAPI, serverStatusAPI, userSettingsAPI, tradingStatsAPI, ordersListAPI } from '../../api/api';
import { showSystemNotification, playNotificationSound } from './dashboardUtils';

/**
 * Хук для управления дашбордом
 */
const useDashboard = () => {
  const [stats, setStats] = useState(null);
  const [serversWithStatus, setServersWithStatus] = useState([]);
  const [commandsDaily, setCommandsDaily] = useState([]);
  const [serverUptime, setServerUptime] = useState([]);
  const [tradingStats, setTradingStats] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [profitData, setProfitData] = useState(null);
  const [profitPeriod, setProfitPeriod] = useState('day');
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tradingLoading, setTradingLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [pingInterval, setPingInterval] = useState(30);
  const [autoPingEnabled, setAutoPingEnabled] = useState(() => {
    const saved = localStorage.getItem('dashboardAutoPingEnabled');
    return saved === 'true';
  });
  const [testingServers, setTestingServers] = useState(new Set());
  const intervalRef = useRef(null);
  const [toast, setToast] = useState(null);
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('dashboardViewMode') || 'full';
  });
  const [tradingPeriod, setTradingPeriod] = useState(() => {
    return localStorage.getItem('dashboardTradingPeriod') || 'today';
  });

  // Первоначальная загрузка
  useEffect(() => {
    loadDashboardData();
    loadSettings();
    loadProfitChart(profitPeriod);
  }, []);

  // Загрузка торговых данных при изменении периода (включая первую загрузку)
  useEffect(() => {
    if (tradingPeriod) {
      loadTradingData(tradingPeriod);
      localStorage.setItem('dashboardTradingPeriod', tradingPeriod);
    }
  }, [tradingPeriod]);

  useEffect(() => {
    loadProfitChart(profitPeriod);
  }, [profitPeriod]);

  useEffect(() => {
    if (!settings || !autoPingEnabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const startAutoPing = () => {
      pingAllServers();
      intervalRef.current = setInterval(() => {
        pingAllServers();
      }, settings.ping_interval * 1000);
    };

    startAutoPing();

    const handleVisibilityChange = () => {
      if (!document.hidden && autoPingEnabled && !intervalRef.current) {
        console.log('[Dashboard] Вкладка активна, перезапускаем автопроверку');
        startAutoPing();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [settings, autoPingEnabled]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      const [statsRes, serversRes, dailyRes, uptimeRes] = await Promise.allSettled([
        dashboardAPI.getStats(),
        serverStatusAPI.getAllWithStatus(),
        dashboardAPI.getCommandsDaily(7),
        dashboardAPI.getServerUptime()
      ]);

      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value.data);
      } else {
        console.error('Failed to load stats:', statsRes.reason);
        setStats({
          total_servers: 0,
          total_commands_all_time: 0,
          total_commands_today: 0,
          successful_commands_today: 0,
          avg_response_time: null
        });
      }

      if (serversRes.status === 'fulfilled') {
        setServersWithStatus(serversRes.value.data);
      } else {
        console.error('Failed to load servers:', serversRes.reason);
        setServersWithStatus([]);
      }

      if (dailyRes.status === 'fulfilled') {
        setCommandsDaily(dailyRes.value.data);
      } else {
        console.error('Failed to load daily commands:', dailyRes.reason);
        setCommandsDaily([]);
      }

      if (uptimeRes.status === 'fulfilled') {
        setServerUptime(uptimeRes.value.data);
      } else {
        console.error('Failed to load uptime:', uptimeRes.reason);
        setServerUptime([]);
      }
    } catch (error) {
      console.error('Ошибка загрузки дашборда:', error);
      setStats({
        total_servers: 0,
        total_commands_all_time: 0,
        total_commands_today: 0,
        successful_commands_today: 0,
        avg_response_time: null
      });
      setServersWithStatus([]);
    } finally {
      setLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      const res = await userSettingsAPI.get();
      setSettings(res.data);
      setPingInterval(res.data.ping_interval);
    } catch (error) {
      console.error('Ошибка загрузки настроек:', error);
    }
  };

  const loadTradingData = async (period = 'today') => {
    try {
      setTradingLoading(true);
      
      // Загружаем статистику торговли за выбранный период
      const [tradingRes, ordersRes] = await Promise.allSettled([
        tradingStatsAPI.get({ time_period: period }),
        ordersListAPI.getAll({ limit: 10, sort_by: 'closed_at', sort_order: 'desc' })
      ]);

      if (tradingRes.status === 'fulfilled') {
        setTradingStats(tradingRes.value.data);
      }

      if (ordersRes.status === 'fulfilled') {
        const data = ordersRes.value.data;
        // Данные могут приходить в разном формате
        setRecentOrders(Array.isArray(data) ? data : (data.orders || []));
      }
    } catch (error) {
      console.error('Ошибка загрузки торговых данных:', error);
    } finally {
      setTradingLoading(false);
    }
  };

  const loadProfitChart = async (period) => {
    try {
      const response = await tradingStatsAPI.getProfitChart({ period });
      setProfitData(response.data);
    } catch (error) {
      console.error('Ошибка загрузки графика прибыли:', error);
    }
  };

  const handleProfitPeriodChange = (period) => {
    setProfitPeriod(period);
  };

  const pingAllServers = async () => {
    try {
      const pingPromises = serversWithStatus.map(server =>
        serverStatusAPI.ping(server.id).catch(err => console.error(`Ping failed for ${server.name}:`, err))
      );
      await Promise.all(pingPromises);
      
      const serversRes = await serverStatusAPI.getAllWithStatus();
      setServersWithStatus(serversRes.data);
      
      const offlineServers = serversRes.data.filter(s => s.status && !s.status.is_online);
      if (offlineServers.length > 0 && settings?.enable_notifications) {
        showNotification(`⚠️ ${offlineServers.length} серверов оффлайн`);
      }
    } catch (error) {
      console.error('Ошибка пинга серверов:', error);
    }
  };

  const showNotification = (message) => {
    showSystemNotification(message);
    if (settings?.notification_sound) {
      playNotificationSound();
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSaveSettings = async () => {
    try {
      await userSettingsAPI.update({ ping_interval: pingInterval });
      await loadSettings();
      setShowSettings(false);
      showToast('Настройки сохранены!', 'success');
    } catch (error) {
      console.error('Ошибка сохранения настроек:', error);
      showToast('Ошибка сохранения настроек', 'error');
    }
  };

  const handleTestServer = async (serverId) => {
    setTestingServers(prev => new Set([...prev, serverId]));
    
    try {
      await serverStatusAPI.ping(serverId);
      
      const serversRes = await serverStatusAPI.getAllWithStatus();
      setServersWithStatus(serversRes.data);
      
      const statsRes = await dashboardAPI.getStats();
      setStats(statsRes.data);
      
      showToast('Сервер проверен!', 'success');
    } catch (error) {
      console.error('Ошибка теста сервера:', error);
      showToast('Ошибка при проверке сервера', 'error');
    } finally {
      setTestingServers(prev => {
        const newSet = new Set(prev);
        newSet.delete(serverId);
        return newSet;
      });
    }
  };

  const toggleAutoPing = () => {
    setAutoPingEnabled(prev => {
      const newValue = !prev;
      localStorage.setItem('dashboardAutoPingEnabled', newValue.toString());
      return newValue;
    });
  };

  const toggleViewMode = () => {
    const newMode = viewMode === 'full' ? 'compact' : 'full';
    setViewMode(newMode);
    localStorage.setItem('dashboardViewMode', newMode);
  };

  return {
    stats,
    serversWithStatus,
    commandsDaily,
    serverUptime,
    tradingStats,
    recentOrders,
    profitData,
    settings,
    loading,
    tradingLoading,
    showSettings,
    setShowSettings,
    pingInterval,
    setPingInterval,
    autoPingEnabled,
    testingServers,
    toast,
    showCleanupModal,
    setShowCleanupModal,
    viewMode,
    tradingPeriod,
    setTradingPeriod,
    handleSaveSettings,
    handleTestServer,
    toggleAutoPing,
    toggleViewMode,
    handleProfitPeriodChange
  };
};

export default useDashboard;



