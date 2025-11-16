import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { FaChartLine, FaSync, FaFilter, FaCheckCircle, FaTimesCircle, FaCoins } from 'react-icons/fa';
import styles from './Orders.module.css';
import { getApiBaseUrl } from '../utils/apiUrl';
import { ordersAPI } from '../api/api';
import wsService from '../services/websocket';

const Orders = ({ autoRefresh, setAutoRefresh, emulatorFilter, setEmulatorFilter }) => {
  const API_BASE_URL = getApiBaseUrl();
  const [servers, setServers] = useState([]);
  const [selectedServer, setSelectedServer] = useState('all'); // По умолчанию "Все сервера"
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(30);
  const [statusFilter, setStatusFilter] = useState('');
  const [symbolFilter, setSymbolFilter] = useState('');
  // emulatorFilter теперь приходит из пропсов Trading.jsx
  // ИСПРАВЛЕНО: Добавлено недостающее состояние error
  const [error, setError] = useState(null);
  const autoRefreshRef = useRef(null);
  
  // Сортировка
  const [sortBy, setSortBy] = useState('openedAt'); // Поле для сортировки
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' или 'desc'
  
  // Управление видимостью колонок
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('orders_visible_columns');
    return saved ? JSON.parse(saved) : {
      id: true,              // Закреплена и всегда видна
      type: true,            // Всегда видна по умолчанию
      status: true,          // Всегда видна по умолчанию
      symbol: true,          // Всегда видна по умолчанию
      buyPrice: true,        // Включена по умолчанию
      sellPrice: true,       // Включена по умолчанию
      quantity: true,        // Включена по умолчанию
      profitUSDT: true,      // Включена по умолчанию
      profitPercent: true,   // Включена по умолчанию
      delta1h: true,         // Включена по умолчанию
      delta24h: true,        // Включена по умолчанию
      strategy: true,        // Включена по умолчанию (Стратегия / Task ID)
      openedAt: true,        // Включена по умолчанию
      closedAt: true,        // Включена по умолчанию
    };
  });

  // Восстановление настроек из localStorage при загрузке
  useEffect(() => {
    const savedServer = localStorage.getItem('orders_selectedServer');
    
    if (savedServer) {
      setSelectedServer(savedServer);
    }
    // autoRefresh больше не восстанавливаем здесь - он приходит из пропсов
  }, []);
  
  // Сохранение видимости колонок в localStorage
  useEffect(() => {
    localStorage.setItem('orders_visible_columns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);
  
  // Закрытие выпадающего меню при клике вне его
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showColumnSettings && !event.target.closest(`.${styles.columnSettingsWrapper}`)) {
        setShowColumnSettings(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showColumnSettings]);

  useEffect(() => {
    fetchServers();
  }, []);

  // Перезагрузка данных при возврате на вкладку
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && selectedServer) {
        // Вкладка стала активной - обновляем данные
        fetchOrders(selectedServer, page, statusFilter, symbolFilter, emulatorFilter);
        fetchStats(selectedServer);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [selectedServer, page, statusFilter, symbolFilter, emulatorFilter, servers]);

  // WebSocket подключение (всегда активно для real-time обновлений)
  useEffect(() => {
    if (!selectedServer || servers.length === 0) {
      return;
    }

    // Подключаемся к WebSocket
    wsService.connect();

    // Подписываемся на события обновления ордеров
    const unsubscribe = wsService.on('order_update', (data) => {
      console.log('[Orders] WebSocket event received:', data);
      
      // Проверяем соответствует ли server_id выбранному серверу
      if (selectedServer === 'all' || Number(selectedServer) === data.server_id) {
        console.log('[Orders] Refreshing orders due to WebSocket event');
        // Обновляем ордера и статистику
        fetchOrders(selectedServer, page, statusFilter, symbolFilter, emulatorFilter);
        fetchStats(selectedServer);
      }
    });

    // Cleanup
    return () => {
      unsubscribe();
    };
  }, [selectedServer, page, statusFilter, symbolFilter, emulatorFilter, servers.length]);

  // Автообновление: Fallback polling если WebSocket не работает
  useEffect(() => {
    // Очищаем предыдущий интервал
    if (autoRefreshRef.current) {
      clearInterval(autoRefreshRef.current);
      autoRefreshRef.current = null;
    }

    if (!autoRefresh || !selectedServer || servers.length === 0) {
      return;
    }

    // Fallback: Polling каждые 30 секунд если WebSocket не подключен
    const checkInterval = setInterval(() => {
      if (!wsService.isConnected()) {
        console.log('[Orders] WebSocket not connected, using polling fallback');
        fetchOrders(selectedServer, page, statusFilter, symbolFilter, emulatorFilter);
        fetchStats(selectedServer);
      }
    }, 30000);

    // Cleanup
    return () => {
      if (checkInterval) {
        clearInterval(checkInterval);
      }
    };
  }, [autoRefresh, selectedServer, page, statusFilter, symbolFilter, emulatorFilter, servers.length]);

  const fetchServers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/servers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // ЗАЩИТА: нормализуем к массиву если пришёл объект
      const serversData = Array.isArray(response.data) 
        ? response.data 
        : Object.values(response.data || {});
      
      console.log('[Orders] [DEBUG] Servers loaded:', {
        type: typeof response.data,
        isArray: Array.isArray(response.data),
        normalizedIsArray: Array.isArray(serversData),
        count: serversData.length
      });
      
      setServers(serversData);
      
      // Если есть сохраненный выбор, используем его, иначе загружаем данные для "all"
      const savedServer = localStorage.getItem('orders_selectedServer') || 'all';
      if (serversData.length > 0) {
        console.log('[Orders] Initial load for server:', savedServer);
        // Передаем serversData напрямую, так как setServers обновляет state асинхронно
        fetchOrdersWithServers(savedServer, serversData);
        fetchStatsWithServers(savedServer, serversData);
      }
    } catch (error) {
      console.error('Error fetching servers:', error);
    }
  };

  const fetchOrders = async (serverId, pageNum = 1, status = '', symbol = '', emulator = 'all') => {
    // Используем текущий state servers
    return fetchOrdersWithServers(serverId, servers, pageNum, status, symbol, emulator);
  };

  const fetchOrdersWithServers = async (serverId, serversArray, pageNum = 1, status = '', symbol = '', emulator = 'all') => {
    if (!serverId) return;
    
    console.log('[Orders] fetchOrdersWithServers called:', { serverId, serversCount: serversArray.length, pageNum, status, symbol });
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const offset = (pageNum - 1) * limit;
      
      if (serverId === 'all') {
        // Загрузка ордеров со всех серверов
        let allOrders = [];
        let totalCount = 0;
        const MAX_ORDERS_PER_SERVER = 100;
        
        for (const server of serversArray) {
          try {
            let url = `${API_BASE_URL}/api/servers/${server.id}/orders?limit=${MAX_ORDERS_PER_SERVER}&offset=0`;
            if (status) url += `&status=${status}`;
            if (symbol) url += `&symbol=${symbol}`;
            if (emulator !== 'all') {
              url += `&emulator=${emulator === 'emulator' ? 'true' : 'false'}`;
            }
            
            const response = await axios.get(url, {
              headers: { Authorization: `Bearer ${token}` }
            });
            
            allOrders = [...allOrders, ...response.data.orders];
            totalCount += response.data.total;
          } catch (err) {
            console.error(`Error fetching orders from server ${server.id}:`, err);
          }
        }
        
        // Сортировка по дате (новые сверху)
        allOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        // Пагинация на клиенте
        const paginatedOrders = allOrders.slice(offset, offset + limit);
        
        setOrders(paginatedOrders);
        setTotal(allOrders.length);
        setPage(pageNum);
      } else {
        // Загрузка ордеров с конкретного сервера
        let url = `${API_BASE_URL}/api/servers/${serverId}/orders?limit=${limit}&offset=${offset}`;
        if (status) url += `&status=${status}`;
        if (symbol) url += `&symbol=${symbol}`;
        if (emulator !== 'all') {
          url += `&emulator=${emulator === 'emulator' ? 'true' : 'false'}`;
        }
        
        const response = await axios.get(url, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        setOrders(response.data.orders);
        setTotal(response.data.total);
        setPage(pageNum);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async (serverId) => {
    // Используем текущий state servers
    return fetchStatsWithServers(serverId, servers);
  };

  const fetchStatsWithServers = async (serverId, serversArray) => {
    if (!serverId) return;
    
    try {
      const token = localStorage.getItem('token');
      
      if (serverId === 'all') {
        // Агрегация статистики со всех серверов
        let totalOrders = 0;
        let openOrders = 0;
        let closedOrders = 0;
        let totalProfit = 0;
        
        for (const server of serversArray) {
          try {
            const response = await axios.get(
              `${API_BASE_URL}/api/servers/${server.id}/orders/stats`,
              { headers: { Authorization: `Bearer ${token}` }}
            );
            const data = response.data;
            totalOrders += data.total_orders || 0;
            openOrders += data.open_orders || 0;
            closedOrders += data.closed_orders || 0;
            totalProfit += data.total_profit_btc || 0;
          } catch (err) {
            console.error(`Error fetching stats from server ${server.id}:`, err);
          }
        }
        
        setStats({
          total_orders: totalOrders,
          open_orders: openOrders,
          closed_orders: closedOrders,
          total_profit_btc: totalProfit
        });
      } else {
        // Статистика с конкретного сервера
        const response = await axios.get(
          `${API_BASE_URL}/api/servers/${serverId}/orders/stats`,
          { headers: { Authorization: `Bearer ${token}` }}
        );
        setStats(response.data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleServerChange = (serverId) => {
    setSelectedServer(serverId);
    localStorage.setItem('orders_selectedServer', serverId); // Сохранение в localStorage
    setPage(1);
    setStatusFilter('');
    setSymbolFilter('');
    // emulatorFilter НЕ сбрасываем - он общий для всех вкладок
    fetchOrders(serverId, 1, '', '', emulatorFilter);
    fetchStats(serverId);
  };

  const handleRefresh = async () => {
    setLoading(true);
    
    // Отправляем команду lst через listener для получения свежих данных
    if (selectedServer && selectedServer !== 'all') {
      try {
        const token = localStorage.getItem('token');
        console.log(`Sending lst command to server ${selectedServer}...`);
        
        const response = await axios.post(
          `${API_BASE_URL}/api/servers/${selectedServer}/listener/send-command`,
          null,
          {
            params: { command: 'lst' },
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        console.log('Command lst sent successfully:', response.data);
        
        // Ждём 3 секунды чтобы listener получил и обработал ответ
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (error) {
        console.error('Error sending lst command:', error);
        setError('Не удалось отправить команду обновления');
      }
    } else if (selectedServer === 'all') {
      // Если выбраны все сервера - отправляем lst на все активные
      try {
        const token = localStorage.getItem('token');
        const serversToUpdate = servers.filter(s => s.is_active);
        
        console.log(`Sending lst to ${serversToUpdate.length} servers...`);
        
        const promises = serversToUpdate.map(server => 
          axios.post(
            `${API_BASE_URL}/api/servers/${server.id}/listener/send-command`,
            null,
            {
              params: { command: 'lst' },
              headers: { Authorization: `Bearer ${token}` }
            }
          ).catch(err => {
            console.error(`Failed to send lst to server ${server.id}:`, err);
            return null;
          })
        );
        
        await Promise.all(promises);
        console.log('Commands sent to all servers');
        
        // Ждём 3 секунды для обработки
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (error) {
        console.error('Error sending commands to all servers:', error);
      }
    }
    
    // Загружаем данные
    fetchOrders(selectedServer, page, statusFilter, symbolFilter, emulatorFilter);
    fetchStats(selectedServer);
  };

  const handleFilterChange = (status, symbol, emulator = null) => {
    setStatusFilter(status);
    setSymbolFilter(symbol);
    if (emulator !== null) {
      setEmulatorFilter(emulator);
    }
    setPage(1);
    const finalEmulator = emulator !== null ? emulator : emulatorFilter;
    fetchOrders(selectedServer, 1, status, symbol, finalEmulator);
  };

  // Обработчик клика на заголовок колонки для сортировки
  const handleSort = (field) => {
    if (sortBy === field) {
      // Если кликнули на ту же колонку, меняем порядок
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // Если кликнули на другую колонку, устанавливаем её и порядок desc
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  // Функция сортировки массива ордеров
  const sortedOrders = [...orders].sort((a, b) => {
    let aVal = a[sortBy];
    let bVal = b[sortBy];
    
    // Обработка null/undefined
    if (aVal === null || aVal === undefined) aVal = '';
    if (bVal === null || bVal === undefined) bVal = '';
    
    // Обработка чисел
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    }
    
    // Обработка дат
    if (sortBy === 'openedAt' || sortBy === 'closedAt') {
      const dateA = aVal ? new Date(aVal).getTime() : 0;
      const dateB = bVal ? new Date(bVal).getTime() : 0;
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    }
    
    // Обработка строк
    const strA = String(aVal).toLowerCase();
    const strB = String(bVal).toLowerCase();
    
    if (sortOrder === 'asc') {
      return strA.localeCompare(strB);
    } else {
      return strB.localeCompare(strA);
    }
  });

  const handleClearOrders = async () => {
    const confirmed = window.confirm(
      selectedServer === 'all'
        ? '⚠️ ВНИМАНИЕ!\n\nВы действительно хотите удалить ВСЕ ордера со ВСЕХ серверов?\n\nЭто действие нельзя отменить!'
        : '⚠️ ВНИМАНИЕ!\n\nВы действительно хотите удалить ВСЕ ордера для этого сервера?\n\nЭто действие нельзя отменить!'
    );

    if (!confirmed) return;

    try {
      // Используем разные endpoints в зависимости от выбора
      if (selectedServer === 'all') {
        const response = await ordersAPI.clearAll();
        alert(`✅ Успешно удалено ${response.data.deleted_count} ордеров со всех серверов`);
      } else {
        const response = await ordersAPI.clearByServer(Number(selectedServer));
        alert(`✅ Успешно удалено ${response.data.deleted_count} ордеров`);
      }
      
      // Перезагружаем данные
      fetchOrders(selectedServer, 1, statusFilter, symbolFilter, emulatorFilter);
      fetchStats(selectedServer);
      setPage(1);
    } catch (error) {
      console.error('Error clearing orders:', error);
      alert('❌ Ошибка при удалении ордеров');
    }
  };

  const handlePageChange = (newPage) => {
    fetchOrders(selectedServer, newPage, statusFilter, symbolFilter, emulatorFilter);
  };

  const handleAutoRefreshToggle = (e) => {
    const newValue = e.target.checked;
    setAutoRefresh(newValue);
    // Сохранение в localStorage теперь происходит в Trading.jsx
  };
  
  const toggleColumnVisibility = (columnKey) => {
    setVisibleColumns(prev => ({
      ...prev,
      [columnKey]: !prev[columnKey]
    }));
  };
  
  const columnDefinitions = [
    { key: 'id', label: 'ID', sticky: true, alwaysVisible: true },
    { key: 'type', label: 'Тип', sticky: false, alwaysVisible: true },
    { key: 'status', label: 'Статус', sticky: false, alwaysVisible: true },
    { key: 'symbol', label: 'Символ', sticky: false, alwaysVisible: true },
    { key: 'buyPrice', label: 'Цена покупки' },
    { key: 'sellPrice', label: 'Цена продажи' },
    { key: 'quantity', label: 'Количество' },
    { key: 'profitUSDT', label: 'Прибыль USDT' },
    { key: 'profitPercent', label: 'Прибыль %' },
    { key: 'delta1h', label: 'Δ 1h %' },
    { key: 'delta24h', label: 'Δ 24h %' },
    { key: 'strategy', label: 'Стратегия / Task ID' },
    { key: 'openedAt', label: 'Открыт' },
    { key: 'closedAt', label: 'Закрыт' },
  ];

  const totalPages = Math.ceil(total / limit);

  const formatBTC = (value) => {
    if (value === null || value === undefined) return '-';
    return value.toFixed(8) + ' BTC';
  };

  const formatPercent = (value) => {
    if (value === null || value === undefined) return '-';
    const formatted = value.toFixed(2);
    const className = value >= 0 ? styles.profitPositive : styles.profitNegative;
    return <span className={className}>{formatted}%</span>;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className={styles.container}>
      {/* ИСПРАВЛЕНО: Добавлено отображение ошибок */}
      {error && (
        <div className={styles.errorBanner}>
          ⚠️ {error}
          <button onClick={() => setError(null)} className={styles.closeError}>×</button>
        </div>
      )}
      
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <FaChartLine className={styles.icon} />
          <h1>MoonBot Orders</h1>
        </div>

        <div className={styles.controls}>
          <div className={styles.serverSelect}>
            <label>Сервер:</label>
            <select 
              value={selectedServer} 
              onChange={(e) => handleServerChange(e.target.value)}
              className={styles.select}
            >
              <option value="all">Все сервера</option>
              {Array.isArray(servers) && servers.map(server => (
                <option key={server.id} value={server.id}>
                  {server.name}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.autoRefreshToggle}>
            <label>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={handleAutoRefreshToggle}
              />
              Авто
            </label>
          </div>

          <button onClick={handleRefresh} className={styles.refreshBtn} disabled={loading}>
            <FaSync className={loading ? styles.spinning : ''} />
          </button>
          
          <div className={styles.columnSettingsWrapper}>
            <button 
              onClick={() => setShowColumnSettings(!showColumnSettings)} 
              className={styles.columnSettingsBtn}
              title="Настройка колонок"
            >
              ⚙️ Колонки
            </button>
            
            {showColumnSettings && (
              <div className={styles.columnSettingsDropdown}>
                <div className={styles.columnSettingsHeader}>
                  <span>Показать колонки</span>
                  <button 
                    onClick={() => setShowColumnSettings(false)}
                    className={styles.closeDropdown}
                  >
                    ×
                  </button>
                </div>
                <div className={styles.columnSettingsList}>
                  {columnDefinitions.map(col => (
                    <label key={col.key} className={styles.columnSettingItem}>
                      <input
                        type="checkbox"
                        checked={visibleColumns[col.key]}
                        onChange={() => toggleColumnVisibility(col.key)}
                        disabled={col.alwaysVisible} // Всегда видимые колонки нельзя отключить
                      />
                      <span className={col.alwaysVisible ? styles.alwaysVisibleLabel : ''}>
                        {col.label} {col.alwaysVisible && '📌'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <button 
            onClick={handleClearOrders} 
            className={styles.clearBtn}
            disabled={loading}
            title={selectedServer === 'all' ? 'Очистить ордера со всех серверов' : 'Очистить все ордера сервера'}
          >
            🗑️
          </button>
        </div>
      </div>

      {stats && (
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Всего ордеров</div>
            <div className={styles.statValue}>{stats.total_orders}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>
              <FaTimesCircle className={styles.iconOpen} /> Открытых
            </div>
            <div className={styles.statValue}>{stats.open_orders}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>
              <FaCheckCircle className={styles.iconClosed} /> Закрытых
            </div>
            <div className={styles.statValue}>{stats.closed_orders}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>
              <FaCoins /> Общая прибыль
            </div>
            <div className={`${styles.statValue} ${stats.total_profit_btc >= 0 ? styles.profitPositive : styles.profitNegative}`}>
              {stats.total_profit_btc?.toFixed(2) || '0.00'} USDT
            </div>
          </div>
        </div>
      )}

      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <label><FaFilter /> Статус:</label>
          <select 
            value={statusFilter}
            onChange={(e) => handleFilterChange(e.target.value, symbolFilter, null)}
            className={styles.filterSelect}
          >
            <option value="">Все</option>
            <option value="Open">Открытые</option>
            <option value="Closed">Закрытые</option>
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label>Символ:</label>
          <input
            type="text"
            value={symbolFilter}
            onChange={(e) => handleFilterChange(statusFilter, e.target.value, null)}
            placeholder="BTC, ETH..."
            className={styles.filterInput}
          />
        </div>

        <div className={styles.filterGroup}>
          <label>🎮 Тип:</label>
          <select 
            value={emulatorFilter}
            onChange={(e) => handleFilterChange(statusFilter, symbolFilter, e.target.value)}
            className={styles.filterSelect}
          >
            <option value="all">Все</option>
            <option value="real">Реальные</option>
            <option value="emulator">Эмулятор</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className={styles.loading}>Загрузка...</div>
      ) : orders.length === 0 ? (
        <div className={styles.empty}>
          <FaChartLine size={48} />
          <p>Ордеров пока нет</p>
          <small>Listener будет сохранять ордера автоматически</small>
        </div>
      ) : (
        <>
          <div className={styles.tableWrapper}>
            <table className={styles.ordersTable}>
              <thead>
                <tr>
                  {visibleColumns.id && (
                    <th className={styles.stickyCol} onClick={() => handleSort('moonbot_order_id')} style={{ cursor: 'pointer' }}>
                      ID {sortBy === 'moonbot_order_id' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </th>
                  )}
                  {visibleColumns.type && (
                    <th onClick={() => handleSort('is_emulator')} style={{ cursor: 'pointer' }}>
                      Тип {sortBy === 'is_emulator' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </th>
                  )}
                  {visibleColumns.status && (
                    <th onClick={() => handleSort('status')} style={{ cursor: 'pointer' }}>
                      Статус {sortBy === 'status' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </th>
                  )}
                  {visibleColumns.symbol && (
                    <th onClick={() => handleSort('symbol')} style={{ cursor: 'pointer' }}>
                      Символ {sortBy === 'symbol' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </th>
                  )}
                  {visibleColumns.buyPrice && (
                    <th onClick={() => handleSort('buy_price')} style={{ cursor: 'pointer' }}>
                      Цена покупки {sortBy === 'buy_price' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </th>
                  )}
                  {visibleColumns.sellPrice && (
                    <th onClick={() => handleSort('sell_price')} style={{ cursor: 'pointer' }}>
                      Цена продажи {sortBy === 'sell_price' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </th>
                  )}
                  {visibleColumns.quantity && (
                    <th onClick={() => handleSort('quantity')} style={{ cursor: 'pointer' }}>
                      Количество {sortBy === 'quantity' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </th>
                  )}
                  {visibleColumns.profitUSDT && (
                    <th onClick={() => handleSort('profit_btc')} style={{ cursor: 'pointer' }}>
                      Прибыль USDT {sortBy === 'profit_btc' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </th>
                  )}
                  {visibleColumns.profitPercent && (
                    <th onClick={() => handleSort('profit_percent')} style={{ cursor: 'pointer' }}>
                      Прибыль % {sortBy === 'profit_percent' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </th>
                  )}
                  {visibleColumns.delta1h && (
                    <th onClick={() => handleSort('exchange_1h_delta')} style={{ cursor: 'pointer' }}>
                      Δ 1h % {sortBy === 'exchange_1h_delta' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </th>
                  )}
                  {visibleColumns.delta24h && (
                    <th onClick={() => handleSort('exchange_24h_delta')} style={{ cursor: 'pointer' }}>
                      Δ 24h % {sortBy === 'exchange_24h_delta' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </th>
                  )}
                  {visibleColumns.strategy && (
                    <th onClick={() => handleSort('strategy')} style={{ cursor: 'pointer' }}>
                      Стратегия / Task ID {sortBy === 'strategy' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </th>
                  )}
                  {visibleColumns.openedAt && (
                    <th onClick={() => handleSort('openedAt')} style={{ cursor: 'pointer' }}>
                      Открыт {sortBy === 'openedAt' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </th>
                  )}
                  {visibleColumns.closedAt && (
                    <th onClick={() => handleSort('closedAt')} style={{ cursor: 'pointer' }}>
                      Закрыт {sortBy === 'closedAt' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {sortedOrders.map(order => (
                  <tr key={order.id} className={order.status === 'Open' ? styles.openOrder : ''}>
                    {visibleColumns.id && (
                      <td className={`${styles.orderId} ${styles.stickyCol}`}>#{order.moonbot_order_id}</td>
                    )}
                    {visibleColumns.type && (
                      <td>
                        <span className={order.is_emulator ? styles.emulatorBadge : styles.realBadge}>
                          {order.is_emulator ? '🎮 EMU' : '💰 REAL'}
                        </span>
                      </td>
                    )}
                    {visibleColumns.status && (
                      <td>
                        <span className={`${styles.status} ${order.status === 'Open' ? styles.statusOpen : styles.statusClosed}`}>
                          {order.status === 'Open' ? <FaTimesCircle /> : <FaCheckCircle />}
                          {order.status}
                        </span>
                      </td>
                    )}
                    {visibleColumns.symbol && (
                      <td className={styles.symbol}>{order.symbol}</td>
                    )}
                    {visibleColumns.buyPrice && (
                      <td className={styles.price}>{order.buy_price?.toFixed(8) || '-'}</td>
                    )}
                    {visibleColumns.sellPrice && (
                      <td className={styles.price}>{order.sell_price?.toFixed(8) || '-'}</td>
                    )}
                    {visibleColumns.quantity && (
                      <td className={styles.quantity}>{order.quantity?.toFixed(4) || '-'}</td>
                    )}
                    {visibleColumns.profitUSDT && (
                      <td className={styles.btc}>
                        {order.profit_btc !== null && order.profit_btc !== undefined ? (
                          <span className={order.profit_btc >= 0 ? styles.profitPositive : styles.profitNegative}>
                            {order.profit_btc.toFixed(2)}
                          </span>
                        ) : '-'}
                      </td>
                    )}
                    {visibleColumns.profitPercent && (
                      <td className={styles.percent}>{formatPercent(order.profit_percent)}</td>
                    )}
                    {visibleColumns.delta1h && (
                      <td className={styles.delta}>
                        {order.exchange_1h_delta !== null ? (
                          <span className={order.exchange_1h_delta >= 0 ? styles.profitPositive : styles.profitNegative}>
                            {order.exchange_1h_delta.toFixed(2)}%
                          </span>
                        ) : '-'}
                      </td>
                    )}
                    {visibleColumns.delta24h && (
                      <td className={styles.delta}>
                        {order.exchange_24h_delta !== null ? (
                          <span className={order.exchange_24h_delta >= 0 ? styles.profitPositive : styles.profitNegative}>
                            {order.exchange_24h_delta.toFixed(2)}%
                          </span>
                        ) : '-'}
                      </td>
                    )}
                    {visibleColumns.strategy && (
                      <td className={styles.strategy}>
                        {order.strategy ? (
                          <code>{order.strategy}</code>
                        ) : order.task_id ? (
                          <code>Task #{order.task_id}</code>
                        ) : '-'}
                      </td>
                    )}
                    {visibleColumns.openedAt && (
                      <td className={styles.date}>{formatDate(order.opened_at)}</td>
                    )}
                    {visibleColumns.closedAt && (
                      <td className={styles.date}>{formatDate(order.closed_at)}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button 
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
                className={styles.pageBtn}
              >
                ← Назад
              </button>
              
              <span className={styles.pageInfo}>
                Страница {page} из {totalPages}
              </span>
              
              <button 
                onClick={() => handlePageChange(page + 1)}
                disabled={page === totalPages}
                className={styles.pageBtn}
              >
                Вперед →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Orders;

