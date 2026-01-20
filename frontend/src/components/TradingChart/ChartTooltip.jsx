/**
 * Кастомный Tooltip для TradingChart
 */
import React, { memo } from 'react';
import { COLORS } from './constants';
import { formatPrice, formatTime } from './utils';

/**
 * Tooltip с ценовой информацией
 */
export const PriceTooltip = memo(({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  
  const pricePoint = payload.find(p => p.dataKey === 'price');
  const closestPoint = payload.find(p => p.dataKey === 'closestPrice');
  
  return (
    <div className="trading-chart-tooltip">
      <p className="tooltip-time">{formatTime(label)}</p>
      {pricePoint && (
        <p className="tooltip-line" style={{ color: COLORS.PRICE }}>
          Цена: <span className="price-value">{formatPrice(pricePoint.value)}</span>
        </p>
      )}
      {closestPoint && closestPoint.value && (
        <p className="tooltip-line" style={{ color: COLORS.CLOSEST }}>
          Средняя: <span className="price-value">{formatPrice(closestPoint.value)}</span>
        </p>
      )}
    </div>
  );
});
PriceTooltip.displayName = 'PriceTooltip';

/**
 * Tooltip для объёмов
 */
export const VolumeTooltip = memo(({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  return (
    <div className="trading-chart-tooltip">
      <p className="tooltip-time">{formatTime(data.timeMs)}</p>
      <p className="tooltip-line" style={{ color: COLORS.BUY }}>
        Buy: <span className="price-value">{data.buyVolume?.toFixed(2)}</span>
      </p>
      <p className="tooltip-line" style={{ color: COLORS.SELL }}>
        Sell: <span className="price-value">{data.sellVolume?.toFixed(2)}</span>
      </p>
      <p className="tooltip-line">
        Delta: <span className={`price-value ${data.delta >= 0 ? 'positive' : 'negative'}`}>
          {data.delta >= 0 ? '+' : ''}{data.delta?.toFixed(2)}
        </span>
      </p>
    </div>
  );
});
VolumeTooltip.displayName = 'VolumeTooltip';

