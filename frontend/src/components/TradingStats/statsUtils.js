/**
 * Утилиты для работы со статистикой
 */

/**
 * Сортировка данных таблицы
 */
export const sortTableData = (data, sortConfig) => {
  if (!sortConfig.key || !Array.isArray(data)) return data;
  
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

/**
 * Определить ранг строки в таблице (топ-3, худшие)
 */
export const getRowRank = (data, item, key) => {
  if (!Array.isArray(data) || data.length === 0) return 'normal';
  
  const sorted = data.slice().sort((a, b) => b[key] - a[key]);
  const sortedIndex = sorted.findIndex(sortedItem => sortedItem === item);
  
  if (sortedIndex < 3) return 'top';
  if (sortedIndex >= data.length - 3) return 'worst';
  return 'normal';
};

/**
 * Форматирование текста для кнопок выбора
 */
export const getServerButtonText = (selectedServers, availableServers) => {
  if (selectedServers.length === 0 || selectedServers.includes('all')) {
    return '🤖 Все боты';
  }
  if (selectedServers.length === 1) {
    const server = availableServers.find(s => s.id === selectedServers[0]);
    return `🤖 ${server?.name || selectedServers[0]}`;
  }
  return `🤖 Выбрано: ${selectedServers.length}`;
};

export const getStrategyButtonText = (selectedStrategies) => {
  if (selectedStrategies.length === 0 || selectedStrategies.includes('all')) {
    return '🎯 Все стратегии';
  }
  if (selectedStrategies.length === 1) {
    return `🎯 ${selectedStrategies[0]}`;
  }
  return `🎯 Выбрано: ${selectedStrategies.length}`;
};

export const getTimePeriodText = (timePeriod, customDateFrom, customDateTo) => {
  const periods = {
    'all': '📅 За всё время',
    'today': '📅 За сегодня',
    'week': '📅 За неделю',
    'month': '📅 За месяц',
    'custom': `📅 ${customDateFrom || '...'} - ${customDateTo || '...'}`
  };
  return periods[timePeriod] || '📅 За всё время';
};

/**
 * Подготовка данных для графиков
 */
export const preparePieData = (by_strategy) => {
  return by_strategy.slice(0, 5).map(s => ({
    name: s.strategy,
    value: Math.abs(s.total_profit)
  }));
};

export const CHART_COLORS = ['#00C49F', '#0088FE', '#FFBB28', '#FF8042', '#8884d8'];





