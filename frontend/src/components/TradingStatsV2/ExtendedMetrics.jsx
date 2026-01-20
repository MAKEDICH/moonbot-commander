import React from 'react';
import styles from '../../pages/TradingStats.module.css';
import { getProfitClass, formatNumber } from './statsUtils';

/**
 * Расширенные метрики статистики торговли
 */
const ExtendedMetrics = ({ overall }) => {
  return (
    <div className={styles.section}>
      <h2>📊 Расширенные метрики</h2>
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>⚖️ Profit Factor</div>
          <div className={`${styles.statValue} ${getProfitClass((overall.profit_factor || 0) - 1, styles)}`}>
            {formatNumber(overall.profit_factor || 0, 2)}
          </div>
          <div className={styles.statSubtext}>
            {(overall.profit_factor || 0) > 1 ? 'Отлично' : 'Требует внимания'}
          </div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statLabel}>📉 Max Drawdown</div>
          <div className={`${styles.statValue} ${styles.negative}`}>
            {formatNumber(overall.max_drawdown || 0, 2)} USDT
          </div>
          <div className={styles.statSubtext}>Макс. просадка</div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statLabel}>⏱️ Средняя длительность</div>
          <div className={styles.statValue}>
            {formatNumber(overall.avg_duration_hours || 0, 1)}ч
          </div>
          <div className={styles.statSubtext}>На сделку</div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statLabel}>💎 ROI</div>
          <div className={`${styles.statValue} ${getProfitClass(overall.roi || 0, styles)}`}>
            {formatNumber(overall.roi || 0, 1)}%
          </div>
          <div className={styles.statSubtext}>Возврат инвестиций</div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statLabel}>🔥 Макс. серия побед</div>
          <div className={`${styles.statValue} ${styles.positive}`}>
            {overall.max_win_streak || 0}
          </div>
          <div className={styles.statSubtext}>Подряд</div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statLabel}>❄️ Макс. серия поражений</div>
          <div className={`${styles.statValue} ${styles.negative}`}>
            {overall.max_loss_streak || 0}
          </div>
          <div className={styles.statSubtext}>Подряд</div>
        </div>
      </div>
    </div>
  );
};

export default ExtendedMetrics;



