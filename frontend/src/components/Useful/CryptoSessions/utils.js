/**
 * Утилиты для работы со временем и сессиями
 */

/**
 * Получить время в заданном часовом поясе
 * @param {Date} date - Дата
 * @param {string} timezone - Часовой пояс
 * @returns {Date} Дата в часовом поясе
 */
export const getTimeInTimezone = (date, timezone) => {
    return new Date(date.toLocaleString('en-US', { timeZone: timezone }));
};

/**
 * Форматирование времени
 * @param {Date} date - Дата
 * @returns {string} Форматированное время
 */
export const formatTime = (date) => {
    return date.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
};

/**
 * Форматирование даты
 * @param {Date} date - Дата
 * @returns {string} Форматированная дата
 */
export const formatDate = (date) => {
    return date.toLocaleDateString('ru-RU', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
};

/**
 * Форматирование часа
 * @param {number} hour - Час
 * @returns {string} Форматированный час
 */
export const formatHour = (hour) => {
    return `${hour.toString().padStart(2, '0')}:00`;
};

/**
 * Получить смещение часового пояса
 * @param {string} timezone - Часовой пояс
 * @returns {number} Смещение в часах
 */
export const getTimezoneOffset = (timezone) => {
    const now = new Date();
    const tzTime = getTimeInTimezone(now, timezone);
    
    const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60;
    const tzHours = tzTime.getHours() + tzTime.getMinutes() / 60;
    
    let offset = tzHours - utcHours;
    if (offset > 12) offset -= 24;
    if (offset < -12) offset += 24;
    
    return offset;
};

/**
 * Конвертировать час UTC в час часового пояса
 * @param {number} utcHour - Час UTC
 * @param {string} timezone - Часовой пояс
 * @returns {number} Час в часовом поясе
 */
export const utcHourToTimezoneHour = (utcHour, timezone) => {
    const offset = getTimezoneOffset(timezone);
    let tzHour = utcHour + offset;
    if (tzHour >= 24) tzHour -= 24;
    if (tzHour < 0) tzHour += 24;
    return tzHour;
};

/**
 * Проверить активна ли сессия
 * @param {Object} session - Сессия
 * @param {number} currentHourUTC - Текущий час UTC
 * @returns {boolean} Активна ли
 */
export const isSessionActive = (session, currentHourUTC) => {
    if (session.endUTC > session.startUTC) {
        return currentHourUTC >= session.startUTC && currentHourUTC < session.endUTC;
    }
    return currentHourUTC >= session.startUTC || currentHourUTC < session.endUTC;
};

/**
 * Проверить пиковые часы
 * @param {Object} session - Сессия
 * @param {number} currentHourUTC - Текущий час UTC
 * @returns {boolean} Пиковые ли часы
 */
export const isInPeakHours = (session, currentHourUTC) => {
    if (session.peakEnd > session.peakStart) {
        return currentHourUTC >= session.peakStart && currentHourUTC < session.peakEnd;
    }
    return currentHourUTC >= session.peakStart || currentHourUTC < session.peakEnd;
};

/**
 * Получить прогресс сессии
 * @param {Object} session - Сессия
 * @param {number} currentHourUTC - Текущий час UTC
 * @param {number} currentMinutes - Текущие минуты
 * @param {number} currentSeconds - Текущие секунды
 * @returns {number} Прогресс в процентах
 */
export const getSessionProgress = (session, currentHourUTC, currentMinutes, currentSeconds = 0) => {
    let duration, elapsed;
    const currentDecimal = currentHourUTC + currentMinutes / 60 + currentSeconds / 3600;

    if (session.endUTC > session.startUTC) {
        duration = session.endUTC - session.startUTC;
        elapsed = currentDecimal - session.startUTC;
    } else {
        duration = (24 - session.startUTC) + session.endUTC;
        if (currentHourUTC >= session.startUTC) {
            elapsed = currentDecimal - session.startUTC;
        } else {
            elapsed = (24 - session.startUTC) + currentDecimal;
        }
    }

    return Math.min(100, Math.max(0, (elapsed / duration) * 100));
};

/**
 * Получить оставшееся время сессии
 * @param {Object} session - Сессия
 * @param {number} currentHourUTC - Текущий час UTC
 * @param {number} currentMinutes - Текущие минуты
 * @param {number} currentSeconds - Текущие секунды
 * @returns {Object} Часы, минуты, секунды
 */
export const getTimeRemaining = (session, currentHourUTC, currentMinutes, currentSeconds) => {
    const currentDecimal = currentHourUTC + currentMinutes / 60 + currentSeconds / 3600;
    let remaining;

    if (session.endUTC > session.startUTC) {
        remaining = session.endUTC - currentDecimal;
    } else {
        if (currentHourUTC >= session.startUTC) {
            remaining = (24 - currentDecimal) + session.endUTC;
        } else {
            remaining = session.endUTC - currentDecimal;
        }
    }

    if (remaining < 0) remaining += 24;

    const totalSeconds = remaining * 3600;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    return { hours, minutes, seconds };
};

/**
 * Получить время до начала сессии
 * @param {Object} session - Сессия
 * @param {number} currentHourUTC - Текущий час UTC
 * @param {number} currentMinutes - Текущие минуты
 * @param {number} currentSeconds - Текущие секунды
 * @returns {Object} Часы, минуты, секунды
 */
export const getTimeUntilStart = (session, currentHourUTC, currentMinutes, currentSeconds) => {
    const currentDecimal = currentHourUTC + currentMinutes / 60 + currentSeconds / 3600;
    let until = session.startUTC - currentDecimal;
    if (until < 0) until += 24;

    const totalSeconds = until * 3600;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    return { hours, minutes, seconds };
};

/**
 * Проверить активно ли пересечение
 * @param {Object} overlap - Пересечение
 * @param {number} currentHourUTC - Текущий час UTC
 * @returns {boolean} Активно ли
 */
export const isOverlapActive = (overlap, currentHourUTC) => {
    if (overlap.endUTC > overlap.startUTC) {
        return currentHourUTC >= overlap.startUTC && currentHourUTC < overlap.endUTC;
    }
    return currentHourUTC >= overlap.startUTC || currentHourUTC < overlap.endUTC;
};

/**
 * Добавить пик к бару (для сессий без пересечения полночи)
 */
export const addPeakToBar = (sessionStart, sessionEnd, peakStart, peakEnd) => {
    const sessionDuration = sessionEnd - sessionStart;
    
    if (peakEnd > peakStart && peakStart >= sessionStart && peakEnd <= sessionEnd) {
        const peakStartOffset = ((peakStart - sessionStart) / sessionDuration) * 100;
        const peakWidth = ((peakEnd - peakStart) / sessionDuration) * 100;
        return { left: peakStartOffset, width: peakWidth };
    } else if (peakEnd < peakStart) {
        if (peakStart >= sessionStart && peakStart < sessionEnd) {
            const peakStartOffset = ((peakStart - sessionStart) / sessionDuration) * 100;
            const peakWidth = ((sessionEnd - peakStart) / sessionDuration) * 100;
            return { left: peakStartOffset, width: peakWidth };
        }
    }
    return null;
};

/**
 * Добавить пик к разделённым барам (для сессий с пересечением полночи)
 */
export const addPeakToSplitBars = (sessionStart, sessionEnd, peakStart, peakEnd, barIndex) => {
    const bar1Duration = 24 - sessionStart;
    const bar2Duration = sessionEnd;

    if (peakEnd > peakStart) {
        if (barIndex === 0) {
            if (peakStart >= sessionStart && peakStart < 24) {
                const peakStartOffset = ((peakStart - sessionStart) / bar1Duration) * 100;
                const peakEndInBar = Math.min(peakEnd, 24);
                const peakWidth = ((peakEndInBar - peakStart) / bar1Duration) * 100;
                if (peakWidth > 0) {
                    return { left: peakStartOffset, width: peakWidth };
                }
            }
        } else {
            if (peakEnd <= sessionEnd && peakStart < sessionEnd) {
                const peakStartInBar = Math.max(0, peakStart);
                const peakStartOffset = (peakStartInBar / bar2Duration) * 100;
                const peakWidth = ((peakEnd - peakStartInBar) / bar2Duration) * 100;
                if (peakWidth > 0 && peakStartInBar < peakEnd) {
                    return { left: peakStartOffset, width: peakWidth };
                }
            }
        }
    } else {
        if (barIndex === 0) {
            if (peakStart >= sessionStart) {
                const peakStartOffset = ((peakStart - sessionStart) / bar1Duration) * 100;
                const peakWidth = ((24 - peakStart) / bar1Duration) * 100;
                return { left: peakStartOffset, width: peakWidth };
            }
        } else {
            if (peakEnd <= sessionEnd && peakEnd > 0) {
                const peakStartOffset = 0;
                const peakWidth = (peakEnd / bar2Duration) * 100;
                return { left: peakStartOffset, width: peakWidth };
            }
        }
    }
    return null;
};

