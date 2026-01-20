/**
 * Утилиты для TradingStatsV2
 */

/**
 * Форматирует число с нужным количеством знаков после запятой
 */
export const formatNumber = (value, decimals = 2) => {
  if (value === null || value === undefined) return '0.00';
  return Number(value).toFixed(decimals);
};

/**
 * Форматирует прибыль с плюсом/минусом
 */
export const formatProfit = (value, decimals = 2) => {
  if (value === null || value === undefined) return '0.00';
  const formatted = formatNumber(value, decimals);
  return value > 0 ? `+${formatted}` : formatted;
};

/**
 * Определяет CSS класс для прибыли
 */
export const getProfitClass = (value, styles) => {
  if (value > 0) return styles.positive;
  if (value < 0) return styles.negative;
  return '';
};

/**
 * Определяет CSS класс для винрейта
 */
export const getWinrateClass = (value, styles) => {
  return value >= 50 ? styles.positive : styles.negative;
};

/**
 * Сортирует данные таблицы
 */
export const sortData = (data, sortConfig) => {
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
 * Получает текст для кнопки выбора серверов
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

/**
 * Получает текст для кнопки выбора стратегий
 */
export const getStrategyButtonText = (selectedStrategies) => {
  if (selectedStrategies.length === 0 || selectedStrategies.includes('all')) {
    return '🎯 Все стратегии';
  }
  if (selectedStrategies.length === 1) {
    return `🎯 ${selectedStrategies[0]}`;
  }
  return `🎯 Выбрано: ${selectedStrategies.length}`;
};

/**
 * Получает текст для кнопки выбора периода
 */
export const getTimePeriodText = (timePeriod) => {
  const periods = {
    'all': '📅 За всё время',
    'today': '📅 За сегодня',
    'week': '📅 За неделю',
    'month': '📅 За месяц'
  };
  return periods[timePeriod] || '📅 За всё время';
};

/**
 * Получает текст для фильтра эмулятора
 */
export const getEmulatorText = (emulatorFilter) => {
  if (emulatorFilter === 'all') return '🎮 Все';
  if (emulatorFilter === 'real') return '💰 Реальные';
  if (emulatorFilter === 'emulator') return '🎮 Эмулятор';
  return '🎮 Все';
};



