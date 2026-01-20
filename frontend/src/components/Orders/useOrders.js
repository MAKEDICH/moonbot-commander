/**
 * Хук для управления ордерами (часть 1/2)
 */

import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import { getApiBaseUrl } from '../../utils/apiUrl';
import { ordersAPI } from '../../api/api';
import wsService from '../../services/websocket';
import { useNotification } from '../../context/NotificationContext';
import { 
  filterServersByCurrency, 
  aggregateStatsByCurrency,
  updateStatsAfterDelete 
} from './ordersUtils';

const WS_DEBOUNCE_MS = 300;

export default function useOrders(autoRefresh, setAutoRefresh, emulatorFilter, setEmulatorFilter, currencyFilter) {
  const API_BASE_URL = getApiBaseUrl();
  const location = useLocation();
  const { success, error: showError, confirm } = useNotification();
  
  // Состояние
  const [servers, setServers] = useState([]);
  const [selectedServer, setSelectedServer] = useState('all');
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(30);
  const [statusFilter, setStatusFilter] = useState('');
  const [symbolFilter, setSymbolFilter] = useState('');
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState('opened_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const defaultColumns = {
      id: true,              // Закреплена и всегда видна
      taskId: true,          // Task ID перед названием бота
      botName: true,         // Название бота
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
      // Новые колонки из Moonbot (по умолчанию выключены)
      delta3h: false,
      delta5m: false,
      delta15m: false,
      delta1m: false,
      pump1h: false,
      dump1h: false,
      leverage: false,
      bvsvRatio: false,
      isShort: false,
      hvol: false,
      hvolf: false,
      dvol: false,
      signalType: false,
      sellReason: false,
    };
    
    const saved = localStorage.getItem('orders_visible_columns');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...defaultColumns, ...parsed };
      } catch (e) {
        console.error('Error parsing saved columns:', e);
        return defaultColumns;
      }
    }
    
    return defaultColumns;
  });
  
  const autoRefreshRef = useRef(null);
  const wsDebounceRef = useRef(null);

  // Восстановление настроек при загрузке
  useEffect(() => {
    const savedServer = localStorage.getItem('orders_selectedServer');
    if (savedServer) {
      setSelectedServer(savedServer);
    }
  }, []);

  // Сохранение видимости колонок
  useEffect(() => {
    localStorage.setItem('orders_visible_columns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  // Перезагрузка настроек колонок при возврате на страницу
  useEffect(() => {
    const saved = localStorage.getItem('orders_visible_columns');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setVisibleColumns(prev => {
          const merged = { ...prev, ...parsed };
          return merged;
        });
      } catch (e) {
        console.error('Error reloading saved columns:', e);
      }
    }
  }, [location.pathname]);

  // Загрузка серверов
  useEffect(() => {
    fetchServers();
  }, []);

  // Обновление при изменении фильтра валют
  useEffect(() => {
    if (servers.length > 0) {
      fetchOrders(selectedServer, page, statusFilter, symbolFilter, emulatorFilter);
      fetchStats(selectedServer, emulatorFilter);
    }
  }, [currencyFilter]);

  // Обновление при возврате на вкладку
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && selectedServer) {
        fetchOrders(selectedServer, page, statusFilter, symbolFilter, emulatorFilter);
        fetchStats(selectedServer, emulatorFilter);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [selectedServer, page, statusFilter, symbolFilter, emulatorFilter, currencyFilter, servers]);

  // WebSocket подключение
  useEffect(() => {
    if (!selectedServer || servers.length === 0) return;

    wsService.connect();

    const unsubscribe = wsService.on('order_update', (data) => {
      console.log('[Orders] WebSocket event received:', data);
      
      if (selectedServer === 'all' || Number(selectedServer) === data.server_id) {
        if (wsDebounceRef.current) {
          clearTimeout(wsDebounceRef.current);
        }
        
        wsDebounceRef.current = setTimeout(() => {
          console.log('[Orders] Refreshing orders due to WebSocket event (debounced)');
          fetchOrders(selectedServer, page, statusFilter, symbolFilter, emulatorFilter);
          fetchStats(selectedServer, emulatorFilter);
        }, WS_DEBOUNCE_MS);
      }
    });

    return () => {
      if (wsDebounceRef.current) {
        clearTimeout(wsDebounceRef.current);
      }
      unsubscribe();
    };
  }, [selectedServer, page, statusFilter, symbolFilter, emulatorFilter, currencyFilter, servers.length]);

  // Автообновление (fallback если WebSocket не работает)
  useEffect(() => {
    if (autoRefreshRef.current) {
      clearInterval(autoRefreshRef.current);
      autoRefreshRef.current = null;
    }

    if (!autoRefresh || !selectedServer || servers.length === 0) return;

    const checkInterval = setInterval(() => {
      if (!wsService.isConnected()) {
        console.log('[Orders] WebSocket not connected, using polling fallback');
        fetchOrders(selectedServer, page, statusFilter, symbolFilter, emulatorFilter);
        fetchStats(selectedServer, emulatorFilter);
      }
    }, 30000);

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
      
      const serversData = Array.isArray(response.data) 
        ? response.data 
        : Object.values(response.data || {});
      
      setServers(serversData);
      
      const savedServer = localStorage.getItem('orders_selectedServer') || 'all';
      if (serversData.length > 0) {
        fetchOrdersWithServers(savedServer, serversData);
        fetchStatsWithServers(savedServer, serversData, emulatorFilter);
      }
    } catch (error) {
      console.error('Error fetching servers:', error);
    }
  };

  const fetchOrders = async (serverId, pageNum = 1, status = '', symbol = '', emulator = 'all') => {
    return fetchOrdersWithServers(serverId, servers, pageNum, status, symbol, emulator);
  };

  const fetchOrdersWithServers = async (serverId, serversArray, pageNum = 1, status = '', symbol = '', emulator = 'all') => {
    if (!serverId) return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const offset = (pageNum - 1) * limit;
      
      if (serverId === 'all') {
        const filteredServers = filterServersByCurrency(serversArray, currencyFilter);
        
        if (filteredServers.length === 0) {
          setOrders([]);
          setTotal(0);
          setLoading(false);
          return;
        }
        
        let allOrders = [];
        const MAX_ORDERS_PER_SERVER = 100;
        
        setLoadingProgress(0);
        let completedServers = 0;
        
        const fetchPromises = filteredServers.map(server => {
          let url = `${API_BASE_URL}/api/servers/${server.id}/orders?limit=${MAX_ORDERS_PER_SERVER}&offset=0`;
          if (status) url += `&status=${status}`;
          if (symbol) url += `&symbol=${symbol}`;
          if (emulator !== 'all') {
            url += `&emulator=${emulator === 'emulator' ? 'true' : 'false'}`;
          }
          
          return axios.get(url, { headers: { Authorization: `Bearer ${token}` }})
            .then(response => {
              completedServers++;
              setLoadingProgress(Math.round((completedServers / filteredServers.length) * 100));
              return { orders: response.data.orders };
            })
            .catch(err => {
              console.error(`Error fetching orders from server ${server.id}:`, err);
              completedServers++;
              setLoadingProgress(Math.round((completedServers / filteredServers.length) * 100));
              return { orders: [] };
            });
        });
        
        const results = await Promise.all(fetchPromises);
        results.forEach((result) => {
          allOrders = [...allOrders, ...result.orders];
        });
        
        allOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        const paginatedOrders = allOrders.slice(offset, offset + limit);
        
        setOrders(paginatedOrders);
        setTotal(allOrders.length);
        setPage(pageNum);
      } else {
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
    return fetchStatsWithServers(serverId, servers, emulator);
  };

  const fetchStatsWithServers = async (serverId, serversArray, emulator = 'all') => {
    if (!serverId) return;
    
    try {
      const token = localStorage.getItem('token');
      const emulatorParam = emulator !== 'all' ? `?emulator=${emulator}` : '';
      
      if (serverId === 'all') {
        const filteredServers = filterServersByCurrency(serversArray, currencyFilter);
        
        if (filteredServers.length === 0) {
          setStats(null);
          return;
        }
        
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
        
        const results = await Promise.all(fetchPromises);
        const currencyStats = aggregateStatsByCurrency(results);
        
        setStats({
          mixed_currencies: Object.keys(currencyStats).length > 1,
          currencies: currencyStats,
          total_orders: Object.values(currencyStats).reduce((sum, c) => sum + c.total_orders, 0),
          open_orders: Object.values(currencyStats).reduce((sum, c) => sum + c.open_orders, 0),
          closed_orders: Object.values(currencyStats).reduce((sum, c) => sum + c.closed_orders, 0),
          total_profit_btc: Object.values(currencyStats).reduce((sum, c) => sum + c.total_profit_btc, 0)
        });
      } else {
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

  return {
    // Данные
    servers,
    selectedServer,
    orders,
    stats,
    loading,
    loadingProgress,
    total,
    page,
    limit,
    statusFilter,
    symbolFilter,
    error,
    sortBy,
    sortOrder,
    visibleColumns,
    
    // Методы (экспортируются из части 2)
    setSelectedServer,
    setPage,
    setStatusFilter,
    setSymbolFilter,
    setError,
    setSortBy,
    setSortOrder,
    setVisibleColumns,
    setOrders,
    setTotal,
    setStats,
    fetchOrders,
    fetchStats,
  };
}



