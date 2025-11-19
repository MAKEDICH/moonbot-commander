import React, { useState, useEffect, useCallback, useRef } from 'react';
import { LineChart, Line, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { FaChartLine, FaArrowUp, FaArrowDown, FaMinus, FaFire, FaExclamationTriangle, FaBolt, FaTrophy } from 'react-icons/fa';
import styles from './TradingStats.module.css';
import { getApiBaseUrl } from '../utils/apiUrl';
import api from '../api/api';

const API_BASE_URL = getApiBaseUrl();

// Компонент анимированного счётчика
const AnimatedCounter = ({ value, decimals = 0, suffix = '', className = '' }) => {
  const [displayValue, setDisplayValue] = useState(0);
  const prevValueRef = useRef(0);
  
  useEffect(() => {
    const startValue = prevValueRef.current;
    const endValue = parseFloat(value) || 0;
    const duration = 800; // 0.8 секунды
    const steps = 30;
    const stepDuration = duration / steps;
    const increment = (endValue - startValue) / steps;
    
    let currentStep = 0;
    const timer = setInterval(() => {
      currentStep++;
      if (currentStep >= steps) {
        setDisplayValue(endValue);
        prevValueRef.current = endValue;
        clearInterval(timer);
      } else {
        setDisplayValue(startValue + (increment * currentStep));
      }
    }, stepDuration);
    
    return () => clearInterval(timer);
  }, [value]);
  
  return (
    <span className={className}>
      {displayValue.toFixed(decimals)}{suffix}
    </span>
  );
};

// Компонент Sparkline (мини-график)
const Sparkline = ({ data = [], height = 40 }) => {
  if (!data || data.length === 0) return null;
  
  const max = Math.max(...data.map(v => Math.abs(v)));
  const min = Math.min(...data);
  
  return (
    <div className={styles.sparkline} style={{ height: `${height}px` }}>
      {data.map((value, index) => {
        const percentage = max > 0 ? (Math.abs(value) / max) * 100 : 10;
        const isNegative = value < 0;
        
        return (
          <div
            key={index}
            className={`${styles.sparklineBar} ${isNegative ? styles.negative : ''}`}
            style={{ height: `${percentage}%` }}
            title={value.toFixed(2)}
          />
        );
      })}
    </div>
  );
};

const TradingStats = ({ autoRefresh, setAutoRefresh, emulatorFilter, setEmulatorFilter, currencyFilter }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Фильтры
  const [selectedServers, setSelectedServers] = useState([]);
  const [selectedStrategies, setSelectedStrategies] = useState([]);
  const [availableServers, setAvailableServers] = useState([]);
  const [availableStrategies, setAvailableStrategies] = useState([]);
  const [allServers, setAllServers] = useState([]); // Все серверы пользователя
  const [timePeriod, setTimePeriod] = useState('all'); // 'today', 'week', 'month', 'all', 'custom'
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
  const [modalType, setModalType] = useState(null); // 'strategy', 'server', 'symbol'
  const [modalDetails, setModalDetails] = useState(null); // детальные данные
  const [modalDetailsLoading, setModalDetailsLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState(new Set()); // для разворачиваемых строк в таблицах

  // Auto-refresh
  useEffect(() => {
    let interval;
    if (autoRefresh) {
      interval = setInterval(loadStats, 30000); // каждые 30 сек
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, selectedServers, selectedStrategies, emulatorFilter, timePeriod, currencyFilter]);

  // Загрузка данных
  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // Формируем параметры запроса
      const params = new URLSearchParams();
      
      // Фильтр эмулятора
      if (emulatorFilter !== 'all') {
        params.append('emulator', emulatorFilter === 'emulator' ? 'true' : 'false');
      }
      
      // Фильтр времени
      if (timePeriod && timePeriod !== 'all') {
        params.append('time_period', timePeriod);
      }
      
      // Серверы
      if (selectedServers.length === 0 || selectedServers.includes('all')) {
        // При выборе "все сервера" учитываем фильтр по валюте
        if (currencyFilter !== 'all' && allServers.length > 0) {
          const filteredServerIds = allServers
            .filter(server => server.default_currency === currencyFilter)
            .map(server => server.id);
          if (filteredServerIds.length > 0) {
            params.append('server_ids', filteredServerIds.join(','));
          } else {
            params.append('server_ids', 'none'); // Нет серверов с нужной валютой
          }
        } else {
          params.append('server_ids', 'all');
        }
      } else {
        params.append('server_ids', selectedServers.join(','));
      }
      
      // Стратегии
      if (selectedStrategies.length === 0 || selectedStrategies.includes('all')) {
        params.append('strategies', 'all');
      } else {
        params.append('strategies', selectedStrategies.join(','));
      }
      
      // Кастомный период
      if (timePeriod === 'custom' && customDateFrom && customDateTo) {
        params.append('date_from', customDateFrom);
        params.append('date_to', customDateTo);
      }
      
      const response = await fetch(`${API_BASE_URL}/api/trading-stats?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('[TradingStats] Loaded data:', data);
      
      setStats(data);
      
      // Обновляем доступные фильтры
      if (data.available_servers) {
        // Фильтруем серверы по валюте
        const filteredServers = currencyFilter === 'all' 
          ? data.available_servers 
          : data.available_servers.filter(server => 
              server.default_currency === currencyFilter
            );
        setAvailableServers(filteredServers);
        
        // Обновляем выбранные серверы, убирая те которые больше недоступны
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

  // Сортировка данных таблицы
  const sortTableData = (data, table) => {
    if (!sortConfig.key || sortConfig.table !== table || !Array.isArray(data)) return data;
    
    // Создаем полную копию массива чтобы избежать ошибок с read-only
    return data.slice().sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      const strA = String(aVal || '').toLowerCase();
      const strB = String(bVal || '').toLowerCase();
      
      if (sortConfig.direction === 'asc') {
        return strA.localeCompare(strB);
      } else {
        return strB.localeCompare(strA);
      }
    });
  };

  // Определить ранг строки в таблице (топ-3, худшие)
  const getRowRank = (data, index, key) => {
    if (!Array.isArray(data) || data.length === 0) return 'normal';
    
    // Создаем полную копию массива чтобы избежать ошибок с read-only
    const sorted = data.slice().sort((a, b) => b[key] - a[key]);
    const sortedIndex = sorted.findIndex(item => item === data[index]);
    
    if (sortedIndex < 3) return 'top';
    if (sortedIndex >= data.length - 3) return 'worst';
    return 'normal';
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

  // Переключить развёрнутость строки
  const toggleRowExpand = (key) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedRows(newExpanded);
  };

  // Получить текст для кнопки dropdown
  const getServerButtonText = () => {
    if (selectedServers.length === 0 || selectedServers.includes('all')) {
      return '🤖 Все боты';
    }
    if (selectedServers.length === 1) {
      const server = availableServers.find(s => s.id === selectedServers[0]);
      return `🤖 ${server?.name || selectedServers[0]}`;
    }
    return `🤖 Выбрано: ${selectedServers.length}`;
  };

  const getStrategyButtonText = () => {
    if (selectedStrategies.length === 0 || selectedStrategies.includes('all')) {
      return '🎯 Все стратегии';
    }
    if (selectedStrategies.length === 1) {
      return `🎯 ${selectedStrategies[0]}`;
    }
    return `🎯 Выбрано: ${selectedStrategies.length}`;
  };

  const getTimePeriodText = () => {
    const periods = {
      'all': '📅 За всё время',
      'today': '📅 За сегодня',
      'week': '📅 За неделю',
      'month': '📅 За месяц',
      'custom': `📅 ${customDateFrom || '...'} - ${customDateTo || '...'}`
    };
    return periods[timePeriod] || '📅 За всё время';
  };

  if (loading && !stats) {
    return <div className={styles.loading}>Загрузка статистики...</div>;
  }

  if (error) {
    return <div className={styles.error}>Ошибка: {error}</div>;
  }

  if (!stats) {
    return null;
  }

  const overall = stats.overall || {};
  const by_strategy = Array.isArray(stats.by_strategy) ? stats.by_strategy : [];
  const by_server = Array.isArray(stats.by_server) ? stats.by_server : [];
  const by_symbol = Array.isArray(stats.by_symbol) ? stats.by_symbol : [];
  const top_profitable = Array.isArray(stats.top_profitable) ? stats.top_profitable : [];
  const top_losing = Array.isArray(stats.top_losing) ? stats.top_losing : [];

  // Данные для графиков
  const pieData = by_strategy.slice(0, 5).map(s => ({
    name: s.strategy,
    value: Math.abs(s.total_profit)
  }));

  const COLORS = ['#00C49F', '#0088FE', '#FFBB28', '#FF8042', '#8884d8'];

  // Данные графика прибыли по времени
  const profitTimeline = Array.isArray(stats.profit_timeline) ? stats.profit_timeline : [];
  const winrateTimeline = Array.isArray(stats.winrate_timeline) ? stats.winrate_timeline : [];
  const previousPeriod = stats.previous_period || null;

  // Данные для sparklines (последние 10 точек дневной прибыли)
  const sparklineData = profitTimeline.slice(-10).map(item => item.daily_profit);

  // Компонент для отображения изменений
  const ChangeIndicator = ({ value, showPercent = true, invertColors = false }) => {
    if (!value || value === 0) return null;
    
    const isPositive = value > 0;
    const displayPositive = invertColors ? !isPositive : isPositive;
    const icon = isPositive ? <FaArrowUp /> : <FaArrowDown />;
    const className = displayPositive ? styles.changePositive : styles.changeNegative;
    
    return (
      <span className={`${styles.changeIndicator} ${className}`}>
        {icon} {Math.abs(value).toFixed(showPercent ? 1 : 2)}{showPercent ? '%' : ''}
      </span>
    );
  };

  // Горячие индикаторы
  const hotStrategy = by_strategy.length > 0 ? by_strategy[0] : null;
  const problemSymbol = by_symbol.filter(s => s.total_profit < 0).slice().sort((a, b) => a.total_profit - b.total_profit)[0];
  const mostActiveServer = by_server.slice().sort((a, b) => b.total_orders - a.total_orders)[0];
  
  // Рост винрейта (сравнение последних 7 дней с предыдущими 7)
  const winrateGrowth = winrateTimeline.length >= 14 ? (() => {
    const recent7 = winrateTimeline.slice(-7);
    const previous7 = winrateTimeline.slice(-14, -7);
    const recentAvg = recent7.reduce((sum, item) => sum + item.winrate, 0) / 7;
    const previousAvg = previous7.reduce((sum, item) => sum + item.winrate, 0) / 7;
    const change = recentAvg - previousAvg;
    return { recentAvg, previousAvg, change };
  })() : null;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>📊 Статистика торговли</h1>
        <div className={styles.controls}>
          <button onClick={loadStats} className={styles.refreshBtn} disabled={loading}>
            🔄 {loading ? 'Загрузка...' : 'Обновить'}
          </button>
          <label className={styles.autoRefreshLabel}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Автообновление
          </label>
        </div>
      </div>

      {/* Фильтры */}
      <div className={styles.filters}>
        {/* Эмулятор */}
        <div className={`${styles.dropdown} dropdown-container`}>
          <button 
            className={styles.dropdownButton}
            onClick={() => {
              setEmulatorDropdownOpen(!emulatorDropdownOpen);
              setServerDropdownOpen(false);
              setStrategyDropdownOpen(false);
              setTimeDropdownOpen(false);
            }}
          >
            {emulatorFilter === 'all' ? '🎮 Все' : emulatorFilter === 'real' ? '💰 Реальные' : '🎮 Эмулятор'}
            <span className={styles.dropdownArrow}>{emulatorDropdownOpen ? '▲' : '▼'}</span>
          </button>
          
          {emulatorDropdownOpen && (
            <div className={styles.dropdownMenu}>
              <label className={styles.dropdownItem} onClick={() => { setEmulatorFilter('all'); setEmulatorDropdownOpen(false); }}>
                <input type="radio" checked={emulatorFilter === 'all'} onChange={() => {}} />
                <span>🎮 Все</span>
              </label>
              <label className={styles.dropdownItem} onClick={() => { setEmulatorFilter('real'); setEmulatorDropdownOpen(false); }}>
                <input type="radio" checked={emulatorFilter === 'real'} onChange={() => {}} />
                <span>💰 Реальные</span>
              </label>
              <label className={styles.dropdownItem} onClick={() => { setEmulatorFilter('emulator'); setEmulatorDropdownOpen(false); }}>
                <input type="radio" checked={emulatorFilter === 'emulator'} onChange={() => {}} />
                <span>🎮 Эмулятор</span>
              </label>
            </div>
          )}
        </div>

        {/* Период времени */}
        <div className={`${styles.dropdown} dropdown-container`}>
          <button 
            className={styles.dropdownButton}
            onClick={() => {
              setTimeDropdownOpen(!timeDropdownOpen);
              setServerDropdownOpen(false);
              setStrategyDropdownOpen(false);
              setEmulatorDropdownOpen(false);
            }}
          >
            {getTimePeriodText()}
            <span className={styles.dropdownArrow}>{timeDropdownOpen ? '▲' : '▼'}</span>
          </button>
          
          {timeDropdownOpen && (
            <div className={styles.dropdownMenu}>
              <label className={styles.dropdownItem} onClick={() => { setTimePeriod('today'); setTimeDropdownOpen(false); }}>
                <input type="radio" checked={timePeriod === 'today'} onChange={() => {}} />
                <span>📅 За сегодня</span>
              </label>
              <label className={styles.dropdownItem} onClick={() => { setTimePeriod('week'); setTimeDropdownOpen(false); }}>
                <input type="radio" checked={timePeriod === 'week'} onChange={() => {}} />
                <span>📅 За неделю</span>
              </label>
              <label className={styles.dropdownItem} onClick={() => { setTimePeriod('month'); setTimeDropdownOpen(false); }}>
                <input type="radio" checked={timePeriod === 'month'} onChange={() => {}} />
                <span>📅 За месяц</span>
              </label>
              <label className={styles.dropdownItem} onClick={() => { setTimePeriod('all'); setTimeDropdownOpen(false); }}>
                <input type="radio" checked={timePeriod === 'all'} onChange={() => {}} />
                <span>📅 За всё время</span>
              </label>
              <label className={styles.dropdownItem} onClick={() => { setTimePeriod('custom'); }}>
                <input type="radio" checked={timePeriod === 'custom'} onChange={() => {}} />
                <span>📅 Свой период</span>
              </label>
              
              {/* Поля для ввода дат при выборе "Свой период" */}
              {timePeriod === 'custom' && (
                <div className={styles.customDateInputs}>
                  <div className={styles.dateInputGroup}>
                    <label>От:</label>
                    <input 
                      type="date" 
                      value={customDateFrom} 
                      onChange={(e) => setCustomDateFrom(e.target.value)}
                      className={styles.dateInput}
                    />
                  </div>
                  <div className={styles.dateInputGroup}>
                    <label>До:</label>
                    <input 
                      type="date" 
                      value={customDateTo} 
                      onChange={(e) => setCustomDateTo(e.target.value)}
                      className={styles.dateInput}
                    />
                  </div>
                  <button 
                    className={styles.applyDateBtn}
                    onClick={() => {
                      if (customDateFrom && customDateTo) {
                        setTimeDropdownOpen(false);
                        loadStats();
                      }
                    }}
                    disabled={!customDateFrom || !customDateTo}
                  >
                    Применить
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Серверы - остальные дропдауны аналогично, оставлю как было */}
        <div className={`${styles.dropdown} dropdown-container`}>
          <button 
            className={styles.dropdownButton}
            onClick={() => {
              setServerDropdownOpen(!serverDropdownOpen);
              setStrategyDropdownOpen(false);
              setEmulatorDropdownOpen(false);
              setTimeDropdownOpen(false);
            }}
          >
            {getServerButtonText()}
            <span className={styles.dropdownArrow}>{serverDropdownOpen ? '▲' : '▼'}</span>
          </button>
          
          {serverDropdownOpen && (
            <div className={styles.dropdownMenu}>
              <label className={styles.dropdownItem}>
                <input
                  type="checkbox"
                  checked={selectedServers.includes('all') || selectedServers.length === 0}
                  onChange={() => handleServerToggle('all')}
                />
                <span>Все боты</span>
              </label>
              {availableServers.map(server => (
                <label key={server.id} className={styles.dropdownItem}>
                  <input
                    type="checkbox"
                    checked={selectedServers.includes(server.id)}
                    onChange={() => handleServerToggle(server.id)}
                  />
                  <span>{server.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Стратегии */}
        <div className={`${styles.dropdown} dropdown-container`}>
          <button 
            className={styles.dropdownButton}
            onClick={() => {
              setStrategyDropdownOpen(!strategyDropdownOpen);
              setServerDropdownOpen(false);
              setEmulatorDropdownOpen(false);
              setTimeDropdownOpen(false);
            }}
          >
            {getStrategyButtonText()}
            <span className={styles.dropdownArrow}>{strategyDropdownOpen ? '▲' : '▼'}</span>
          </button>
          
          {strategyDropdownOpen && (
            <div className={styles.dropdownMenu}>
              <label className={styles.dropdownItem}>
                <input
                  type="checkbox"
                  checked={selectedStrategies.includes('all') || selectedStrategies.length === 0}
                  onChange={() => handleStrategyToggle('all')}
                />
                <span>Все стратегии</span>
              </label>
              {availableStrategies.map(strategy => (
                <label key={strategy} className={styles.dropdownItem}>
                  <input
                    type="checkbox"
                    checked={selectedStrategies.includes(strategy)}
                    onChange={() => handleStrategyToggle(strategy)}
                  />
                  <span>{strategy}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Горячие индикаторы */}
      {(hotStrategy || problemSymbol || mostActiveServer) && (
        <div className={styles.hotIndicators}>
          {hotStrategy && (
            <div className={`${styles.hotCard} ${styles.hotSuccess}`}>
              <FaFire className={styles.hotIcon} />
              <div>
                <div className={styles.hotLabel}>Горячая стратегия</div>
                <div className={styles.hotValue}>{hotStrategy.strategy}</div>
                <div className={styles.hotSubtext}>
                  {hotStrategy.total_profit > 0 ? '+' : ''}{hotStrategy.total_profit.toFixed(2)} USDT
                </div>
              </div>
            </div>
          )}
          
          {problemSymbol && (
            <div className={`${styles.hotCard} ${styles.hotWarning}`}>
              <FaExclamationTriangle className={styles.hotIcon} />
              <div>
                <div className={styles.hotLabel}>Проблемная монета</div>
                <div className={styles.hotValue}>{problemSymbol.symbol}</div>
                <div className={styles.hotSubtext}>
                  {problemSymbol.total_profit.toFixed(2)} USDT
                </div>
              </div>
            </div>
          )}
          
          {mostActiveServer && (
            <div className={`${styles.hotCard} ${styles.hotInfo}`}>
              <FaBolt className={styles.hotIcon} />
              <div>
                <div className={styles.hotLabel}>Активный бот</div>
                <div className={styles.hotValue}>{mostActiveServer.server_name}</div>
                <div className={styles.hotSubtext}>
                  {mostActiveServer.total_orders} сделок
                </div>
              </div>
            </div>
          )}
          
          {winrateGrowth && Math.abs(winrateGrowth.change) > 1 && (
            <div className={`${styles.hotCard} ${winrateGrowth.change > 0 ? styles.hotSuccess : styles.hotWarning}`}>
              <FaTrophy className={styles.hotIcon} />
              <div>
                <div className={styles.hotLabel}>Рост винрейта</div>
                <div className={styles.hotValue}>
                  {winrateGrowth.change > 0 ? '+' : ''}{winrateGrowth.change.toFixed(1)}%
                </div>
                <div className={styles.hotSubtext}>
                  За последнюю неделю
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Основные метрики */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>📊 Всего сделок</div>
          <div className={styles.statValue}>
            <AnimatedCounter value={overall.total_orders || 0} decimals={0} />
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>🟢 Открытых</div>
          <div className={styles.statValue}>
            <AnimatedCounter value={overall.open_orders || 0} decimals={0} />
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>🔴 Закрытых</div>
          <div className={styles.statValue}>
            <AnimatedCounter value={overall.closed_orders || 0} decimals={0} />
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>💰 Общая прибыль</div>
          <div className={`${styles.statValue} ${(overall.total_profit || 0) >= 0 ? styles.positive : styles.negative}`}>
            <AnimatedCounter value={overall.total_profit || 0} decimals={2} suffix=" USDT" />
          </div>
          {sparklineData.length > 0 && <Sparkline data={sparklineData} height={35} />}
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>📈 Средняя прибыль</div>
          <div className={`${styles.statValue} ${(overall.avg_profit || 0) >= 0 ? styles.positive : styles.negative}`}>
            <AnimatedCounter value={overall.avg_profit || 0} decimals={2} suffix=" USDT" />
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>✅ Прибыльных</div>
          <div className={`${styles.statValue} ${styles.positive}`}>
            <AnimatedCounter value={overall.profitable_count || 0} decimals={0} />
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>❌ Убыточных</div>
          <div className={`${styles.statValue} ${styles.negative}`}>
            <AnimatedCounter value={overall.losing_count || 0} decimals={0} />
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>🎯 Винрейт</div>
          <div className={`${styles.statValue} ${(overall.winrate || 0) >= 50 ? styles.positive : styles.negative}`}>
            <AnimatedCounter value={overall.winrate || 0} decimals={1} suffix="%" />
          </div>
        </div>
      </div>

      {/* График прибыли по времени */}
      {profitTimeline.length > 0 && (
        <div className={styles.section}>
          <h2>📈 Динамика прибыли</h2>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={profitTimeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis 
                dataKey="date" 
                stroke="#00ff88"
                tick={{ fill: '#aaa', fontSize: 12 }}
              />
              <YAxis 
                stroke="#00ff88"
                tick={{ fill: '#aaa', fontSize: 12 }}
              />
              <Tooltip 
                contentStyle={{ 
                  background: 'rgba(20, 20, 20, 0.95)', 
                  border: '1px solid #00ff88',
                  borderRadius: '8px',
                  padding: '10px'
                }}
                labelStyle={{ color: '#00ff88' }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="cumulative_profit" 
                stroke="#00ff88" 
                strokeWidth={3}
                name="Накопительная прибыль"
                dot={{ fill: '#00ff88', r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line 
                type="monotone" 
                dataKey="daily_profit" 
                stroke="#667eea" 
                strokeWidth={2}
                name="Дневная прибыль"
                dot={{ fill: '#667eea', r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
          
          {/* Сравнение с предыдущим периодом */}
          {previousPeriod && timePeriod !== 'all' && (
            <div className={styles.comparisonBlock}>
              <div className={styles.comparisonTitle}>
                📊 Сравнение с предыдущим периодом
              </div>
              <div className={styles.comparisonGrid}>
                <div className={styles.comparisonCard}>
                  <div className={styles.comparisonLabel}>Прибыль</div>
                  <div className={styles.comparisonValue}>
                    {overall.total_profit.toFixed(2)} USDT
                    <ChangeIndicator value={previousPeriod.profit_change_percent} />
                  </div>
                  <div className={styles.comparisonDetail}>
                    Было: {previousPeriod.prev_total_profit.toFixed(2)} USDT
                  </div>
                </div>
                
                <div className={styles.comparisonCard}>
                  <div className={styles.comparisonLabel}>Винрейт</div>
                  <div className={styles.comparisonValue}>
                    {overall.winrate.toFixed(1)}%
                    <ChangeIndicator value={previousPeriod.winrate_change} showPercent={false} />
                  </div>
                  <div className={styles.comparisonDetail}>
                    Было: {previousPeriod.prev_winrate.toFixed(1)}%
                  </div>
                </div>
                
                <div className={styles.comparisonCard}>
                  <div className={styles.comparisonLabel}>Сделок</div>
                  <div className={styles.comparisonValue}>
                    {overall.total_orders}
                    <ChangeIndicator value={previousPeriod.orders_change_percent} />
                  </div>
                  <div className={styles.comparisonDetail}>
                    Было: {previousPeriod.prev_total_orders}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* График винрейта по дням */}
      {winrateTimeline.length > 0 && (
        <div className={styles.section}>
          <h2>🎯 Динамика винрейта</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={winrateTimeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis 
                dataKey="date" 
                stroke="#00ff88"
                tick={{ fill: '#aaa', fontSize: 12 }}
              />
              <YAxis 
                stroke="#00ff88"
                tick={{ fill: '#aaa', fontSize: 12 }}
                domain={[0, 100]}
              />
              <Tooltip 
                contentStyle={{ 
                  background: 'rgba(20, 20, 20, 0.95)', 
                  border: '1px solid #667eea',
                  borderRadius: '8px',
                  padding: '10px'
                }}
                labelStyle={{ color: '#00ff88' }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="winrate" 
                stroke="#667eea" 
                strokeWidth={3}
                name="Винрейт %"
                dot={{ fill: '#667eea', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
          
          {/* Тепловая карта винрейта */}
          {winrateTimeline.length >= 7 && (
            <div className={styles.heatmapContainer}>
              <h3 style={{ color: '#00ff88', marginBottom: '15px' }}>🔥 Тепловая карта эффективности</h3>
              <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
                {/* Легенда */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', color: '#999' }}>
                  <span>Винрейт:</span>
                  <div className={`${styles.heatmapCell} ${styles.heat1}`} style={{ width: '30px', height: '30px' }}>0-20%</div>
                  <div className={`${styles.heatmapCell} ${styles.heat2}`} style={{ width: '30px', height: '30px' }}>20-40%</div>
                  <div className={`${styles.heatmapCell} ${styles.heat3}`} style={{ width: '30px', height: '30px' }}>40-60%</div>
                  <div className={`${styles.heatmapCell} ${styles.heat4}`} style={{ width: '30px', height: '30px' }}>60-80%</div>
                  <div className={`${styles.heatmapCell} ${styles.heat5}`} style={{ width: '30px', height: '30px' }}>80-100%</div>
                </div>
              </div>
              
              {/* Сетка */}
              <div className={styles.heatmapGrid} style={{ marginTop: '20px' }}>
                <div className={styles.heatmapLabel}></div>
                {Array.from({ length: 7 }, (_, i) => (
                  <div key={`day-${i}`} className={styles.heatmapLabel}>
                    День {i + 1}
                  </div>
                ))}
                
                {['Утро', 'День', 'Вечер'].map((period) => (
                  <React.Fragment key={period}>
                    <div className={styles.heatmapLabel}>{period}</div>
                    {winrateTimeline.slice(-7).map((item, dayIndex) => {
                      const winrate = item.winrate || 0;
                      let heatClass = styles.heat0;
                      if (winrate > 80) heatClass = styles.heat5;
                      else if (winrate > 60) heatClass = styles.heat4;
                      else if (winrate > 40) heatClass = styles.heat3;
                      else if (winrate > 20) heatClass = styles.heat2;
                      else if (winrate > 0) heatClass = styles.heat1;
                      
                      return (
                        <div 
                          key={`${period}-${dayIndex}`}
                          className={`${styles.heatmapCell} ${heatClass}`}
                          title={`${item.date} ${period}: ${winrate.toFixed(1)}% (${item.total_orders} сделок)`}
                        >
                          {winrate > 0 ? winrate.toFixed(0) : '-'}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Расширенные метрики */}
      <div className={styles.section}>
        <h2>📊 Расширенные метрики</h2>
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>⚖️ Profit Factor</div>
            <div className={`${styles.statValue} ${(overall.profit_factor || 0) > 1 ? styles.positive : styles.negative}`}>
              <AnimatedCounter value={overall.profit_factor || 0} decimals={2} />
            </div>
            <div className={styles.statSubtext}>
              {(overall.profit_factor || 0) > 1 ? 'Отлично' : 'Требует внимания'}
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>📉 Max Drawdown</div>
            <div className={`${styles.statValue} ${styles.negative}`}>
              <AnimatedCounter value={overall.max_drawdown || 0} decimals={2} suffix=" USDT" />
            </div>
            <div className={styles.statSubtext}>Макс. просадка</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>⏱️ Средняя длительность</div>
            <div className={styles.statValue}>
              <AnimatedCounter value={overall.avg_duration_hours || 0} decimals={1} suffix="ч" />
            </div>
            <div className={styles.statSubtext}>На сделку</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>💎 ROI</div>
            <div className={`${styles.statValue} ${(overall.roi || 0) >= 0 ? styles.positive : styles.negative}`}>
              <AnimatedCounter value={overall.roi || 0} decimals={1} suffix="%" />
            </div>
            <div className={styles.statSubtext}>Возврат инвестиций</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>🔥 Макс. серия побед</div>
            <div className={`${styles.statValue} ${styles.positive}`}>
              <AnimatedCounter value={overall.max_win_streak || 0} decimals={0} />
            </div>
            <div className={styles.statSubtext}>Подряд</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>❄️ Макс. серия поражений</div>
            <div className={`${styles.statValue} ${styles.negative}`}>
              <AnimatedCounter value={overall.max_loss_streak || 0} decimals={0} />
            </div>
            <div className={styles.statSubtext}>Подряд</div>
          </div>
        </div>
      </div>

      {/* AI Инсайты */}
      {overall.total_orders > 0 && (
        <div className={styles.section}>
          <h2>💡 Автоматические инсайты</h2>
          <div className={styles.insightsGrid}>
            {/* Лучшая стратегия */}
            {by_strategy.length > 0 && by_strategy[0].winrate > 0 && (
              <div className={styles.insightCard}>
                <div className={styles.insightIcon}>🎯</div>
                <div className={styles.insightText}>
                  Стратегия <strong>{by_strategy[0].strategy}</strong> показывает лучший винрейт <strong>{by_strategy[0].winrate.toFixed(1)}%</strong>
                </div>
              </div>
            )}
            
            {/* Доминирующий символ */}
            {by_symbol.length > 0 && overall.total_profit !== 0 && (
              <div className={styles.insightCard}>
                <div className={styles.insightIcon}>💰</div>
                <div className={styles.insightText}>
                  <strong>{by_symbol[0].symbol}</strong> принесла {Math.abs((by_symbol[0].total_profit / overall.total_profit) * 100).toFixed(0)}% 
                  {by_symbol[0].total_profit >= 0 ? ' прибыли' : ' убытков'}
                </div>
              </div>
            )}
            
            {/* Активность бота */}
            {by_server.length > 0 && (
              <div className={styles.insightCard}>
                <div className={styles.insightIcon}>🤖</div>
                <div className={styles.insightText}>
                  Бот <strong>{by_server[0].server_name}</strong> имеет самую высокую активность с <strong>{by_server[0].total_orders}</strong> сделками
                </div>
              </div>
            )}
            
            {/* Средняя длительность */}
            {overall.avg_duration_hours > 0 && (
              <div className={styles.insightCard}>
                <div className={styles.insightIcon}>⏱️</div>
                <div className={styles.insightText}>
                  Средняя прибыльная сделка длится <strong>{overall.avg_duration_hours.toFixed(1)} часов</strong>
                </div>
              </div>
            )}
            
            {/* Profit Factor оценка */}
            {overall.profit_factor > 0 && (
              <div className={styles.insightCard}>
                <div className={styles.insightIcon}>
                  {overall.profit_factor > 2 ? '🏆' : overall.profit_factor > 1 ? '✅' : '⚠️'}
                </div>
                <div className={styles.insightText}>
                  Profit Factor <strong>{overall.profit_factor.toFixed(2)}</strong> - 
                  {overall.profit_factor > 2 ? ' отличный результат!' : 
                   overall.profit_factor > 1 ? ' хороший результат' : 
                   ' требуется оптимизация'}
                </div>
              </div>
            )}
            
            {/* Серия побед */}
            {overall.max_win_streak > 3 && (
              <div className={styles.insightCard}>
                <div className={styles.insightIcon}>🔥</div>
                <div className={styles.insightText}>
                  Лучшая серия: <strong>{overall.max_win_streak}</strong> прибыльных сделок подряд
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* График распределения прибыли по стратегиям */}
      {pieData.length > 0 && (
        <div className={styles.section}>
          <h2>🥧 Распределение прибыли по стратегиям</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.name}: ${entry.value.toFixed(2)}`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Барчарт сравнения ботов */}
      {by_server.length > 0 && (
        <div className={styles.section}>
          <h2>📊 Сравнение ботов</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={by_server}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="server_name" stroke="#00ff88" />
              <YAxis stroke="#00ff88" />
              <Tooltip 
                contentStyle={{ 
                  background: 'rgba(20, 20, 20, 0.95)', 
                  border: '1px solid #00ff88',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Bar dataKey="total_profit" fill="#00ff88" name="Прибыль USDT" />
              <Bar dataKey="total_orders" fill="#667eea" name="Сделок" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Статистика по стратегиям */}
      <div className={styles.section}>
        <h2>📈 По стратегиям</h2>
        <div className={styles.table}>
          <table>
            <thead>
              <tr>
                <th onClick={() => handleSort('strategy', 'strategy')} style={{ cursor: 'pointer' }}>
                  Стратегия {sortConfig.table === 'strategy' && sortConfig.key === 'strategy' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('strategy', 'total_orders')} style={{ cursor: 'pointer' }}>
                  Сделок {sortConfig.table === 'strategy' && sortConfig.key === 'total_orders' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('strategy', 'total_profit')} style={{ cursor: 'pointer' }}>
                  Прибыль USDT {sortConfig.table === 'strategy' && sortConfig.key === 'total_profit' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('strategy', 'avg_profit_percent')} style={{ cursor: 'pointer' }}>
                  Средний % {sortConfig.table === 'strategy' && sortConfig.key === 'avg_profit_percent' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('strategy', 'winrate')} style={{ cursor: 'pointer' }}>
                  Винрейт {sortConfig.table === 'strategy' && sortConfig.key === 'winrate' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortTableData(by_strategy, 'strategy').map((s, idx) => {
                const rank = getRowRank(by_strategy, idx, 'total_profit');
                const rowClass = rank === 'top' ? styles.topRow : rank === 'worst' ? styles.worstRow : '';
                
                return (
                  <tr 
                    key={idx} 
                    className={`${rowClass} ${styles.clickableRow}`}
                    onClick={() => openModal(s, 'strategy')}
                    title="Кликните для подробной информации"
                  >
                    <td>{s.strategy}</td>
                    <td>{s.total_orders}</td>
                    <td className={s.total_profit >= 0 ? styles.positive : styles.negative}>
                      {s.total_profit.toFixed(2)}
                    </td>
                    <td className={s.avg_profit_percent >= 0 ? styles.positive : styles.negative}>
                      {s.avg_profit_percent.toFixed(2)}%
                    </td>
                    <td className={s.winrate >= 50 ? styles.positive : styles.negative}>
                      {s.winrate.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Статистика по ботам */}
      <div className={styles.section}>
        <h2>🤖 По ботам</h2>
        <div className={styles.table}>
          <table>
            <thead>
              <tr>
                <th onClick={() => handleSort('server', 'server_name')} style={{ cursor: 'pointer' }}>
                  Бот {sortConfig.table === 'server' && sortConfig.key === 'server_name' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('server', 'total_orders')} style={{ cursor: 'pointer' }}>
                  Сделок {sortConfig.table === 'server' && sortConfig.key === 'total_orders' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('server', 'open_orders')} style={{ cursor: 'pointer' }}>
                  Открытых {sortConfig.table === 'server' && sortConfig.key === 'open_orders' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('server', 'total_profit')} style={{ cursor: 'pointer' }}>
                  Прибыль USDT {sortConfig.table === 'server' && sortConfig.key === 'total_profit' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('server', 'winrate')} style={{ cursor: 'pointer' }}>
                  Винрейт {sortConfig.table === 'server' && sortConfig.key === 'winrate' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortTableData(by_server, 'server').map((s, idx) => {
                const rank = getRowRank(by_server, idx, 'total_profit');
                const rowClass = rank === 'top' ? styles.topRow : rank === 'worst' ? styles.worstRow : '';
                
                return (
                  <tr 
                    key={idx}
                    className={`${rowClass} ${styles.clickableRow}`}
                    onClick={() => openModal(s, 'server')}
                    title="Кликните для подробной информации"
                  >
                    <td>{s.server_name}</td>
                    <td>{s.total_orders}</td>
                    <td>{s.open_orders}</td>
                    <td className={s.total_profit >= 0 ? styles.positive : styles.negative}>
                      {s.total_profit.toFixed(2)}
                    </td>
                    <td className={s.winrate >= 50 ? styles.positive : styles.negative}>
                      {s.winrate.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Статистика по монетам */}
      <div className={styles.section}>
        <h2>💰 По монетам</h2>
        <div className={styles.table}>
          <table>
            <thead>
              <tr>
                <th onClick={() => handleSort('symbol', 'symbol')} style={{ cursor: 'pointer' }}>
                  Монета {sortConfig.table === 'symbol' && sortConfig.key === 'symbol' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('symbol', 'total_orders')} style={{ cursor: 'pointer' }}>
                  Сделок {sortConfig.table === 'symbol' && sortConfig.key === 'total_orders' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('symbol', 'total_profit')} style={{ cursor: 'pointer' }}>
                  Прибыль USDT {sortConfig.table === 'symbol' && sortConfig.key === 'total_profit' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('symbol', 'avg_profit_percent')} style={{ cursor: 'pointer' }}>
                  Средний % {sortConfig.table === 'symbol' && sortConfig.key === 'avg_profit_percent' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('symbol', 'winrate')} style={{ cursor: 'pointer' }}>
                  Винрейт {sortConfig.table === 'symbol' && sortConfig.key === 'winrate' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortTableData(by_symbol, 'symbol').map((s, idx) => {
                const rank = getRowRank(by_symbol, idx, 'total_profit');
                const rowClass = rank === 'top' ? styles.topRow : rank === 'worst' ? styles.worstRow : '';
                
                return (
                  <tr 
                    key={idx}
                    className={`${rowClass} ${styles.clickableRow}`}
                    onClick={() => openModal(s, 'symbol')}
                    title="Кликните для подробной информации"
                  >
                    <td>{s.symbol}</td>
                    <td>{s.total_orders}</td>
                    <td className={s.total_profit >= 0 ? styles.positive : styles.negative}>
                      {s.total_profit.toFixed(2)}
                    </td>
                    <td className={s.avg_profit_percent >= 0 ? styles.positive : styles.negative}>
                      {s.avg_profit_percent.toFixed(2)}%
                    </td>
                    <td className={s.winrate >= 50 ? styles.positive : styles.negative}>
                      {s.winrate.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Топ сделок */}
      <div className={styles.topDeals}>
        <div className={styles.section}>
          <h2>🏆 Топ прибыльных</h2>
          <div className={styles.table}>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Монета</th>
                  <th>Стратегия</th>
                  <th>Прибыль</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {top_profitable.map((deal, idx) => (
                  <tr key={idx}>
                    <td>#{deal.id}</td>
                    <td>{deal.symbol || '-'}</td>
                    <td>{deal.strategy || '-'}</td>
                    <td className={styles.positive}>{deal.profit.toFixed(2)} USDT</td>
                    <td className={styles.positive}>{deal.profit_percent.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className={styles.section}>
          <h2>💔 Топ убыточных</h2>
          <div className={styles.table}>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Монета</th>
                  <th>Стратегия</th>
                  <th>Прибыль</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {top_losing.map((deal, idx) => (
                  <tr key={idx}>
                    <td>#{deal.id}</td>
                    <td>{deal.symbol || '-'}</td>
                    <td>{deal.strategy || '-'}</td>
                    <td className={styles.negative}>{deal.profit.toFixed(2)} USDT</td>
                    <td className={styles.negative}>{deal.profit_percent.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Модальное окно с деталями */}
      {modalOpen && modalData && (
        <div className={styles.modalOverlay} onClick={() => setModalOpen(false)}>
          <div className={styles.modalContentLarge} onClick={(e) => e.stopPropagation()}>
            <button className={styles.modalClose} onClick={() => setModalOpen(false)}>✕</button>
            
            <h2 className={styles.modalTitle}>
              {modalType === 'strategy' && `📊 Стратегия: ${modalData.strategy}`}
              {modalType === 'server' && `🤖 Бот: ${modalData.server_name}`}
              {modalType === 'symbol' && `💰 Монета: ${modalData.symbol}`}
            </h2>
            
            <div className={styles.modalStats}>
              <div className={styles.modalStatCard}>
                <div className={styles.modalStatLabel}>Всего сделок</div>
                <div className={styles.modalStatValue}>{modalData.total_orders}</div>
              </div>
              
              <div className={styles.modalStatCard}>
                <div className={styles.modalStatLabel}>Прибыль</div>
                <div className={`${styles.modalStatValue} ${modalData.total_profit >= 0 ? styles.positive : styles.negative}`}>
                  {modalData.total_profit.toFixed(2)} USDT
                </div>
              </div>
              
              {modalData.avg_profit_percent !== undefined && (
                <div className={styles.modalStatCard}>
                  <div className={styles.modalStatLabel}>Средний %</div>
                  <div className={`${styles.modalStatValue} ${modalData.avg_profit_percent >= 0 ? styles.positive : styles.negative}`}>
                    {modalData.avg_profit_percent.toFixed(2)}%
                  </div>
                </div>
              )}
              
              <div className={styles.modalStatCard}>
                <div className={styles.modalStatLabel}>Винрейт</div>
                <div className={`${styles.modalStatValue} ${modalData.winrate >= 50 ? styles.positive : styles.negative}`}>
                  {modalData.winrate.toFixed(1)}%
                </div>
              </div>
            </div>
            
            {/* Детальная информация */}
            {modalDetailsLoading && (
              <div className={styles.modalLoading}>⏳ Загрузка детальной информации...</div>
            )}
            
            {modalDetails && (
              <>
                {/* График прибыли */}
                {modalDetails.profit_timeline && modalDetails.profit_timeline.length > 0 && (
                  <div className={styles.modalSection}>
                    <h3>📈 График прибыли</h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={modalDetails.profit_timeline}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                        <XAxis dataKey="date" stroke="#00ff88" tick={{ fill: '#aaa', fontSize: 11 }} />
                        <YAxis stroke="#00ff88" tick={{ fill: '#aaa', fontSize: 11 }} />
                        <Tooltip 
                          contentStyle={{ 
                            background: 'rgba(20, 20, 20, 0.95)', 
                            border: '1px solid #00ff88',
                            borderRadius: '8px'
                          }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="cumulative_profit" 
                          stroke="#00ff88" 
                          strokeWidth={2}
                          name="Накопительная"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
                
                {/* Распределение по символам */}
                {modalDetails.symbol_distribution && modalDetails.symbol_distribution.length > 0 && (
                  <div className={styles.modalSection}>
                    <h3>🎯 Распределение по монетам</h3>
                    <div className={styles.modalTable}>
                      <table>
                        <thead>
                          <tr>
                            <th>Символ</th>
                            <th>Сделок</th>
                            <th>Прибыль</th>
                          </tr>
                        </thead>
                        <tbody>
                          {modalDetails.symbol_distribution.slice(0, 10).map((item, idx) => (
                            <tr key={idx}>
                              <td>{item.symbol}</td>
                              <td>{item.count}</td>
                              <td className={item.profit >= 0 ? styles.positive : styles.negative}>
                                {item.profit.toFixed(2)} USDT
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                
                {/* Список последних сделок */}
                {modalDetails.recent_orders && modalDetails.recent_orders.length > 0 && (
                  <div className={styles.modalSection}>
                    <h3>📋 Последние сделки</h3>
                    <div className={styles.modalTable}>
                      <table>
                        <thead>
                          <tr>
                            <th>ID</th>
                            <th>Символ</th>
                            <th>Тип</th>
                            <th>Закрыто</th>
                            <th>Прибыль</th>
                            <th>%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {modalDetails.recent_orders.map((order, idx) => (
                            <tr key={idx}>
                              <td>#{order.id}</td>
                              <td>{order.symbol || '-'}</td>
                              <td>
                                {order.is_emulator ? (
                                  <span className={styles.emulatorBadge}>🎮</span>
                                ) : (
                                  <span className={styles.realBadge}>💰</span>
                                )}
                              </td>
                              <td style={{ fontSize: '0.85rem' }}>
                                {order.closed_at ? new Date(order.closed_at).toLocaleString('ru-RU', { 
                                  day: '2-digit', 
                                  month: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                }) : '-'}
                              </td>
                              <td className={order.profit >= 0 ? styles.positive : styles.negative}>
                                {order.profit.toFixed(2)} USDT
                              </td>
                              <td className={order.profit_percent >= 0 ? styles.positive : styles.negative}>
                                {order.profit_percent.toFixed(2)}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
            
            <div className={styles.modalNote}>
              💡 <strong>Совет:</strong> {modalData.winrate >= 70 ? 'Отличная производительность!' : modalData.winrate >= 50 ? 'Стабильная стратегия' : 'Требует оптимизации'}
            </div>
            
            <div className={styles.modalFooter}>
              <button onClick={() => setModalOpen(false)} className={styles.modalBtn}>
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradingStats;

