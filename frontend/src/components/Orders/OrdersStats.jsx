/**
 * Карточки статистики Orders
 */

import React from 'react';
import styles from '../../pages/Orders.module.css';

export default function OrdersStats({ stats, selectedServer }) {
  if (!stats) return null;

  return (
    <div className={styles.statsGrid}>
      <div className={`${styles.statCard} ${selectedServer === 'all' ? styles.allServers : ''}`}>
        <div className={styles.statLabel}>📈 ВСЕГО ОРДЕРОВ</div>
        <div className={styles.statValue}>{stats.total_orders}</div>
      </div>
      
      <div className={`${styles.statCard} ${selectedServer === 'all' ? styles.allServers : ''}`}>
        <div className={styles.statLabel}>
          <span className={styles.iconOpen}>⭕</span> ОТКРЫТЫХ
        </div>
        <div className={styles.statValue}>{stats.open_orders}</div>
      </div>
      
      <div className={`${styles.statCard} ${selectedServer === 'all' ? styles.allServers : ''}`}>
        <div className={styles.statLabel}>
          <span className={styles.iconClosed}>✅</span> ЗАКРЫТЫХ
        </div>
        <div className={styles.statValue}>{stats.closed_orders}</div>
      </div>
      
      {/* Карточка прибыли с поддержкой валют */}
      {stats.mixed_currencies ? (
        // Несколько валют - показываем группировку
        <div className={`${styles.statCard} ${styles.multiCurrencyCard} ${selectedServer === 'all' ? styles.allServers : ''}`}>
          <div className={styles.statLabel}>💰 ПРИБЫЛЬ</div>
          <div className={styles.currencyBreakdown}>
            {Object.entries(stats.currencies || {}).map(([currency, data]) => (
              <div key={currency} className={styles.currencyRow}>
                <span className={styles.currencyLabel}>{currency}:</span>
                <span className={`${styles.currencyValue} ${data.total_profit_btc >= 0 ? styles.profitPositive : styles.profitNegative}`}>
                  {data.total_profit_btc.toFixed(2)}
                </span>
                <span className={styles.currencyOrders}>({data.total_orders})</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        // Одна валюта - обычное отображение
        <div className={`${styles.statCard} ${selectedServer === 'all' ? styles.allServers : ''}`}>
          <div className={styles.statLabel}>💰 ОБЩАЯ ПРИБЫЛЬ</div>
          <div className={`${styles.statValue} ${stats.total_profit_btc >= 0 ? styles.profitPositive : styles.profitNegative}`}>
            {stats.total_profit_btc?.toFixed(2) || '0.00'} {stats.default_currency || 'USDT'}
          </div>
        </div>
      )}
    </div>
  );
}



