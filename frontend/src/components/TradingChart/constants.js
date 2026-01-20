/**
 * Константы для TradingChart
 */

export const COLORS = {
  BUY: '#4ade80',         // Яркий зелёный (покупка) с свечением
  SELL: '#f87171',        // Яркий красный (продажа) с свечением
  PRICE: '#60a5fa',       // Линия цены (синий)
  CLOSEST: '#a78bfa',     // Линия средней цены (фиолетовый)
  ORDER: '#fb923c',       // Горизонтальные линии ордеров (оранжевый)
  ORDER_OPEN: '#fef3c7',  // Кремовый для Open
  ORDER_CLOSE: '#60a5fa', // Синий крестик для Close
  TEST_UP: '#34d399',     // Уровень test_price_up (зелёный)
  TEST_DOWN: '#fb7185',   // Уровень test_price_down (красный)
  GRID: 'rgba(255, 255, 255, 0.06)',  // Полупрозрачная сетка
  AXIS: 'rgba(156, 163, 175, 0.8)',   // Серые оси
};

export const MAX_PRICE_POINTS = 300; // Максимум точек для линии цены (sampling)

// Варианты масштаба графика
export const SCALE_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 1, label: '1%' },
  { value: 2, label: '2%' },
  { value: 5, label: '5%' },
  { value: 10, label: '10%' },
  { value: 20, label: '20%' },
  { value: 50, label: '50%' },
  { value: 100, label: '100%' },
  { value: 500, label: '500%' },
  { value: 1000, label: '1000%' },
  { value: 2000, label: '2000%' },
  { value: 10000, label: '10000%' },
];

// Margins для области графика
export const CHART_MARGIN = { top: 20, right: 80, left: 20, bottom: 20 };
export const Y_AXIS_WIDTH = 70;

