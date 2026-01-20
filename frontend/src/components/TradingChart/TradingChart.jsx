/**
 * TradingChart - Компонент визуализации торгового графика
 * 
 * Использует recharts для профессионального отображения:
 * - Линия цены
 * - Линия средней цены
 * - Трейды (покупки/продажи)
 * - Ордера с соединительными линиями
 * - Статистика (дельты, HVol, Session Profit)
 * 
 * Модульная структура:
 * - constants.js - константы и цвета
 * - utils.js - утилиты форматирования
 * - shapes.jsx - SVG компоненты крестиков
 * - ChartTooltip.jsx - кастомные tooltips
 * - ChartControls.jsx - панель управления
 * - ChartStats.jsx - статистика и ордера
 * - useChartData.js - обработка данных
 * - useChartDomain.js - вычисление границ
 * - useChartZoom.js - zoom и pan
 */

import React, { memo, useState, useCallback, useEffect, useMemo } from 'react';
import {
  ComposedChart, Line, Bar, XAxis, YAxis, ReferenceLine,
  ResponsiveContainer, CartesianGrid, Scatter, Tooltip, Cell,
} from 'recharts';

// Локальные модули
import { COLORS, CHART_MARGIN } from './constants';
import { formatPrice, formatTime, formatTradeDateTime, getStoredState } from './utils';
import { TradeCrossShape, OrderCrossShape } from './shapes';
import { PriceTooltip, VolumeTooltip } from './ChartTooltip';
import { ChartControlsPanel } from './ChartControls';
import { ChartStatsBlock, ChartOrdersList } from './ChartStats';
import { useChartData } from './useChartData';
import { useChartDomain } from './useChartDomain';
import { useChartZoom } from './useChartZoom';

import './TradingChart.css';

/**
 * Главный компонент графика
 */
const TradingChart = memo(function TradingChart({ chartData, isFullscreen = false, onInteractionChange }) {
  // Обработка данных
  const data = useChartData(chartData);
  
  const {
    priceData, timeLabelMap, volumeData, maxVolume,
    buyTrades, sellTrades, buyOrderPoints, sellOrderPoints,
    buyConnectionLines, sellConnectionLines, uniqueOrderPrices,
    hasClosestGaps, orders, stats, deltas, market_name,
    strategy_name, start_time, end_time, closest_prices
  } = data;
  
  const tradeDateTime = formatTradeDateTime(start_time) || formatTradeDateTime(end_time);
  
  // Высота графика
  const [windowHeight, setWindowHeight] = useState(window.innerHeight);
  
  useEffect(() => {
    if (!isFullscreen) return;
    const handleResize = () => setWindowHeight(window.innerHeight);
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [isFullscreen]);
  
  const chartHeight = isFullscreen ? windowHeight - 100 : 400;

  // Состояния видимости элементов (с сохранением в localStorage)
  const [showOrderLines, setShowOrderLines] = useState(() => getStoredState('showOrderLines', false));
  const [showPriceLine, setShowPriceLine] = useState(() => getStoredState('showPriceLine', true));
  const [showAvgPriceLine, setShowAvgPriceLine] = useState(() => getStoredState('showAvgPriceLine', false));
  const [showTestLevels, setShowTestLevels] = useState(() => getStoredState('showTestLevels', true));
  const [showVolume, setShowVolume] = useState(() => getStoredState('showVolume', false));
  const [selectedScale, setSelectedScale] = useState(() => getStoredState('selectedScale', 'auto'));

  // Сохранение состояний
  useEffect(() => { localStorage.setItem('chart_showOrderLines', JSON.stringify(showOrderLines)); }, [showOrderLines]);
  useEffect(() => { localStorage.setItem('chart_showPriceLine', JSON.stringify(showPriceLine)); }, [showPriceLine]);
  useEffect(() => { localStorage.setItem('chart_showAvgPriceLine', JSON.stringify(showAvgPriceLine)); }, [showAvgPriceLine]);
  useEffect(() => { localStorage.setItem('chart_showTestLevels', JSON.stringify(showTestLevels)); }, [showTestLevels]);
  useEffect(() => { localStorage.setItem('chart_showVolume', JSON.stringify(showVolume)); }, [showVolume]);
  useEffect(() => { localStorage.setItem('chart_selectedScale', JSON.stringify(selectedScale)); }, [selectedScale]);
  
  // Уникальный ключ для графика
  const chartKey = useMemo(() => {
    const orderId = orders?.[0]?.order_id || '';
    return `${market_name || 'unknown'}_${orderId}`.replace(/[^a-zA-Z0-9_]/g, '_');
  }, [orders, market_name]);

  // Вычисление границ
  const { domainMin, domainMax, timeMin, timeMax } = useChartDomain({
    priceData, buyTrades, sellTrades, buyOrderPoints, sellOrderPoints, orders, selectedScale
  });

  // Zoom и pan
  const {
    wrapperRef, zoomDomain, setZoomDomain, isPanning,
    actualDomainX, actualDomainY, currentScalePercent,
    actualXTicks, actualYTicks, handleResetZoom,
    handlePanStart, handlePanMove, handlePanEnd, handleContextMenu
  } = useChartZoom({
    chartKey, timeMin, timeMax, domainMin, domainMax, onInteractionChange
  });

  // Обработчик изменения масштаба
  const handleScaleChange = useCallback((e) => {
    setSelectedScale(e.target.value);
    setZoomDomain(null);
  }, [setZoomDomain]);

  // Экспорт в PNG
  const handleExportPNG = useCallback(async () => {
    try {
      const svgElement = document.querySelector('.trading-chart-wrapper .recharts-wrapper svg');
      if (!svgElement) return;

      const clonedSvg = svgElement.cloneNode(true);
      const bbox = svgElement.getBoundingClientRect();
      clonedSvg.setAttribute('width', bbox.width);
      clonedSvg.setAttribute('height', bbox.height);
      
      const styleElement = document.createElement('style');
      styleElement.textContent = `text { font-family: sans-serif; } .recharts-cartesian-grid line { stroke: #333; }`;
      clonedSvg.insertBefore(styleElement, clonedSvg.firstChild);
      
      const svgData = new XMLSerializer().serializeToString(clonedSvg);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      const headerHeight = 50;
      
      img.onload = () => {
        canvas.width = bbox.width * 2;
        canvas.height = (bbox.height + headerHeight) * 2;
        ctx.scale(2, 2);
        
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, bbox.width, bbox.height + headerHeight);
        
        ctx.fillStyle = '#22c55e';
        ctx.font = 'bold 18px "JetBrains Mono", monospace, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(market_name || 'Unknown', 20, 30);
        
        if (tradeDateTime) {
          ctx.fillStyle = '#9ca3af';
          ctx.font = '14px sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(`📅 ${tradeDateTime}`, bbox.width - 20, 30);
        }
        
        if (strategy_name) {
          ctx.fillStyle = '#f97316';
          ctx.font = 'bold 14px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(strategy_name, bbox.width / 2, 30);
        }
        
        ctx.drawImage(img, 0, headerHeight);
        
        const link = document.createElement('a');
        const dateForFile = tradeDateTime ? tradeDateTime.replace(/[:/\s]/g, '-') : new Date().toISOString().slice(0,10);
        link.download = `chart_${market_name || 'unknown'}_${dateForFile}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        URL.revokeObjectURL(url);
      };
      
      img.src = url;
    } catch (error) {
      console.error('Export failed:', error);
    }
  }, [market_name, tradeDateTime, strategy_name]);

  // Ранние return'ы
  if (!chartData) {
    return <div className="trading-chart-empty"><p>Нет данных графика</p></div>;
  }

  if (!priceData?.length) {
    return <div className="trading-chart-empty"><p>Нет данных о ценах</p></div>;
  }

  const containerStyle = isFullscreen ? {
    height: '100%', background: 'transparent', border: 'none',
    boxShadow: 'none', padding: '10px', margin: 0
  } : {};

  return (
    <div className="trading-chart-container" style={containerStyle}>
      {/* Заголовок в fullscreen */}
      {isFullscreen && (
        <div className="fullscreen-header">
          <div className="fullscreen-title">{market_name || 'Unknown'}</div>
          <button className="fullscreen-screenshot-btn" onClick={handleExportPNG} title="Экспорт в PNG">📷</button>
        </div>
      )}
      
      {/* Заголовок и панель управления (не в fullscreen) */}
      {!isFullscreen && (
        <>
          <div className="trading-chart-header">
            <h4 className="chart-title">{market_name || 'Unknown'}</h4>
            <div className="chart-header-actions">
              <button className="chart-action-btn" onClick={handleExportPNG} title="Экспорт в PNG">📷</button>
            </div>
          </div>

          <div className="chart-controls-panel">
            <ChartControlsPanel
              selectedScale={selectedScale}
              currentScalePercent={currentScalePercent}
              zoomDomain={zoomDomain}
              showOrderLines={showOrderLines}
              showPriceLine={showPriceLine}
              onScaleChange={handleScaleChange}
              onResetZoom={handleResetZoom}
              onToggleOrderLines={setShowOrderLines}
              onTogglePriceLine={setShowPriceLine}
            />
          </div>
        </>
      )}

      {/* Область графика */}
      <div 
        className="trading-chart-wrapper"
        ref={wrapperRef}
        onMouseDown={handlePanStart}
        onMouseMove={handlePanMove}
        onMouseUp={handlePanEnd}
        onMouseLeave={handlePanEnd}
        onContextMenu={handleContextMenu}
        style={{ 
          position: 'relative', 
          cursor: isPanning ? 'grabbing' : 'grab',
          height: isFullscreen ? chartHeight + 20 : 'auto',
          background: isFullscreen ? 'transparent' : undefined
        }}
      >
        {!isFullscreen && (
          <div className="chart-zoom-hint">
            🖱️ Колёсико: zoom | ЛКМ: перемещение | ПКМ+drag: верт. масштаб | ПКМ+колёсико: гориз. zoom
            {zoomDomain && ' | Кнопка "Сброс" для возврата'}
          </div>
        )}
        
        {tradeDateTime && (
          <div className="chart-trade-datetime">📅 {tradeDateTime}</div>
        )}
        
        <ResponsiveContainer width="100%" height={chartHeight}>
          <ComposedChart data={priceData} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.GRID} />

            <XAxis
              dataKey="timeMs" type="number" domain={actualDomainX}
              stroke={COLORS.AXIS} tick={{ fontSize: 10, fill: COLORS.AXIS }}
              tickFormatter={(timeMs) => timeLabelMap.get(timeMs) || formatTime(timeMs)}
              ticks={actualXTicks} allowDataOverflow
            />

            <YAxis
              domain={actualDomainY} stroke={COLORS.AXIS}
              tick={{ fontSize: 10, fill: COLORS.AXIS }}
              tickFormatter={formatPrice} width={70}
              allowDataOverflow ticks={actualYTicks}
            />

            <Tooltip content={PriceTooltip} cursor={{ stroke: '#666', strokeDasharray: '3 3' }} isAnimationActive={false} />

            {/* Горизонтальные линии ордеров */}
            {showOrderLines && uniqueOrderPrices.map((price, i) => (
              <ReferenceLine key={`order-${i}`} y={price} stroke={COLORS.ORDER}
                strokeDasharray="5 5" strokeWidth={1.5} ifOverflow="extendDomain" isFront={true}
                label={{ value: formatPrice(price), position: 'right', fill: COLORS.ORDER, fontSize: 10 }}
              />
            ))}

            {/* Уровни test_price */}
            {showTestLevels && deltas?.test_price_up > 0 && (
              <ReferenceLine y={deltas.test_price_up} stroke={COLORS.TEST_UP}
                strokeDasharray="8 4" strokeWidth={1.5} ifOverflow="extendDomain" isFront={false}
                label={{ value: `▲ ${formatPrice(deltas.test_price_up)}`, position: 'right', fill: COLORS.TEST_UP, fontSize: 10 }}
              />
            )}
            {showTestLevels && deltas?.test_price_down > 0 && (
              <ReferenceLine y={deltas.test_price_down} stroke={COLORS.TEST_DOWN}
                strokeDasharray="8 4" strokeWidth={1.5} ifOverflow="extendDomain" isFront={false}
                label={{ value: `▼ ${formatPrice(deltas.test_price_down)}`, position: 'right', fill: COLORS.TEST_DOWN, fontSize: 10 }}
              />
            )}

            {/* Соединительные линии ордеров */}
            {buyConnectionLines.map((line, i) => (
              <Line key={`buy-line-${i}`}
                data={[{ timeMs: line.openTimeMs, connPrice: line.price }, { timeMs: line.closeTimeMs, connPrice: line.price }]}
                type="linear" dataKey="connPrice" stroke="#ffffff" strokeWidth={2}
                dot={false} isAnimationActive={false} legendType="none"
              />
            ))}
            {sellConnectionLines.map((line, i) => (
              <Line key={`sell-line-${i}`}
                data={[{ timeMs: line.openTimeMs, connPrice: line.price }, { timeMs: line.closeTimeMs, connPrice: line.price }]}
                type="linear" dataKey="connPrice" stroke="#3b82f6" strokeWidth={2}
                strokeDasharray="6 3" dot={false} isAnimationActive={false} legendType="none"
              />
            ))}

            {/* Линия цены */}
            {showPriceLine && (
              <Line type="monotone" dataKey="price" name="Price" stroke={COLORS.PRICE}
                strokeWidth={2} dot={false} activeDot={false} isAnimationActive={false}
              />
            )}

            {/* Линия средней цены */}
            {showAvgPriceLine && closest_prices?.length > 0 && (
              <Line type="monotone" dataKey="closestPrice" name="Avg Price" stroke={COLORS.CLOSEST}
                strokeWidth={1.5} strokeDasharray="3 3" dot={false} activeDot={false}
                isAnimationActive={false} connectNulls={hasClosestGaps}
              />
            )}

            {/* Трейды покупки/продажи */}
            {buyTrades.length > 0 && (
              <Scatter name="BUY" data={buyTrades} dataKey="price" fill={COLORS.BUY}
                shape={<TradeCrossShape stroke={COLORS.BUY} />} isAnimationActive={false}
              />
            )}
            {sellTrades.length > 0 && (
              <Scatter name="SELL" data={sellTrades} dataKey="price" fill={COLORS.SELL}
                shape={<TradeCrossShape stroke={COLORS.SELL} />} isAnimationActive={false}
              />
            )}

            {/* Ордера */}
            {buyOrderPoints.length > 0 && (
              <Scatter name="Buy Orders" data={buyOrderPoints} dataKey="price" fill={COLORS.ORDER_OPEN}
                shape={<OrderCrossShape stroke={COLORS.ORDER_OPEN} />} isAnimationActive={false} legendType="none"
              />
            )}
            {sellOrderPoints.length > 0 && (
              <Scatter name="Sell Orders" data={sellOrderPoints} dataKey="price" fill={COLORS.ORDER_CLOSE}
                shape={<OrderCrossShape stroke={COLORS.ORDER_CLOSE} />} isAnimationActive={false} legendType="none"
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>

        {/* График объёмов */}
        {showVolume && volumeData.length > 0 && (
          <div className="volume-chart-wrapper">
            <ResponsiveContainer width="100%" height={80}>
              <ComposedChart data={volumeData} margin={{ top: 5, right: 80, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.GRID} vertical={false} />
                <XAxis dataKey="timeMs" type="number" domain={actualDomainX} hide />
                <YAxis domain={[0, maxVolume * 1.1]} stroke={COLORS.AXIS}
                  tick={{ fontSize: 9, fill: COLORS.AXIS }}
                  tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}K` : v.toFixed(0)} width={70}
                />
                <Bar dataKey="totalVolume" isAnimationActive={false} maxBarSize={8}>
                  {volumeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.volumeColor} fillOpacity={0.7} />
                  ))}
                </Bar>
                <Tooltip content={VolumeTooltip} cursor={{ fill: 'rgba(255,255,255,0.1)' }} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Статистика и ордера (не в fullscreen) */}
      {!isFullscreen && <ChartStatsBlock stats={stats} strategyName={strategy_name} />}
      {!isFullscreen && <ChartOrdersList orders={orders} />}
    </div>
  );
});

export default TradingChart;
