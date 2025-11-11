import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { FaChartLine, FaSync, FaFilter, FaCheckCircle, FaTimesCircle, FaCoins } from 'react-icons/fa';
import styles from './Orders.module.css';
import { getApiBaseUrl } from '../utils/apiUrl';
import { ordersAPI } from '../api/api';
import wsService from '../services/websocket';

const Orders = ({ autoRefresh, setAutoRefresh }) => {
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
  // ИСПРАВЛЕНО: Добавлено недостающее состояние error
  const [error, setError] = useState(null);
  const autoRefreshRef = useRef(null);

  // Восстановление настроек из localStorage при загрузке
  useEffect(() => {
    const savedServer = localStorage.getItem('orders_selectedServer');
    
    if (savedServer) {
      setSelectedServer(savedServer);
    }
    // autoRefresh больше не восстанавливаем здесь - он приходит из пропсов
  }, []);

  useEffect(() => {
    fetchServers();
  }, []);

  // Перезагрузка данных при возврате на вкладку
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && selectedServer) {
        // Вкладка стала активной - обновляем данные
        fetchOrders(selectedServer, page, statusFilter, symbolFilter);
        fetchStats(selectedServer);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [selectedServer, page, statusFilter, symbolFilter, servers]);

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
        fetchOrders(selectedServer, page, statusFilter, symbolFilter);
        fetchStats(selectedServer);
      }
    });

    // Cleanup
    return () => {
      unsubscribe();
    };
  }, [selectedServer, page, statusFilter, symbolFilter, servers.length]);

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
        fetchOrders(selectedServer, page, statusFilter, symbolFilter);
        fetchStats(selectedServer);
      }
    }, 30000);

    // Cleanup
    return () => {
      if (checkInterval) {
        clearInterval(checkInterval);
      }
    };
  }, [autoRefresh, selectedServer, page, statusFilter, symbolFilter, servers.length]);

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

  const fetchOrders = async (serverId, pageNum = 1, status = '', symbol = '') => {
    // Используем текущий state servers
    return fetchOrdersWithServers(serverId, servers, pageNum, status, symbol);
  };

  const fetchOrdersWithServers = async (serverId, serversArray, pageNum = 1, status = '', symbol = '') => {
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
    fetchOrders(serverId, 1);
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
    fetchOrders(selectedServer, page, statusFilter, symbolFilter);
    fetchStats(selectedServer);
  };

  const handleFilterChange = (status, symbol) => {
    setStatusFilter(status);
    setSymbolFilter(symbol);
    setPage(1);
    fetchOrders(selectedServer, 1, status, symbol);
  };

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
      fetchOrders(selectedServer, 1, statusFilter, symbolFilter);
      fetchStats(selectedServer);
      setPage(1);
    } catch (error) {
      console.error('Error clearing orders:', error);
      alert('❌ Ошибка при удалении ордеров');
    }
  };

  const handlePageChange = (newPage) => {
    fetchOrders(selectedServer, newPage, statusFilter, symbolFilter);
  };

  const handleAutoRefreshToggle = (e) => {
    const newValue = e.target.checked;
    setAutoRefresh(newValue);
    // Сохранение в localStorage теперь происходит в Trading.jsx
  };

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
            onChange={(e) => handleFilterChange(e.target.value, symbolFilter)}
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
            onChange={(e) => handleFilterChange(statusFilter, e.target.value)}
            placeholder="BTC, ETH..."
            className={styles.filterInput}
          />
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
          <div className={styles.ordersTable}>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Статус</th>
                  <th>Символ</th>
                  <th>Цена покупки</th>
                  <th>Цена продажи</th>
                  <th>Количество</th>
                  <th>Прибыль USDT</th>
                  <th>Прибыль %</th>
                  <th>Стратегия</th>
                  <th>Открыт</th>
                  <th>Закрыт</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(order => (
                  <tr key={order.id} className={order.status === 'Open' ? styles.openOrder : ''}>
                    <td className={styles.orderId}>#{order.moonbot_order_id}</td>
                    <td>
                      <span className={`${styles.status} ${order.status === 'Open' ? styles.statusOpen : styles.statusClosed}`}>
                        {order.status === 'Open' ? <FaTimesCircle /> : <FaCheckCircle />}
                        {order.status}
                      </span>
                    </td>
                    <td className={styles.symbol}>{order.symbol}</td>
                    <td className={styles.price}>{order.buy_price?.toFixed(8) || '-'}</td>
                    <td className={styles.price}>{order.sell_price?.toFixed(8) || '-'}</td>
                    <td className={styles.quantity}>{order.quantity?.toFixed(4) || '-'}</td>
                    <td className={styles.btc}>
                      {order.profit_btc !== null && order.profit_btc !== undefined ? (
                        <span className={order.profit_btc >= 0 ? styles.profitPositive : styles.profitNegative}>
                          {order.profit_btc.toFixed(2)} USDT
                        </span>
                      ) : '-'}
                    </td>
                    <td className={styles.percent}>{formatPercent(order.profit_percent)}</td>
                    <td className={styles.strategy}>
                      {order.strategy ? <code>{order.strategy}</code> : '-'}
                    </td>
                    <td className={styles.date}>{formatDate(order.opened_at)}</td>
                    <td className={styles.date}>{formatDate(order.closed_at)}</td>
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

