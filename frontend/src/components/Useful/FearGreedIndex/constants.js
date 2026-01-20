/**
 * Константы для FearGreedIndex
 */

/**
 * Периоды для графика
 */
export const CHART_PERIODS = [
    { id: '7', label: '7 дней', days: 7 },
    { id: '30', label: '30 дней', days: 30 },
    { id: '90', label: '90 дней', days: 90 }
];

/**
 * Получить цвет по значению индекса
 */
export const getColorByValue = (val) => {
    if (val <= 25) return '#ef4444';
    if (val <= 45) return '#f97316';
    if (val <= 55) return '#eab308';
    if (val <= 75) return '#22c55e';
    return '#10b981';
};

