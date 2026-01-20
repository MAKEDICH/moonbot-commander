/**
 * SVG Shape компоненты для TradingChart
 * Простые крестики без hover
 */
import React, { memo } from 'react';

/**
 * Крестик для трейдов (компактный)
 */
export const TradeCrossShape = memo(({ cx, cy, stroke }) => {
  const size = 3;
  return (
    <g style={{ pointerEvents: 'none' }}>
      <line 
        x1={cx - size} y1={cy - size} x2={cx + size} y2={cy + size} 
        stroke={stroke} strokeWidth={1.5} 
      />
      <line 
        x1={cx + size} y1={cy - size} x2={cx - size} y2={cy + size} 
        stroke={stroke} strokeWidth={1.5} 
      />
    </g>
  );
});
TradeCrossShape.displayName = 'TradeCrossShape';

/**
 * Крестик для ордеров (крупнее)
 */
export const OrderCrossShape = memo(({ cx, cy, stroke }) => {
  const size = 5;
  return (
    <g style={{ pointerEvents: 'none' }}>
      <line 
        x1={cx - size} y1={cy - size} x2={cx + size} y2={cy + size} 
        stroke={stroke} strokeWidth={2} 
      />
      <line 
        x1={cx + size} y1={cy - size} x2={cx - size} y2={cy + size} 
        stroke={stroke} strokeWidth={2} 
      />
    </g>
  );
});
OrderCrossShape.displayName = 'OrderCrossShape';

