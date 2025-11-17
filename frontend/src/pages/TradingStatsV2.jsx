import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { FaChartLine, FaArrowUp, FaArrowDown, FaMinus, FaFire, FaExclamationTriangle, FaBolt, FaTrophy } from 'react-icons/fa';
import styles from './TradingStats.module.css';
import { getApiBaseUrl } from '../utils/apiUrl';

const API_BASE_URL = getApiBaseUrl();

const TradingStats = ({ autoRefresh, setAutoRefresh, emulatorFilter, setEmulatorFilter }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Фильтры
  const [selectedServers, setSelectedServers] = useState([]);
  const [selectedStrategies, setSelectedStrategies] = useState([]);
  const [availableServers, setAvailableServers] = useState([]);
  const [availableStrategies, setAvailableStrategies] = useState([]);
  const [timePeriod, setTimePeriod] = useState('all'); // 'today', 'week', 'month', 'all'
  
  // Dropdown states
  const [serverDropdownOpen, setServerDropdownOpen] = useState(false);
  const [strategyDropdownOpen, setStrategyDropdownOpen] = useState(false);
  const [emulatorDropdownOpen, setEmulatorDropdownOpen] = useState(false);
  const [timeDropdownOpen, setTimeDropdownOpen] = useState(false);
  
  // Сортировка таблиц
  const [sortConfig, setSortConfig] = useState({ table: null, key: null, direction: 'desc' });

  // Auto-refresh
  useEffect(() => {
    let interval;
    if (autoRefresh) {
      interval = setInterval(loadStats, 30000); // каждые 30 сек
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, selectedServers, selectedStrategies, emulatorFilter, timePeriod]);

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
        params.append('server_ids', 'all');
      } else {
        params.append('server_ids', selectedServers.join(','));
      }
      
      // Стратегии
      if (selectedStrategies.length === 0 || selectedStrategies.includes('all')) {
        params.append('strategies', 'all');
      } else {
        params.append('strategies', selectedStrategies.join(','));
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

  // Начальная загрузка
  useEffect(() => {
    loadStats();
  }, [loadStats]);

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
      'month': '📅 За месяц'
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

  // Горячие индикаторы
  const hotStrategy = by_strategy.length > 0 ? by_strategy[0] : null;
  const problemSymbol = by_symbol.filter(s => s.total_profit < 0).slice().sort((a, b) => a.total_profit - b.total_profit)[0];
  const mostActiveServer = by_server.slice().sort((a, b) => b.total_orders - a.total_orders)[0];

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
        </div>
      )}

      {/* Основные метрики */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>📊 Всего сделок</div>
          <div className={styles.statValue}>{overall.total_orders || 0}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>🟢 Открытых</div>
          <div className={styles.statValue}>{overall.open_orders || 0}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>🔴 Закрытых</div>
          <div className={styles.statValue}>{overall.closed_orders || 0}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>💰 Общая прибыль</div>
          <div className={`${styles.statValue} ${(overall.total_profit || 0) >= 0 ? styles.positive : styles.negative}`}>
            {(overall.total_profit || 0).toFixed(2)} USDT
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>📈 Средняя прибыль</div>
          <div className={`${styles.statValue} ${(overall.avg_profit || 0) >= 0 ? styles.positive : styles.negative}`}>
            {(overall.avg_profit || 0).toFixed(2)} USDT
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>✅ Прибыльных</div>
          <div className={`${styles.statValue} ${styles.positive}`}>{overall.profitable_count || 0}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>❌ Убыточных</div>
          <div className={`${styles.statValue} ${styles.negative}`}>{overall.losing_count || 0}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>🎯 Винрейт</div>
          <div className={`${styles.statValue} ${(overall.winrate || 0) >= 50 ? styles.positive : styles.negative}`}>
            {(overall.winrate || 0).toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Расширенные метрики */}
      <div className={styles.section}>
        <h2>📊 Расширенные метрики</h2>
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>⚖️ Profit Factor</div>
            <div className={`${styles.statValue} ${(overall.profit_factor || 0) > 1 ? styles.positive : styles.negative}`}>
              {(overall.profit_factor || 0).toFixed(2)}
            </div>
            <div className={styles.statSubtext}>
              {(overall.profit_factor || 0) > 1 ? 'Отлично' : 'Требует внимания'}
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>📉 Max Drawdown</div>
            <div className={`${styles.statValue} ${styles.negative}`}>
              {(overall.max_drawdown || 0).toFixed(2)} USDT
            </div>
            <div className={styles.statSubtext}>Макс. просадка</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>⏱️ Средняя длительность</div>
            <div className={styles.statValue}>
              {(overall.avg_duration_hours || 0).toFixed(1)}ч
            </div>
            <div className={styles.statSubtext}>На сделку</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>💎 ROI</div>
            <div className={`${styles.statValue} ${(overall.roi || 0) >= 0 ? styles.positive : styles.negative}`}>
              {(overall.roi || 0).toFixed(1)}%
            </div>
            <div className={styles.statSubtext}>Возврат инвестиций</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>🔥 Макс. серия побед</div>
            <div className={`${styles.statValue} ${styles.positive}`}>
              {overall.max_win_streak || 0}
            </div>
            <div className={styles.statSubtext}>Подряд</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>❄️ Макс. серия поражений</div>
            <div className={`${styles.statValue} ${styles.negative}`}>
              {overall.max_loss_streak || 0}
            </div>
            <div className={styles.statSubtext}>Подряд</div>
          </div>
        </div>
      </div>

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
              {sortTableData(by_strategy, 'strategy').map((s, idx) => (
                <tr key={idx}>
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
              ))}
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
              {sortTableData(by_server, 'server').map((s, idx) => (
                <tr key={idx}>
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
              ))}
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
              {sortTableData(by_symbol, 'symbol').map((s, idx) => (
                <tr key={idx}>
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
              ))}
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
    </div>
  );
};

export default TradingStats;


