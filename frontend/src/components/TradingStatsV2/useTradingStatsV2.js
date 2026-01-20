import { useState, useEffect, useCallback } from 'react';
import { tradingStatsAPI } from '../../api/api';

/**
 * Хук для управления статистикой торговли
 */
const useTradingStatsV2 = (autoRefresh, emulatorFilter, timePeriod) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [selectedServers, setSelectedServers] = useState([]);
  const [selectedStrategies, setSelectedStrategies] = useState([]);
  const [availableServers, setAvailableServers] = useState([]);
  const [availableStrategies, setAvailableStrategies] = useState([]);
  
  const [dropdownStates, setDropdownStates] = useState({
    emulator: false,
    time: false,
    servers: false,
    strategies: false
  });
  
  const [sortConfig, setSortConfig] = useState({ 
    table: null, 
    key: null, 
    direction: 'desc' 
  });

  /**
   * Загружает статистику с сервера
   */
  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      
      // Формируем параметры запроса
      const params = {};
      
      if (emulatorFilter !== 'all') {
        params.emulator = emulatorFilter === 'emulator' ? 'true' : 'false';
      }
      
      if (timePeriod && timePeriod !== 'all') {
        params.time_period = timePeriod;
      }
      
      if (selectedServers.length === 0 || selectedServers.includes('all')) {
        params.server_ids = 'all';
      } else {
        params.server_ids = selectedServers.join(',');
      }
      
      if (selectedStrategies.length === 0 || selectedStrategies.includes('all')) {
        params.strategies = 'all';
      } else {
        params.strategies = selectedStrategies.join(',');
      }
      
      const response = await tradingStatsAPI.get(params);
      const data = response.data;
      
      console.log('[TradingStatsV2] Loaded data:', data);
      
      setStats(data);
      
      if (data.available_servers) {
        setAvailableServers(data.available_servers);
      }
      if (data.available_strategies) {
        setAvailableStrategies(data.available_strategies);
      }
      
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Error loading stats:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedServers, selectedStrategies, emulatorFilter, timePeriod]);

  /**
   * Автообновление
   */
  useEffect(() => {
    let interval;
    if (autoRefresh) {
      interval = setInterval(loadStats, 30000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, loadStats]);

  /**
   * Начальная загрузка
   */
  useEffect(() => {
    loadStats();
  }, [loadStats]);

  /**
   * Закрытие dropdown при клике вне
   */
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.dropdown-container')) {
        setDropdownStates({
          emulator: false,
          time: false,
          servers: false,
          strategies: false
        });
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /**
   * Обработка выбора серверов
   */
  const handleServerToggle = (serverId) => {
    if (serverId === 'all') {
      setSelectedServers(selectedServers.includes('all') ? [] : ['all']);
    } else {
      const newSelection = selectedServers.filter(id => id !== 'all');
      if (newSelection.includes(serverId)) {
        const filtered = newSelection.filter(id => id !== serverId);
        setSelectedServers(filtered.length === 0 ? ['all'] : filtered);
      } else {
        setSelectedServers([...newSelection, serverId]);
      }
    }
  };

  /**
   * Обработка выбора стратегий
   */
  const handleStrategyToggle = (strategy) => {
    if (strategy === 'all') {
      setSelectedStrategies(selectedStrategies.includes('all') ? [] : ['all']);
    } else {
      const newSelection = selectedStrategies.filter(s => s !== 'all');
      if (newSelection.includes(strategy)) {
        const filtered = newSelection.filter(s => s !== strategy);
        setSelectedStrategies(filtered.length === 0 ? ['all'] : filtered);
      } else {
        setSelectedStrategies([...newSelection, strategy]);
      }
    }
  };

  /**
   * Обработка сортировки таблиц
   */
  const handleSort = (table, key) => {
    let direction = 'desc';
    if (sortConfig.table === table && sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ table, key, direction });
  };

  return {
    stats,
    loading,
    error,
    selectedServers,
    selectedStrategies,
    availableServers,
    availableStrategies,
    dropdownStates,
    sortConfig,
    loadStats,
    handleServerToggle,
    handleStrategyToggle,
    handleSort,
    setDropdownStates
  };
};

export default useTradingStatsV2;



