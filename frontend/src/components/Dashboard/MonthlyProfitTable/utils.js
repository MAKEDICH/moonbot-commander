/**
 * Утилиты для MonthlyProfitTable
 */

/**
 * Названия месяцев на русском
 */
export const MONTHS = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

/**
 * Варианты периодов для копирования
 */
export const COPY_PERIODS = [
    { value: 1, label: 'Текущий месяц' },
    { value: 2, label: '2 месяца' },
    { value: 3, label: '3 месяца' },
    { value: 6, label: '6 месяцев' },
    { value: 12, label: 'Год' }
];

/**
 * Форматирование номера дня
 * @param {string} dateStr - Строка даты
 * @returns {number} День месяца
 */
export const formatDay = (dateStr) => {
    const date = new Date(dateStr);
    return date.getDate();
};

/**
 * Форматирование дня недели
 * @param {string} dateStr - Строка даты
 * @returns {string} Сокращённое название дня недели
 */
export const formatWeekday = (dateStr) => {
    const date = new Date(dateStr);
    const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    return days[date.getDay()];
};

/**
 * Форматирование одного месяца для копирования
 * @param {Object} monthData - Данные месяца
 * @param {Object} copyOptions - Опции копирования
 * @returns {string} Форматированный текст
 */
export const formatMonthData = (monthData, copyOptions) => {
    let text = '';
    const { month, year, days } = monthData;

    if (days.length === 0) return '';

    text += `📅 **${MONTHS[month]} ${year}**\n\n`;
    text += `\`\`\`\n`;

    // Формируем заголовок таблицы
    let headerLine = 'День';
    if (copyOptions.weekdays) headerLine += '   ';
    headerLine += ' │  Прибыль';
    if (copyOptions.ordersCount) headerLine += ' (сд.)';
    text += headerLine + '\n';

    // Разделитель
    let separator = '────';
    if (copyOptions.weekdays) separator += '──';
    separator += '┼─────────';
    if (copyOptions.ordersCount) separator += '──────';
    text += separator + '\n';

    days.forEach(day => {
        const dayNum = formatDay(day.date).toString().padStart(2, ' ');
        const weekday = formatWeekday(day.date);

        let line = dayNum;
        if (copyOptions.weekdays) line += ` ${weekday}`;
        line += ' │ ';

        if (day.orders_count > 0) {
            const profit = day.profit >= 0
                ? `+${day.profit.toFixed(2)}`
                : day.profit.toFixed(2);
            line += profit.padStart(8, ' ');
            if (copyOptions.ordersCount) {
                line += ` (${day.orders_count})`;
            }
        } else {
            line += '      —';
            if (copyOptions.ordersCount) line += '    ';
        }
        text += line + '\n';
    });

    // Нижний разделитель
    let bottomSep = '────';
    if (copyOptions.weekdays) bottomSep += '──';
    bottomSep += '┴─────────';
    if (copyOptions.ordersCount) bottomSep += '──────';
    text += bottomSep + '\n';
    text += `\`\`\`\n`;

    // Итого за месяц
    const monthProfit = days.reduce((sum, d) => sum + (d.profit || 0), 0);
    const monthProfitable = days.filter(d => d.profit > 0).length;
    const monthLosing = days.filter(d => d.profit < 0).length;

    if (copyOptions.totals) {
        const sign = monthProfit >= 0 ? '+' : '';
        const emoji = monthProfit >= 0 ? '✅' : '❌';
        text += `${emoji} Итого: **${sign}${monthProfit.toFixed(2)} USDT**`;
        if (copyOptions.stats) {
            text += ` (📈${monthProfitable} / 📉${monthLosing})`;
        }
        text += '\n';
    }

    return text;
};

