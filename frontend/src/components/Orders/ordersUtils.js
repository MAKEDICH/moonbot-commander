/**
 * Утилиты для Orders
 */
import { formatServerDateCompact, parseServerTimeToMs } from '../../utils/dateUtils';

/**
 * Форматирование BTC
 */
export const formatBTC = (value) => {
  if (value === null || value === undefined) return '-';
  return value.toFixed(8) + ' BTC';
};

/**
 * Форматирование процентов
 */
export const formatPercent = (value, className) => {
  if (value === null || value === undefined) return '-';
  const formatted = value.toFixed(2);
  return { value: formatted, className: value >= 0 ? 'profitPositive' : 'profitNegative' };
};

/**
 * Форматирование даты - показывает время сервера БЕЗ конвертации
 */
export const formatDate = (dateStr) => {
  return formatServerDateCompact(dateStr);
};

/**
 * Функция сортировки ордеров
 */
export const sortOrders = (orders, sortBy, sortOrder) => {
  return [...orders].sort((a, b) => {
    let aVal = a[sortBy];
    let bVal = b[sortBy];
    
    // Обработка null/undefined
    if (aVal === null || aVal === undefined) aVal = '';
    if (bVal === null || bVal === undefined) bVal = '';
    
    // Обработка чисел
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    }
    
    // Обработка дат (поддерживаем оба формата: openedAt/closedAt и opened_at/closed_at)
    if (sortBy === 'openedAt' || sortBy === 'closedAt' || sortBy === 'opened_at' || sortBy === 'closed_at') {
      const dateA = aVal ? parseServerTimeToMs(aVal) || 0 : 0;
      const dateB = bVal ? parseServerTimeToMs(bVal) || 0 : 0;
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
};

/**
 * Фильтрация серверов по валюте
 */
export const filterServersByCurrency = (servers, currencyFilter) => {
  if (currencyFilter === 'all') return servers;
  return servers.filter(server => server.default_currency === currencyFilter);
};

/**
 * Агрегация статистики по валютам
 */
export const aggregateStatsByCurrency = (results) => {
  const currencyStats = {};
  
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
  
  return currencyStats;
};

/**
 * Обновление статистики после удаления ордера
 */
export const updateStatsAfterDelete = (stats, deletedOrder, servers, serverId) => {
  const newStats = { ...stats };
  
  // Обновляем общую статистику
  newStats.total_orders = Math.max(0, newStats.total_orders - 1);
  
  if (deletedOrder.status === 'Open') {
    newStats.open_orders = Math.max(0, newStats.open_orders - 1);
  } else if (deletedOrder.status === 'Closed') {
    newStats.closed_orders = Math.max(0, newStats.closed_orders - 1);
    if (deletedOrder.profit_btc) {
      newStats.total_profit_btc = newStats.total_profit_btc - deletedOrder.profit_btc;
    }
  }
  
  // Обновляем статистику по валютам если есть
  if (newStats.currencies) {
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
};



