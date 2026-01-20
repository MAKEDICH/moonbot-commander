/**
 * Утилиты для TradingChart
 */

/**
 * Форматирование цены с учётом величины
 */
export const formatPrice = (value) => {
  if (typeof value !== 'number' || isNaN(value)) return 'N/A';
  if (value < 0.001) return value.toFixed(8);
  if (value < 0.01) return value.toFixed(6);
  if (value < 1) return value.toFixed(4);
  return value.toFixed(2);
};

/**
 * Форматирование времени для оси X
 */
export const formatTime = (timeMs) => {
  if (typeof timeMs !== 'number' || isNaN(timeMs)) return '';
  const date = new Date(timeMs);
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

/**
 * Бинарный поиск ближайшего значения в отсортированном массиве
 */
export const findClosestPrice = (sortedArr, targetTime, maxDiff = 5000) => {
  if (!sortedArr || sortedArr.length === 0) return null;

  let left = 0;
  let right = sortedArr.length - 1;

  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    if (sortedArr[mid].timeMs < targetTime) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }

  let closest = sortedArr[left];
  if (left > 0) {
    const prev = sortedArr[left - 1];
    if (Math.abs(prev.timeMs - targetTime) < Math.abs(closest.timeMs - targetTime)) {
      closest = prev;
    }
  }

  if (Math.abs(closest.timeMs - targetTime) <= maxDiff) {
    return closest.price;
  }

  return null;
};

/**
 * Форматирование даты/времени сделки
 */
export const formatTradeDateTime = (isoString) => {
  if (!isoString) return null;
  try {
    const date = new Date(isoString);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch {
    return null;
  }
};

/**
 * Загрузка сохранённых состояний из localStorage
 */
export const getStoredState = (key, defaultValue) => {
  try {
    const stored = localStorage.getItem(`chart_${key}`);
    return stored !== null ? JSON.parse(stored) : defaultValue;
  } catch {
    return defaultValue;
  }
};

