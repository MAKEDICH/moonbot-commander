import { useState, useEffect, useCallback, useRef } from 'react';
import api, { tradingStatsAPI } from '../../api/api';

/**
 * Главный хук для TradingStats
 */
const useTradingStats = (autoRefresh, emulatorFilter, currencyFilter) => {
  // Состояние данных
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Фильтры
  const [selectedServers, setSelectedServers] = useState([]);
  const [selectedStrategies, setSelectedStrategies] = useState([]);
  const [availableServers, setAvailableServers] = useState([]);
  const [availableStrategies, setAvailableStrategies] = useState([]);
  const [allServers, setAllServers] = useState([]);
  const [timePeriod, setTimePeriod] = useState('all');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  
  // Dropdown states
  const [serverDropdownOpen, setServerDropdownOpen] = useState(false);
  const [strategyDropdownOpen, setStrategyDropdownOpen] = useState(false);
  const [emulatorDropdownOpen, setEmulatorDropdownOpen] = useState(false);
  const [timeDropdownOpen, setTimeDropdownOpen] = useState(false);
  
  // Сортировка таблиц
  const [sortConfig, setSortConfig] = useState({ table: null, key: null, direction: 'desc' });
  
  // Модальное окно
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState(null);
  const [modalType, setModalType] = useState(null);
  const [modalDetails, setModalDetails] = useState(null);
  const [modalDetailsLoading, setModalDetailsLoading] = useState(false);
  
  // Автообновление
  useEffect(() => {
    let interval;
    if (autoRefresh) {
      interval = setInterval(loadStats, 30000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, selectedServers, selectedStrategies, emulatorFilter, timePeriod, currencyFilter]);
  
  // Загрузка данных
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
        if (currencyFilter !== 'all' && allServers.length > 0) {
          const filteredServerIds = allServers
            .filter(server => server.default_currency === currencyFilter)
            .map(server => server.id);
          if (filteredServerIds.length > 0) {
            params.server_ids = filteredServerIds.join(',');
          } else {
            params.server_ids = 'none';
          }
        } else {
          params.server_ids = 'all';
        }
      } else {
        params.server_ids = selectedServers.join(',');
      }
      
      if (selectedStrategies.length === 0 || selectedStrategies.includes('all')) {
        params.strategies = 'all';
      } else {
        params.strategies = selectedStrategies.join(',');
      }
      
      if (timePeriod === 'custom' && customDateFrom && customDateTo) {
        params.date_from = customDateFrom;
        params.date_to = customDateTo;
      }
      
      const response = await tradingStatsAPI.get(params);
      const data = response.data;
      setStats(data);
      
      if (data.available_servers) {
        const filteredServers = currencyFilter === 'all' 
          ? data.available_servers 
          : data.available_servers.filter(server => 
              server.default_currency === currencyFilter
            );
        setAvailableServers(filteredServers);
        
        if (selectedServers.length > 0 && selectedServers[0] !== 'all') {
          const validServers = selectedServers.filter(serverId => 
            filteredServers.some(s => s.id === serverId)
          );
          if (validServers.length !== selectedServers.length) {
            setSelectedServers(validServers.length > 0 ? validServers : ['all']);
          }
        }
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
  }, [selectedServers, selectedStrategies, emulatorFilter, timePeriod, customDateFrom, customDateTo, currencyFilter, allServers]);
  
  // Загрузка всех серверов
  useEffect(() => {
    const loadServers = async () => {
      try {
        const response = await api.get('/api/servers');
        setAllServers(response.data || []);
      } catch (error) {
        console.error('Error loading servers:', error);
      }
    };
    loadServers();
  }, []);
  
  // Начальная загрузка
  useEffect(() => {
    if (allServers.length > 0 || currencyFilter === 'all') {
      loadStats();
    }
  }, [loadStats, allServers, currencyFilter]);
  
  // Обработка выбора серверов
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
  
  // Обработка выбора стратегий
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
  
  // Закрытие dropdown при клике вне
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.dropdown-container')) {
        setServerDropdownOpen(false);
        setStrategyDropdownOpen(false);
        setEmulatorDropdownOpen(false);
        setTimeDropdownOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Функция сортировки таблиц
  const handleSort = (table, key) => {
    let direction = 'desc';
    if (sortConfig.table === table && sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ table, key, direction });
  };
  
  // Открыть модальное окно с деталями
  const openModal = async (item, type) => {
    setModalData(item);
    setModalType(type);
    setModalOpen(true);
    setModalDetails(null);
    setModalDetailsLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      let entityValue = '';
      
      if (type === 'strategy') {
        entityValue = encodeURIComponent(item.strategy);
      } else if (type === 'server') {
        entityValue = encodeURIComponent(item.server_name);
      } else if (type === 'symbol') {
        entityValue = encodeURIComponent(item.symbol);
      }
      
      const response = await fetch(`${API_BASE_URL}/api/trading-stats/details/${type}/${entityValue}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });
      
      if (response.ok) {
        const details = await response.json();
        setModalDetails(details);
      }
    } catch (err) {
      console.error('Error loading modal details:', err);
    } finally {
      setModalDetailsLoading(false);
    }
  };
  
  return {
    // Данные
    stats,
    loading,
    error,
    
    // Фильтры
    selectedServers,
    selectedStrategies,
    availableServers,
    availableStrategies,
    timePeriod,
    setTimePeriod,
    customDateFrom,
    setCustomDateFrom,
    customDateTo,
    setCustomDateTo,
    
    // Dropdown states
    serverDropdownOpen,
    setServerDropdownOpen,
    strategyDropdownOpen,
    setStrategyDropdownOpen,
    emulatorDropdownOpen,
    setEmulatorDropdownOpen,
    timeDropdownOpen,
    setTimeDropdownOpen,
    
    // Сортировка
    sortConfig,
    handleSort,
    
    // Модальное окно
    modalOpen,
    modalData,
    modalType,
    modalDetails,
    modalDetailsLoading,
    setModalOpen,
    openModal,
    
    // Обработчики
    loadStats,
    handleServerToggle,
    handleStrategyToggle,
  };
};

export default useTradingStats;




