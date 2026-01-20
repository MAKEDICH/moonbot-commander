/**
 * Обработчики событий для Orders
 */

import axios from 'axios';
import { getApiBaseUrl } from '../../utils/apiUrl';
import { ordersAPI } from '../../api/api';
import { updateStatsAfterDelete } from './ordersUtils';

const API_BASE_URL = getApiBaseUrl();

/**
 * Обработчик изменения сервера
 */
export const handleServerChange = (serverId, {
  setSelectedServer,
  setPage,
  setStatusFilter,
  setSymbolFilter,
  fetchOrders,
  fetchStats,
  emulatorFilter
}) => {
  setSelectedServer(serverId);
  localStorage.setItem('orders_selectedServer', serverId);
  setPage(1);
  setStatusFilter('');
  setSymbolFilter('');
  fetchOrders(serverId, 1, '', '', emulatorFilter);
  fetchStats(serverId, emulatorFilter);
};

/**
 * Обработчик обновления данных
 */
export const handleRefresh = async (selectedServer, servers, {
  setLoading,
  setError,
  fetchOrders,
  fetchStats,
  page,
  statusFilter,
  symbolFilter,
  emulatorFilter
}) => {
  setLoading(true);
  
  try {
    const token = localStorage.getItem('token');
    
    if (selectedServer && selectedServer !== 'all') {
      console.log(`Sending lst command to server ${selectedServer}...`);
      
      await axios.post(
        `${API_BASE_URL}/api/servers/${selectedServer}/listener/send-command`,
        null,
        {
          params: { command: 'lst' },
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      await new Promise(resolve => setTimeout(resolve, 3000));
    } else if (selectedServer === 'all') {
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
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  } catch (error) {
    console.error('Error sending lst command:', error);
    setError('Не удалось отправить команду обновления');
  }
  
  fetchOrders(selectedServer, page, statusFilter, symbolFilter, emulatorFilter);
  fetchStats(selectedServer, emulatorFilter);
};

/**
 * Обработчик изменения фильтров
 */
export const handleFilterChange = (status, symbol, emulator, {
  setStatusFilter,
  setSymbolFilter,
  setEmulatorFilter,
  setPage,
  fetchOrders,
  fetchStats,
  selectedServer,
  emulatorFilter
}) => {
  setStatusFilter(status);
  setSymbolFilter(symbol);
  if (emulator !== null) {
    setEmulatorFilter(emulator);
  }
  setPage(1);
  const finalEmulator = emulator !== null ? emulator : emulatorFilter;
  fetchOrders(selectedServer, 1, status, symbol, finalEmulator);
  
  if (emulator !== null) {
    fetchStats(selectedServer, finalEmulator);
  }
};

/**
 * Обработчик сортировки
 */
export const handleSort = (field, { sortBy, sortOrder, setSortBy, setSortOrder }) => {
  if (sortBy === field) {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  } else {
    setSortBy(field);
    setSortOrder('desc');
  }
};

/**
 * Обработчик очистки ордеров
 */
export const handleClearOrders = async (selectedServer, {
  confirm,
  success,
  showError,
  fetchOrders,
  fetchStats,
  setPage,
  statusFilter,
  symbolFilter,
  emulatorFilter
}) => {
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
    if (selectedServer === 'all') {
      const response = await ordersAPI.clearAll();
      success(`Успешно удалено ${response.data.deleted_count} ордеров со всех серверов`);
    } else {
      const response = await ordersAPI.clearByServer(Number(selectedServer));
      success(`Успешно удалено ${response.data.deleted_count} ордеров`);
    }
    
    fetchOrders(selectedServer, 1, statusFilter, symbolFilter, emulatorFilter);
    fetchStats(selectedServer, emulatorFilter);
    setPage(1);
  } catch (error) {
    console.error('Error clearing orders:', error);
    showError('Ошибка при удалении ордеров');
  }
};

/**
 * Обработчик удаления одного ордера
 */
export const handleDeleteOrder = async (serverId, orderId, {
  confirm,
  success,
  showError,
  orders,
  stats,
  servers,
  page,
  setOrders,
  setTotal,
  setStats,
  handlePageChange
}) => {
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
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );

    if (response.data.success) {
      success(`Ордер #${response.data.deleted_order.moonbot_order_id} удален`);
      
      setOrders(prevOrders => prevOrders.filter(o => o.id !== orderId));
      setTotal(prevTotal => {
        const newTotal = prevTotal - 1;
        
        if (orders.length === 1 && page > 1) {
          setTimeout(() => {
            handlePageChange(page - 1);
          }, 100);
        }
        
        return newTotal;
      });
      
      if (stats) {
        const deletedOrder = orders.find(o => o.id === orderId);
        if (deletedOrder) {
          const newStats = updateStatsAfterDelete(stats, deletedOrder, servers, serverId);
          setStats(newStats);
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

/**
 * Обработчик смены страницы
 */
export const handlePageChange = (newPage, {
  fetchOrders,
  selectedServer,
  statusFilter,
  symbolFilter,
  emulatorFilter
}) => {
  fetchOrders(selectedServer, newPage, statusFilter, symbolFilter, emulatorFilter);
};

/**
 * Обработчик переключения автообновления
 */
export const handleAutoRefreshToggle = (e, { setAutoRefresh }) => {
  const newValue = e.target.checked;
  setAutoRefresh(newValue);
};



