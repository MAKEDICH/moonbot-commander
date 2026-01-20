/**
 * Компоненты статистики для TradingChart
 */
import React, { memo } from 'react';
import { formatPrice } from './utils';

/**
 * Блок статистики
 */
export const ChartStatsBlock = memo(({ stats, strategyName }) => {
  if (!stats) return null;
  
  return (
    <div className="trading-chart-stats-block">
      <h5>Статистика</h5>
      <div className="stats-grid">
        <div className="stat-cell">
          <span className="stat-name">1m Delta</span>
          <span className={`stat-val ${stats.last_1m_delta >= 0 ? 'positive' : 'negative'}`}>
            {stats.last_1m_delta?.toFixed(2)}%
          </span>
        </div>
        <div className="stat-cell">
          <span className="stat-name">5m Delta</span>
          <span className={`stat-val ${stats.last_5m_delta >= 0 ? 'positive' : 'negative'}`}>
            {stats.last_5m_delta?.toFixed(2)}%
          </span>
        </div>
        <div className="stat-cell">
          <span className="stat-name">1h Delta</span>
          <span className={`stat-val ${stats.last_1h_delta >= 0 ? 'positive' : 'negative'}`}>
            {stats.last_1h_delta?.toFixed(2)}%
          </span>
        </div>
        <div className="stat-cell">
          <span className="stat-name">24h Delta</span>
          <span className={`stat-val ${stats.last_24h_delta >= 0 ? 'positive' : 'negative'}`}>
            {stats.last_24h_delta?.toFixed(2)}%
          </span>
        </div>
        <div className="stat-cell">
          <span className="stat-name">Pump 1h</span>
          <span className="stat-val positive">{stats.pump_delta_1h?.toFixed(2)}%</span>
        </div>
        <div className="stat-cell">
          <span className="stat-name">Dump 1h</span>
          <span className="stat-val negative">{stats.dump_delta_1h?.toFixed(2)}%</span>
        </div>
        <div className="stat-cell">
          <span className="stat-name">HVol</span>
          <span className="stat-val">{stats.hvol?.toFixed(0)}</span>
        </div>
        <div className="stat-cell">
          <span className="stat-name">HVol Fast</span>
          <span className="stat-val">{stats.hvol_fast?.toFixed(0)}</span>
        </div>
        <div className="stat-cell wide">
          <span className="stat-name">Session Profit</span>
          <span className={`stat-val ${stats.session_profit >= 0 ? 'positive' : 'negative'}`}>
            ${stats.session_profit?.toFixed(2)}
          </span>
        </div>
        {strategyName && (
          <div className="stat-cell moonshot">
            <span className="stat-val" style={{ whiteSpace: 'nowrap' }}>{strategyName}</span>
          </div>
        )}
      </div>
    </div>
  );
});
ChartStatsBlock.displayName = 'ChartStatsBlock';

/**
 * Список ордеров
 */
export const ChartOrdersList = memo(({ orders }) => {
  if (!orders?.length) return null;
  
  const formattedOrders = orders.map(order => ({
    ...order,
    openTimeFormatted: order.open_time ? new Date(order.open_time).toLocaleTimeString() : null,
    closeTimeFormatted: order.close_time ? new Date(order.close_time).toLocaleTimeString() : null,
  }));
  
  return (
    <div className="trading-chart-orders">
      <h5>Ордера</h5>
      <div className="orders-list">
        {formattedOrders.map((order, i) => (
          <div key={i} className="order-item">
            <span className="order-id">{order.order_id}</span>
            <span className="order-price">${formatPrice(order.mean_price)}</span>
            <span className="order-times">
              {order.openTimeFormatted && (
                <span className="order-time open">
                  Open: {order.openTimeFormatted}
                </span>
              )}
              {order.closeTimeFormatted && (
                <span className="order-time close">
                  Close: {order.closeTimeFormatted}
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
});
ChartOrdersList.displayName = 'ChartOrdersList';

