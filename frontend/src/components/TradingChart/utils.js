/**
 * Утилиты для TradingChart
 */
import { formatServerDateTime } from '../../utils/dateUtils';

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
 * Форматирование времени для оси X (из UTC timestamp)
 */
export const formatTime = (timeMs) => {
  if (typeof timeMs !== 'number' || isNaN(timeMs)) return '';
  // Используем UTC методы так как timeMs уже в UTC
  const date = new Date(timeMs);
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
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
  return formatServerDateTime(isoString);
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

