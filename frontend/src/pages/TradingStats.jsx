import React, { useState, useEffect, useRef, useCallback } from 'react';
import ProfitChart from '../components/ProfitChart';
import styles from './TradingStats.module.css';
import { getApiBaseUrl } from '../utils/apiUrl';

// Fixed: защита от undefined данных в API response
const TradingStats = ({ autoRefresh, setAutoRefresh }) => {
  const API_BASE_URL = getApiBaseUrl();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Фильтры
  const [selectedServers, setSelectedServers] = useState([]);
  const [selectedStrategies, setSelectedStrategies] = useState([]);
  const [availableServers, setAvailableServers] = useState([]);
  const [availableStrategies, setAvailableStrategies] = useState([]);
  
  // Dropdown states
  const [serverDropdownOpen, setServerDropdownOpen] = useState(false);
  const [strategyDropdownOpen, setStrategyDropdownOpen] = useState(false);
  
  // Auto-refresh (управляется родителем Trading.jsx)
  const intervalRef = useRef(null);

  // Загрузка данных
  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // Формируем параметры запроса
      const params = new URLSearchParams();
      
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
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('Ошибка загрузки статистики');
      
      const data = await response.json();
      
      // [DEBUG] SUPER DETAILED LOGGING FOR DEBUGGING
      console.log('[TradingStats] [DEBUG] API Response received:', {
        hasData: !!data,
        keys: Object.keys(data || {}),
        by_strategy_type: typeof data?.by_strategy,
        by_strategy_isArray: Array.isArray(data?.by_strategy),
        by_strategy_value: data?.by_strategy,
        by_server_type: typeof data?.by_server,
        by_server_isArray: Array.isArray(data?.by_server),
        by_server_value: data?.by_server,
        available_servers_type: typeof data?.available_servers,
        available_servers_isArray: Array.isArray(data?.available_servers),
        available_strategies_type: typeof data?.available_strategies,
        available_strategies_isArray: Array.isArray(data?.available_strategies)
      });
      
      setStats(data);
      
      // Обновляем списки доступных серверов и стратегий с проверкой на массив
      if (data.available_servers && Array.isArray(data.available_servers)) {
        setAvailableServers(data.available_servers);
      } else {
        console.warn('[TradingStats] [WARN] available_servers is NOT an array!', {
          type: typeof data?.available_servers,
          value: data?.available_servers
        });
      }
      if (data.available_strategies && Array.isArray(data.available_strategies)) {
        setAvailableStrategies(data.available_strategies);
      } else {
        console.warn('[TradingStats] [WARN] available_strategies is NOT an array!', {
          type: typeof data?.available_strategies,
          value: data?.available_strategies
        });
      }
      
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Error loading stats:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedServers, selectedStrategies]);

  // Начальная загрузка
  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Автообновление с использованием ref для предотвращения лишних пересозданий
  useEffect(() => {
    // Очищаем предыдущий интервал
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Создаем новый интервал если автообновление включено
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        loadStats();
      }, 30000); // каждые 30 секунд
    }

    // Cleanup при размонтировании
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [autoRefresh, loadStats]);

  // Обработчики фильтров
  const handleServerChange = (serverId) => {
    if (serverId === 'all') {
      setSelectedServers(['all']);
    } else {
      const newSelection = selectedServers.includes(serverId)
        ? selectedServers.filter(id => id !== serverId)
        : [...selectedServers.filter(id => id !== 'all'), serverId];
      
      setSelectedServers(newSelection.length === 0 ? ['all'] : newSelection);
    }
  };

  const handleStrategyChange = (strategy) => {
    if (strategy === 'all') {
      setSelectedStrategies(['all']);
    } else {
      const newSelection = selectedStrategies.includes(strategy)
        ? selectedStrategies.filter(s => s !== strategy)
        : [...selectedStrategies.filter(s => s !== 'all'), strategy];
      
      setSelectedStrategies(newSelection.length === 0 ? ['all'] : newSelection);
    }
  };

  // Закрытие dropdown при клике вне
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.dropdown-container')) {
        setServerDropdownOpen(false);
        setStrategyDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Получить текст для кнопки dropdown
  const getServerButtonText = () => {
    if (selectedServers.length === 0 || selectedServers.includes('all')) {
      return '🤖 Все боты';
    }
    if (selectedServers.length === 1) {
      // PROTECTION: check that availableServers is an array!
      if (!Array.isArray(availableServers)) {
        console.error('[TradingStats] [ERROR] availableServers is NOT an array in getServerButtonText!', typeof availableServers);
        return '🤖 Выберите боты';
      }
      const server = availableServers.find(s => s.id === selectedServers[0]);
      return server ? `🤖 ${server.name}` : '🤖 Выберите боты';
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

  if (loading && !stats) {
    return <div className={styles.loading}>Загрузка статистики...</div>;
  }

  if (error) {
    return <div className={styles.error}>Ошибка: {error}</div>;
  }

  if (!stats) {
    return null;
  }

  // [DEBUG] CRITICAL LOGGING BEFORE DESTRUCTURING
  console.log('[TradingStats] [DEBUG] BEFORE destructuring:', {
    hasStats: !!stats,
    statsKeys: Object.keys(stats || {}),
    stats_by_strategy: stats?.by_strategy,
    stats_by_server: stats?.by_server,
    availableServers_type: typeof availableServers,
    availableServers_isArray: Array.isArray(availableServers),
    availableServers_value: availableServers,
    availableStrategies_type: typeof availableStrategies,
    availableStrategies_isArray: Array.isArray(availableStrategies),
    availableStrategies_value: availableStrategies
  });

  // Безопасная деструктуризация с значениями по умолчанию
  const { 
    overall = {}, 
    by_strategy: rawByStrategy = [], 
    by_server: rawByServer = [], 
    by_symbol: rawBySymbol = [], 
    top_profitable: rawTopProfitable = [], 
    top_losing: rawTopLosing = [] 
  } = stats || {};

  const by_strategy = Array.isArray(rawByStrategy)
    ? rawByStrategy
    : Object.values(rawByStrategy || {});
  const by_server = Array.isArray(rawByServer)
    ? rawByServer
    : Object.values(rawByServer || {});
  const by_symbol = Array.isArray(rawBySymbol)
    ? rawBySymbol
    : Object.values(rawBySymbol || {});
  const top_profitable = Array.isArray(rawTopProfitable)
    ? rawTopProfitable
    : Object.values(rawTopProfitable || {});
  const top_losing = Array.isArray(rawTopLosing)
    ? rawTopLosing
    : Object.values(rawTopLosing || {});

  // [DEBUG] SUPER DETAILED LOGGING AFTER NORMALIZATION
  console.log('[TradingStats] [DEBUG] After normalization:', {
    by_strategy: {
      isArray: Array.isArray(by_strategy),
      length: by_strategy?.length,
      value: by_strategy
    },
    by_server: {
      isArray: Array.isArray(by_server),
      length: by_server?.length,
      value: by_server
    },
    by_symbol: {
      isArray: Array.isArray(by_symbol),
      length: by_symbol?.length,
      value: by_symbol
    },
    top_profitable: {
      isArray: Array.isArray(top_profitable),
      length: top_profitable?.length,
      value: top_profitable
    },
    top_losing: {
      isArray: Array.isArray(top_losing),
      length: top_losing?.length,
      value: top_losing
    }
  });

  console.log('[TradingStats] Debug types', {
    by_strategy_isArray: Array.isArray(by_strategy),
    by_server_isArray: Array.isArray(by_server),
    by_symbol_isArray: Array.isArray(by_symbol),
    top_profitable_isArray: Array.isArray(top_profitable),
    top_losing_isArray: Array.isArray(top_losing)
  });

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>📊 Статистика торговли</h1>
        <div className={styles.controls}>
          <button onClick={loadStats} className={styles.refreshBtn}>
            🔄 Обновить
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
        <div className={`${styles.dropdown} dropdown-container`}>
          <button 
            className={styles.dropdownButton}
            onClick={() => {
              setServerDropdownOpen(!serverDropdownOpen);
              setStrategyDropdownOpen(false);
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
                  onChange={() => handleServerChange('all')}
                />
                <span>Все боты</span>
              </label>
              <div className={styles.dropdownDivider}></div>
              {availableServers.map(server => (
                <label key={server.id} className={styles.dropdownItem}>
                  <input
                    type="checkbox"
                    checked={selectedServers.includes(server.id)}
                    onChange={() => handleServerChange(server.id)}
                  />
                  <span>{server.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className={`${styles.dropdown} dropdown-container`}>
          <button 
            className={styles.dropdownButton}
            onClick={() => {
              setStrategyDropdownOpen(!strategyDropdownOpen);
              setServerDropdownOpen(false);
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
                  onChange={() => handleStrategyChange('all')}
                />
                <span>Все стратегии</span>
              </label>
              <div className={styles.dropdownDivider}></div>
              {availableStrategies.map(strategy => (
                <label key={strategy} className={styles.dropdownItem}>
                  <input
                    type="checkbox"
                    checked={selectedStrategies.includes(strategy)}
                    onChange={() => handleStrategyChange(strategy)}
                  />
                  <span>{strategy}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* График прибыли - для всех серверов или конкретного */}
      {(selectedServers.length === 0 || selectedServers.includes('all') || selectedServers.length === 1) && (
        <ProfitChart 
          serverId={
            selectedServers.length === 0 || selectedServers.includes('all') 
              ? 'all' 
              : selectedServers[0]
          } 
        />
      )}

      {/* Общая статистика */}
      <div className={styles.overallStats}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Всего сделок</div>
          <div className={styles.statValue}>{overall.total_orders}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Открытых</div>
          <div className={styles.statValue}>{overall.open_orders}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Закрытых</div>
          <div className={styles.statValue}>{overall.closed_orders}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Общая прибыль</div>
          <div className={`${styles.statValue} ${overall.total_profit >= 0 ? styles.positive : styles.negative}`}>
            {overall.total_profit.toFixed(2)} USDT
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Средняя прибыль</div>
          <div className={`${styles.statValue} ${overall.avg_profit >= 0 ? styles.positive : styles.negative}`}>
            {overall.avg_profit.toFixed(2)} USDT
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Прибыльных</div>
          <div className={`${styles.statValue} ${styles.positive}`}>{overall.profitable_count}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Убыточных</div>
          <div className={`${styles.statValue} ${styles.negative}`}>{overall.losing_count}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Винрейт</div>
          <div className={`${styles.statValue} ${overall.winrate >= 50 ? styles.positive : styles.negative}`}>
            {overall.winrate.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Статистика по стратегиям */}
      <div className={styles.section}>
        <h2>📈 По стратегиям</h2>
        <div className={styles.table}>
          <table>
            <thead>
              <tr>
                <th>Стратегия</th>
                <th>Сделок</th>
                <th>Прибыль USDT</th>
                <th>Средний %</th>
              </tr>
            </thead>
            <tbody>
              {by_strategy.map((s, idx) => (
                <tr key={idx}>
                  <td>{s.strategy}</td>
                  <td>{s.total_orders}</td>
                  <td className={s.total_profit >= 0 ? styles.positive : styles.negative}>
                    {s.total_profit.toFixed(2)}
                  </td>
                  <td className={s.avg_profit_percent >= 0 ? styles.positive : styles.negative}>
                    {s.avg_profit_percent.toFixed(2)}%
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
                <th>Бот</th>
                <th>Сделок</th>
                <th>Открытых</th>
                <th>Прибыль USDT</th>
              </tr>
            </thead>
            <tbody>
              {by_server.map((s, idx) => (
                <tr key={idx}>
                  <td>{s.server_name}</td>
                  <td>{s.total_orders}</td>
                  <td>{s.open_orders}</td>
                  <td className={s.total_profit >= 0 ? styles.positive : styles.negative}>
                    {s.total_profit.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Статистика по символам */}
      <div className={styles.section}>
        <h2>💰 По монетам</h2>
        <div className={styles.table}>
          <table>
            <thead>
              <tr>
                <th>Монета</th>
                <th>Сделок</th>
                <th>Прибыль USDT</th>
                <th>Средний %</th>
              </tr>
            </thead>
            <tbody>
              {by_symbol.map((s, idx) => (
                <tr key={idx}>
                  <td>{s.symbol}</td>
                  <td>{s.total_orders}</td>
                  <td className={s.total_profit >= 0 ? styles.positive : styles.negative}>
                    {s.total_profit.toFixed(2)}
                  </td>
                  <td className={s.avg_profit_percent >= 0 ? styles.positive : styles.negative}>
                    {s.avg_profit_percent.toFixed(2)}%
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

// Fixed: защита от undefined/объектов вместо массивов [v2.0]
console.log('[TradingStats] Component mounted - Fixed version 2.0');

export default TradingStats;
