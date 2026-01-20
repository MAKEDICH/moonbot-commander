/**
 * Панель управления для TradingChart
 */
import React, { memo } from 'react';
import { COLORS, SCALE_OPTIONS } from './constants';

/**
 * Панель управления с настройками отображения
 */
export const ChartControlsPanel = memo(({
  selectedScale,
  currentScalePercent,
  zoomDomain,
  showOrderLines,
  showPriceLine,
  onScaleChange,
  onResetZoom,
  onToggleOrderLines,
  onTogglePriceLine
}) => {
  return (
    <div className="chart-legend-stats">
      <span className="legend-stat">
        <span className="legend-label">Scale:</span>
        <select 
          className="scale-select"
          value={selectedScale}
          onChange={onScaleChange}
          title={zoomDomain ? "При zoom Scale вычисляется динамически" : "Выберите масштаб"}
        >
          {SCALE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className="legend-value scale-info" title="Текущий масштаб в %">
          ({currentScalePercent.toFixed(1)}%)
        </span>
      </span>

      <span className="legend-separator">|</span>
      
      {/* Кнопка сброса zoom */}
      {zoomDomain && (
        <>
          <button 
            className="zoom-reset-btn"
            onClick={onResetZoom}
            title="Сбросить масштаб к исходному"
          >
            <span style={{ fontSize: '16px' }}>🔄</span>
            СБРОС
          </button>
          <span className="legend-separator">|</span>
        </>
      )}

      <label className="legend-toggle">
        <input
          type="checkbox"
          checked={showOrderLines}
          onChange={(e) => onToggleOrderLines(e.target.checked)}
        />
        <span style={{ color: COLORS.ORDER }}>Ордера</span>
      </label>
      <label className="legend-toggle">
        <input
          type="checkbox"
          checked={showPriceLine}
          onChange={(e) => onTogglePriceLine(e.target.checked)}
        />
        <span style={{ color: COLORS.PRICE }}>Цена</span>
      </label>
    </div>
  );
});
ChartControlsPanel.displayName = 'ChartControlsPanel';

