import React from 'react';
import styles from '../../pages/TradingStats.module.css';
import { getProfitClass, getWinrateClass, formatNumber } from './statsUtils';

/**
 * Основные метрики статистики торговли
 */
const MainMetrics = ({ overall }) => {
  return (
    <div className={styles.statsGrid}>
      <div className={styles.statCard}>
        <div className={styles.statLabel}>📊 Всего сделок</div>
        <div className={styles.statValue}>{overall.total_orders || 0}</div>
      </div>
      
      <div className={styles.statCard}>
        <div className={styles.statLabel}>🟢 Открытых</div>
        <div className={styles.statValue}>{overall.open_orders || 0}</div>
      </div>
      
      <div className={styles.statCard}>
        <div className={styles.statLabel}>🔴 Закрытых</div>
        <div className={styles.statValue}>{overall.closed_orders || 0}</div>
      </div>
      
      <div className={styles.statCard}>
        <div className={styles.statLabel}>💰 Общая прибыль</div>
        <div className={`${styles.statValue} ${getProfitClass(overall.total_profit || 0, styles)}`}>
          {formatNumber(overall.total_profit || 0, 2)} USDT
        </div>
      </div>
      
      <div className={styles.statCard}>
        <div className={styles.statLabel}>📈 Средняя прибыль</div>
        <div className={`${styles.statValue} ${getProfitClass(overall.avg_profit || 0, styles)}`}>
          {formatNumber(overall.avg_profit || 0, 2)} USDT
        </div>
      </div>
      
      <div className={styles.statCard}>
        <div className={styles.statLabel}>✅ Прибыльных</div>
        <div className={`${styles.statValue} ${styles.positive}`}>
          {overall.profitable_count || 0}
        </div>
      </div>
      
      <div className={styles.statCard}>
        <div className={styles.statLabel}>❌ Убыточных</div>
        <div className={`${styles.statValue} ${styles.negative}`}>
          {overall.losing_count || 0}
        </div>
      </div>
      
      <div className={styles.statCard}>
        <div className={styles.statLabel}>🎯 Винрейт</div>
        <div className={`${styles.statValue} ${getWinrateClass(overall.winrate || 0, styles)}`}>
          {formatNumber(overall.winrate || 0, 1)}%
        </div>
      </div>
    </div>
  );
};

export default MainMetrics;



