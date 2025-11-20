import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { FaChartLine, FaSync, FaFilter, FaCheckCircle, FaTimesCircle, FaCoins, FaTrash } from 'react-icons/fa';
import styles from './Orders.module.css';
import commonStyles from '../styles/common.module.css';
import { getApiBaseUrl } from '../utils/apiUrl';
import { ordersAPI } from '../api/api';
import wsService from '../services/websocket';
import { useNotification } from '../context/NotificationContext';

const Orders = ({ autoRefresh, setAutoRefresh, emulatorFilter, setEmulatorFilter, currencyFilter }) => {
  const API_BASE_URL = getApiBaseUrl();
  const navigate = useNavigate();
  const { success, error: showError, confirm } = useNotification();
  const [servers, setServers] = useState([]);
  const [selectedServer, setSelectedServer] = useState('all'); // По умолчанию "Все сервера"
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0); // Прогресс загрузки (0-100)
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(30);
  const [statusFilter, setStatusFilter] = useState('');
  const [symbolFilter, setSymbolFilter] = useState('');
  // emulatorFilter теперь приходит из пропсов Trading.jsx
  // ИСПРАВЛЕНО: Добавлено недостающее состояние error
  const [error, setError] = useState(null);
  const autoRefreshRef = useRef(null);
  
  // 🎯 ГЕНИАЛЬНО: Debounce для WebSocket событий (защита от спама)
  const wsDebounceRef = useRef(null);
  const WS_DEBOUNCE_MS = 300; // 300ms между обновлениями
  
  // Сортировка
  const [sortBy, setSortBy] = useState('openedAt'); // Поле для сортировки
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' или 'desc'
  
  // Управление видимостью колонок
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
  

  useEffect(() => {
    fetchServers();
  }, []);
  
  // Обновляем данные при изменении фильтра валют
  useEffect(() => {
    if (servers.length > 0) {
      fetchOrders(selectedServer, page, statusFilter, symbolFilter, emulatorFilter);
      fetchStats(selectedServer, emulatorFilter);
    }
  }, [currencyFilter]);

  // Перезагрузка данных при возврате на вкладку
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && selectedServer) {
        // Вкладка стала активной - обновляем данные
        fetchOrders(selectedServer, page, statusFilter, symbolFilter, emulatorFilter);
        fetchStats(selectedServer, emulatorFilter);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [selectedServer, page, statusFilter, symbolFilter, emulatorFilter, currencyFilter, servers]);

  // WebSocket подключение (всегда активно для real-time обновлений)
  useEffect(() => {
    if (!selectedServer || servers.length === 0) {
      return;
    }

    // Подключаемся к WebSocket
    wsService.connect();

    // Подписываемся на события обновления ордеров с debouncing
    const unsubscribe = wsService.on('order_update', (data) => {
      console.log('[Orders] WebSocket event received:', data);
      
      // Проверяем соответствует ли server_id выбранному серверу
      if (selectedServer === 'all' || Number(selectedServer) === data.server_id) {
        // 🎯 ЭЛЕГАНТНО: Debouncing для защиты от спама событий
        if (wsDebounceRef.current) {
          clearTimeout(wsDebounceRef.current);
        }
        
        wsDebounceRef.current = setTimeout(() => {
          console.log('[Orders] Refreshing orders due to WebSocket event (debounced)');
          // Обновляем ордера и статистику
          fetchOrders(selectedServer, page, statusFilter, symbolFilter, emulatorFilter);
          fetchStats(selectedServer, emulatorFilter);
        }, WS_DEBOUNCE_MS);
      }
    });

    // Cleanup
    return () => {
      if (wsDebounceRef.current) {
        clearTimeout(wsDebounceRef.current);
      }
      unsubscribe();
    };
  }, [selectedServer, page, statusFilter, symbolFilter, emulatorFilter, currencyFilter, servers.length]);

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
        fetchStats(selectedServer, emulatorFilter);
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
        fetchStatsWithServers(savedServer, serversData, emulatorFilter);
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
        // Фильтруем серверы по выбранной валюте
        const filteredServers = currencyFilter === 'all' 
          ? serversArray 
          : serversArray.filter(server => server.default_currency === currencyFilter);
        
        if (filteredServers.length === 0) {
          setOrders([]);
          setTotal(0);
          setLoading(false);
          return;
        }
        
        // Загрузка ордеров со всех отфильтрованных серверов ПАРАЛЛЕЛЬНО (оптимизация)
        let allOrders = [];
        let totalCount = 0;
        const MAX_ORDERS_PER_SERVER = 100;
        
        // Сброс прогресса
        setLoadingProgress(0);
        let completedServers = 0;
        
        // Создаем массив промисов для параллельной загрузки
        const fetchPromises = filteredServers.map(server => {
          let url = `${API_BASE_URL}/api/servers/${server.id}/orders?limit=${MAX_ORDERS_PER_SERVER}&offset=0`;
          if (status) url += `&status=${status}`;
          if (symbol) url += `&symbol=${symbol}`;
          if (emulator !== 'all') {
            url += `&emulator=${emulator === 'emulator' ? 'true' : 'false'}`;
          }
          
          return axios.get(url, {
            headers: { Authorization: `Bearer ${token}` }
          })
            .then(response => {
              // Обновляем прогресс
              completedServers++;
              setLoadingProgress(Math.round((completedServers / filteredServers.length) * 100));
              
              return {
                orders: response.data.orders,
                total: response.data.total
              };
            })
            .catch(err => {
              console.error(`Error fetching orders from server ${server.id}:`, err);
              // Обновляем прогресс даже при ошибке
              completedServers++;
              setLoadingProgress(Math.round((completedServers / filteredServers.length) * 100));
              
              return { orders: [], total: 0 }; // Возвращаем пустые данные при ошибке
            });
        });
        
        // Ждем завершения всех запросов параллельно
        const results = await Promise.all(fetchPromises);
        
        // Объединяем все результаты
        results.forEach((result) => {
          // server_id теперь приходит с сервера
          allOrders = [...allOrders, ...result.orders];
          totalCount += result.total;
        });
        
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

  const fetchStats = async (serverId, emulator = 'all') => {
    // Используем текущий state servers
    return fetchStatsWithServers(serverId, servers, emulator);
  };

  const fetchStatsWithServers = async (serverId, serversArray, emulator = 'all') => {
    if (!serverId) return;
    
    try {
      const token = localStorage.getItem('token');
      
      // Построим query параметр для фильтра эмулятора
      const emulatorParam = emulator !== 'all' ? `?emulator=${emulator}` : '';
      
      if (serverId === 'all') {
        // Фильтруем серверы по выбранной валюте
        const filteredServers = currencyFilter === 'all' 
          ? serversArray 
          : serversArray.filter(server => server.default_currency === currencyFilter);
        
        if (filteredServers.length === 0) {
          setStats(null);
          return;
        }
        
        // 💱 Агрегация с группировкой по валютам
        const currencyStats = {};  // { "TRY": {...}, "USDT": {...} }
        
        // Создаем массив промисов для параллельной загрузки
        const fetchPromises = filteredServers.map(server =>
          axios.get(
            `${API_BASE_URL}/api/servers/${server.id}/orders/stats${emulatorParam}`,
            { headers: { Authorization: `Bearer ${token}` }}
          )
            .then(response => response.data)
            .catch(err => {
              console.error(`Error fetching stats from server ${server.id}:`, err);
              return { total_orders: 0, open_orders: 0, closed_orders: 0, total_profit_btc: 0, default_currency: 'USDT' };
            })
        );
        
        // Ждем завершения всех запросов параллельно
        const results = await Promise.all(fetchPromises);
        
        // Группируем по валютам
        results.forEach(data => {
          const currency = data.default_currency || 'USDT';
          
          if (!currencyStats[currency]) {
            currencyStats[currency] = {
              total_orders: 0,
              open_orders: 0,
              closed_orders: 0,
              total_profit_btc: 0
            };
          }
          
          currencyStats[currency].total_orders += data.total_orders || 0;
          currencyStats[currency].open_orders += data.open_orders || 0;
          currencyStats[currency].closed_orders += data.closed_orders || 0;
          currencyStats[currency].total_profit_btc += data.total_profit_btc || 0;
        });
        
        // Устанавливаем статистику с группировкой
        setStats({
          mixed_currencies: Object.keys(currencyStats).length > 1,  // ⚠️ Больше 1 валюты?
          currencies: currencyStats,  // { "TRY": {...}, "USDT": {...} }
          // Для обратной совместимости (если нужно)
          total_orders: Object.values(currencyStats).reduce((sum, c) => sum + c.total_orders, 0),
          open_orders: Object.values(currencyStats).reduce((sum, c) => sum + c.open_orders, 0),
          closed_orders: Object.values(currencyStats).reduce((sum, c) => sum + c.closed_orders, 0),
          total_profit_btc: Object.values(currencyStats).reduce((sum, c) => sum + c.total_profit_btc, 0)
        });
      } else {
        // Статистика с конкретного сервера
        const response = await axios.get(
          `${API_BASE_URL}/api/servers/${serverId}/orders/stats${emulatorParam}`,
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
    fetchStats(serverId, emulatorFilter);
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
    fetchStats(selectedServer, emulatorFilter);
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
    
    // Обновляем статистику при изменении фильтра эмулятора
    if (emulator !== null) {
      fetchStats(selectedServer, finalEmulator);
    }
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
    const confirmed = await confirm({
      title: 'Удаление ордеров',
      message: selectedServer === 'all'
        ? 'Вы действительно хотите удалить ВСЕ ордера со ВСЕХ серверов?\n\nЭто действие нельзя отменить!'
        : 'Вы действительно хотите удалить ВСЕ ордера для этого сервера?\n\nЭто действие нельзя отменить!',
      type: 'danger',
      confirmText: 'Удалить',
      cancelText: 'Отмена',
    });

    if (!confirmed) return;

    try {
      // Используем разные endpoints в зависимости от выбора
      if (selectedServer === 'all') {
        const response = await ordersAPI.clearAll();
        success(`Успешно удалено ${response.data.deleted_count} ордеров со всех серверов`);
      } else {
        const response = await ordersAPI.clearByServer(Number(selectedServer));
        success(`Успешно удалено ${response.data.deleted_count} ордеров`);
      }
      
      // Перезагружаем данные
      fetchOrders(selectedServer, 1, statusFilter, symbolFilter, emulatorFilter);
      fetchStats(selectedServer, emulatorFilter);
      setPage(1);
    } catch (error) {
      console.error('Error clearing orders:', error);
      showError('Ошибка при удалении ордеров');
    }
  };

  const handlePageChange = (newPage) => {
    fetchOrders(selectedServer, newPage, statusFilter, symbolFilter, emulatorFilter);
  };

  const handleDeleteOrder = async (serverId, orderId) => {
    if (!serverId) {
      showError('Ошибка: не указан ID сервера для удаления ордера');
      return;
    }
    
    const confirmed = await confirm({
      title: 'Удаление ордера',
      message: 'Вы действительно хотите удалить этот ордер?\n\nЭто действие нельзя отменить!',
      type: 'danger',
      confirmText: 'Удалить',
      cancelText: 'Отмена',
    });

    if (!confirmed) return;

    try {
      const token = localStorage.getItem('token');
      const response = await axios.delete(
        `${API_BASE_URL}/api/servers/${serverId}/orders/${orderId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        success(`Ордер #${response.data.deleted_order.moonbot_order_id} удален`);
        
        // Удаляем ордер из локального состояния без перезагрузки
        setOrders(prevOrders => prevOrders.filter(o => o.id !== orderId));
        setTotal(prevTotal => {
          const newTotal = prevTotal - 1;
          
          // Если на текущей странице больше нет ордеров и мы не на первой странице
          if (orders.length === 1 && page > 1) {
            // Переходим на предыдущую страницу
            setTimeout(() => {
              handlePageChange(page - 1);
            }, 100);
          }
          
          return newTotal;
        });
        
        // Обновляем статистику
        if (stats) {
          const deletedOrder = orders.find(o => o.id === orderId);
          if (deletedOrder) {
            setStats(prevStats => {
              const newStats = { ...prevStats };
              
              // Обновляем общую статистику
              newStats.total_orders = Math.max(0, newStats.total_orders - 1);
              
              if (deletedOrder.status === 'Open') {
                newStats.open_orders = Math.max(0, newStats.open_orders - 1);
              } else if (deletedOrder.status === 'Closed') {
                newStats.closed_orders = Math.max(0, newStats.closed_orders - 1);
                // Обновляем прибыль
                if (deletedOrder.profit_btc) {
                  newStats.total_profit_btc = newStats.total_profit_btc - deletedOrder.profit_btc;
                }
              }
              
              // Обновляем статистику по валютам если есть
              if (newStats.currencies) {
                // Определяем валюту ордера (base_currency или валюта сервера)
                const orderServerId = deletedOrder.server_id || serverId;
                const currentServer = servers.find(s => s.id === orderServerId);
                const currency = deletedOrder.base_currency || currentServer?.default_currency || 'USDT';
                
                if (newStats.currencies[currency]) {
                  newStats.currencies[currency].total_orders = Math.max(0, newStats.currencies[currency].total_orders - 1);
                  
                  if (deletedOrder.status === 'Open') {
                    newStats.currencies[currency].open_orders = Math.max(0, newStats.currencies[currency].open_orders - 1);
                  } else if (deletedOrder.status === 'Closed') {
                    newStats.currencies[currency].closed_orders = Math.max(0, newStats.currencies[currency].closed_orders - 1);
                    if (deletedOrder.profit_btc) {
                      newStats.currencies[currency].total_profit_btc = newStats.currencies[currency].total_profit_btc - deletedOrder.profit_btc;
                    }
                  }
                }
              }
              
              return newStats;
            });
          }
        }
      }
    } catch (err) {
      const errorMessage = err.response?.data?.detail || 
                          err.response?.data?.message || 
                          err.message || 
                          'Неизвестная ошибка';
      showError('Ошибка удаления ордера: ' + errorMessage);
    }
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
          <span className={styles.icon}>📊</span>
          <h1>MoonBot Orders</h1>
        </div>

        <div className={styles.controls}>
          <div className={styles.serverSelect}>
            <label>Сервер:</label>
            <select 
              value={selectedServer} 
              onChange={(e) => handleServerChange(e.target.value)}
              className={commonStyles.selectField}
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
              onClick={() => navigate('/column-settings')} 
              className={styles.columnSettingsBtn}
              title="Настройка колонок"
            >
              <span style={{filter: 'grayscale(0)', fontSize: '16px', marginRight: '6px'}}>⚙️</span> Колонки
            </button>
          </div>
          
          <button 
            onClick={handleClearOrders} 
            className={styles.clearBtn}
            disabled={loading}
            title={selectedServer === 'all' ? 'Очистить ордера со всех серверов' : 'Очистить все ордера сервера'}
          >
            <span style={{fontSize: '18px'}}>🗑️</span>
          </button>
        </div>
      </div>

      {stats && (
        <div className={styles.statsGrid}>
          <div className={`${styles.statCard} ${selectedServer === 'all' ? styles.allServers : ''}`}>
            <div className={styles.statLabel}>📈 ВСЕГО ОРДЕРОВ</div>
            <div className={styles.statValue}>{stats.total_orders}</div>
          </div>
          <div className={`${styles.statCard} ${selectedServer === 'all' ? styles.allServers : ''}`}>
            <div className={styles.statLabel}>
              <span className={styles.iconOpen}>⭕</span> ОТКРЫТЫХ
            </div>
            <div className={styles.statValue}>{stats.open_orders}</div>
          </div>
          <div className={`${styles.statCard} ${selectedServer === 'all' ? styles.allServers : ''}`}>
            <div className={styles.statLabel}>
              <span className={styles.iconClosed}>✅</span> ЗАКРЫТЫХ
            </div>
            <div className={styles.statValue}>{stats.closed_orders}</div>
          </div>
          
          {/* 💱 Карточка прибыли с поддержкой валют */}
          {stats.mixed_currencies ? (
            // Несколько валют - показываем группировку
            <div className={`${styles.statCard} ${styles.multiCurrencyCard} ${selectedServer === 'all' ? styles.allServers : ''}`}>
              <div className={styles.statLabel}>
                💰 ПРИБЫЛЬ
              </div>
              <div className={styles.currencyBreakdown}>
                {Object.entries(stats.currencies || {}).map(([currency, data]) => (
                  <div key={currency} className={styles.currencyRow}>
                    <span className={styles.currencyLabel}>{currency}:</span>
                    <span className={`${styles.currencyValue} ${data.total_profit_btc >= 0 ? styles.profitPositive : styles.profitNegative}`}>
                      {data.total_profit_btc.toFixed(2)}
                    </span>
                    <span className={styles.currencyOrders}>({data.total_orders})</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            // Одна валюта - обычное отображение
            <div className={`${styles.statCard} ${selectedServer === 'all' ? styles.allServers : ''}`}>
              <div className={styles.statLabel}>
                💰 ОБЩАЯ ПРИБЫЛЬ
              </div>
              <div className={`${styles.statValue} ${stats.total_profit_btc >= 0 ? styles.profitPositive : styles.profitNegative}`}>
                {stats.total_profit_btc?.toFixed(2) || '0.00'} {stats.default_currency || 'USDT'}
              </div>
            </div>
          )}
        </div>
      )}

      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <label><FaFilter /> Статус:</label>
          <select 
            value={statusFilter}
            onChange={(e) => handleFilterChange(e.target.value, symbolFilter, null)}
            className={commonStyles.selectField}
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
            className={commonStyles.selectField}
          >
            <option value="all">Все</option>
            <option value="real">Реальные</option>
            <option value="emulator">Эмулятор</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className={styles.loading}>
          Загрузка...
          {selectedServer === 'all' && loadingProgress > 0 && (
            <div className={styles.progressBar}>
              <div 
                className={styles.progressFill} 
                style={{ width: `${loadingProgress}%` }}
              />
              <span className={styles.progressText}>{loadingProgress}%</span>
            </div>
          )}
        </div>
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
                  <th style={{ width: '60px', textAlign: 'center' }}>Действия</th>
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
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => handleDeleteOrder(order.server_id, order.id)}
                        className={styles.deleteBtn}
                        title="Удалить ордер"
                      >
                        <FaTrash />
                      </button>
                    </td>
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

