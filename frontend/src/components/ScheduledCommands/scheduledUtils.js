/**
 * Утилиты для ScheduledCommands
 */

/**
 * Форматировать дату/время
 */
export const formatDateTime = (isoString, timezone = null) => {
  if (!timezone) {
    const date = new Date(isoString);
    return date.toLocaleString('ru-RU');
  }
  
  // Ручная конвертация с учетом timezone
  const date = new Date(isoString);
  const formatter = new Intl.DateTimeFormat('ru-RU', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const parts = formatter.formatToParts(date);
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  const hour = parts.find(p => p.type === 'hour').value;
  const minute = parts.find(p => p.type === 'minute').value;
  const second = parts.find(p => p.type === 'second').value;
  
  return `${day}.${month}.${year}, ${hour}:${minute}:${second}`;
};

/**
 * Получить имена серверов по ID
 */
export const getServerNames = (serverIds, servers) => {
  return serverIds
    .map(id => servers.find(s => s.id === id)?.name || `Server #${id}`)
    .join(', ');
};

/**
 * Получить имена групп
 * groupIds - это массив названий групп (строк), не ID
 */
export const getGroupNames = (groupIds, groups) => {
  if (!groupIds || groupIds.length === 0) return 'Нет';
  // groupIds уже содержит названия групп (строки)
  return groupIds.join(', ') || 'Неизвестно';
};

/**
 * Получить информацию о целях команды
 */
export const getTargetInfo = (command, servers, groups) => {
  if (command.target_type === 'groups' && command.group_ids && command.group_ids.length > 0) {
    return `Группы: ${getGroupNames(command.group_ids, groups)}`;
  }
  return `Серверы: ${getServerNames(command.server_ids || [], servers)}`;
};

/**
 * Получить метку режима повторения
 */
export const getRecurrenceLabel = (command) => {
  if (!command.recurrence_type) return null;
  
  if (command.recurrence_type === 'once') return 'Один раз';
  if (command.recurrence_type === 'daily') return 'Ежедневно';
  if (command.recurrence_type === 'weekly') return 'Еженедельно (каждые 7 дней)';
  if (command.recurrence_type === 'monthly') return 'Ежемесячно (то же число)';
  
  if (command.recurrence_type === 'weekly_days') {
    try {
      const weekdays = JSON.parse(command.weekdays || '[]');
      const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
      return `По дням недели: ${weekdays.map(d => dayNames[d]).join(', ')}`;
    } catch {
      return 'По дням недели';
    }
  }
  
  return null;
};

/**
 * Конвертировать дату/время пользователя в UTC
 */
export const convertToUTC = (scheduledDate, scheduledTime, timezone) => {
  // Парсим компоненты даты
  const [year, month, day] = scheduledDate.split('-').map(Number);
  const [hours, minutes, seconds = 0] = scheduledTime.split(':').map(Number);
  
  // Создаем UTC Date с этими компонентами
  const utcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));
  
  // Получаем offset для выбранного часового пояса
  const tempDate = new Date(`${scheduledDate}T${scheduledTime}`);
  const getOffset = (date, tz) => {
    const tzString = date.toLocaleString('en-US', { timeZone: tz });
    const utcString = date.toLocaleString('en-US', { timeZone: 'UTC' });
    return new Date(tzString).getTime() - new Date(utcString).getTime();
  };
  
  const offset = getOffset(tempDate, timezone);
  
  // Корректируем на offset часового пояса
  const correctedUtcDate = new Date(utcDate.getTime() - offset);
  
  return {
    isoString: correctedUtcDate.toISOString(),
    displayTime: `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}, ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
    utcDate: correctedUtcDate
  };
};

/**
 * Конвертировать UTC в локальное время для редактирования
 */
export const convertFromUTC = (utcTimeString, timezone) => {
  const utcDate = new Date(utcTimeString);
  const targetTimezone = timezone || 'UTC';
  
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: targetTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const parts = formatter.formatToParts(utcDate);
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  const hours = parts.find(p => p.type === 'hour').value;
  const minutes = parts.find(p => p.type === 'minute').value;
  const seconds = parts.find(p => p.type === 'second').value;
  
  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}:${minutes}:${seconds}`
  };
};



