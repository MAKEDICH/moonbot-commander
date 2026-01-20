/**
 * Утилиты для работы с датами
 * 
 * ВАЖНО: Все функции показывают время КАК ЕСТЬ с сервера,
 * без конвертации в часовой пояс браузера!
 */

/**
 * Форматировать дату/время с сервера БЕЗ конвертации в часовой пояс браузера.
 * Показывает именно то время, которое прислал сервер.
 * 
 * @param {string} dateStr - ISO строка с сервера (например "2025-12-10T03:05:00")
 * @param {object} options - Опции форматирования
 * @returns {string} Отформатированная дата
 */
export const formatServerDate = (dateStr, options = {}) => {
  if (!dateStr) return '-';
  
  const {
    showDate = true,
    showTime = true,
    showSeconds = false
  } = options;
  
  // Парсим ISO строку напрямую, без создания Date объекта
  // Это позволяет избежать конвертации в часовой пояс браузера
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):?(\d{2})?/);
  
  if (!match) {
    // Fallback для нестандартных форматов
    return dateStr;
  }
  
  const [, year, month, day, hours, minutes, seconds = '00'] = match;
  
  const parts = [];
  
  if (showDate) {
    parts.push(`${day}.${month}.${year}`);
  }
  
  if (showTime) {
    if (showSeconds) {
      parts.push(`${hours}:${minutes}:${seconds}`);
    } else {
      parts.push(`${hours}:${minutes}`);
    }
  }
  
  return parts.join(', ');
};

/**
 * Форматировать дату (без времени)
 */
export const formatServerDateOnly = (dateStr) => {
  return formatServerDate(dateStr, { showDate: true, showTime: false });
};

/**
 * Форматировать время (без даты)
 */
export const formatServerTimeOnly = (dateStr, showSeconds = false) => {
  return formatServerDate(dateStr, { showDate: false, showTime: true, showSeconds });
};

/**
 * Форматировать дату и время с секундами
 */
export const formatServerDateTime = (dateStr) => {
  return formatServerDate(dateStr, { showDate: true, showTime: true, showSeconds: true });
};

/**
 * Форматировать дату для компактного отображения (только дата + часы:минуты)
 */
export const formatServerDateCompact = (dateStr) => {
  return formatServerDate(dateStr, { showDate: true, showTime: true, showSeconds: false });
};

/**
 * DEPRECATED: Использовать formatServerDate вместо этого
 * Оставлено для обратной совместимости
 */
export const formatDate = (dateStr) => {
  return formatServerDateCompact(dateStr);
};

/**
 * Форматировать Unix timestamp (секунды) в дату/время.
 * Показывает время КАК ЕСТЬ с сервера.
 * 
 * @param {number} timestamp - Unix timestamp в секундах
 * @returns {string} Отформатированная дата
 */
export const formatUnixTimestamp = (timestamp) => {
  if (!timestamp) return '-';
  
  // Создаём Date из timestamp
  const date = new Date(timestamp * 1000);
  
  // Получаем компоненты в локальном времени сервера (где работает JS)
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${day}.${month}.${year}, ${hours}:${minutes}:${seconds}`;
};

/**
 * Преобразовать ISO строку с сервера в timestamp (миллисекунды)
 * БЕЗ конвертации в часовой пояс браузера.
 * 
 * Используется для графиков, где нужен числовой timestamp для отрисовки,
 * но при этом время должно соответствовать времени сервера.
 * 
 * @param {string} isoString - ISO строка с сервера
 * @returns {number} Timestamp в миллисекундах (или NaN если невалидная строка)
 */
export const parseServerTimeToMs = (isoString) => {
  if (!isoString) return NaN;
  
  // Парсим ISO строку напрямую
  const match = isoString.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):?(\d{2})?/);
  if (!match) return NaN;
  
  const [, year, month, day, hours, minutes, seconds = '0'] = match;
  
  // Создаём дату в UTC чтобы избежать конвертации часового пояса
  // Затем получаем timestamp
  return Date.UTC(
    parseInt(year, 10),
    parseInt(month, 10) - 1,
    parseInt(day, 10),
    parseInt(hours, 10),
    parseInt(minutes, 10),
    parseInt(seconds, 10)
  );
};

