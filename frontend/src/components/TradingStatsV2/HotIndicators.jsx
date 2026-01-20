import React from 'react';
import { FaFire, FaExclamationTriangle, FaBolt } from 'react-icons/fa';
import styles from '../../pages/TradingStats.module.css';

/**
 * Горячие индикаторы - важные метрики, требующие внимания
 */
const HotIndicators = ({ byStrategy, bySymbol, byServer }) => {
  const hotStrategy = byStrategy.length > 0 ? byStrategy[0] : null;
  const problemSymbol = bySymbol
    .filter(s => s.total_profit < 0)
    .slice()
    .sort((a, b) => a.total_profit - b.total_profit)[0];
  const mostActiveServer = byServer
    .slice()
    .sort((a, b) => b.total_orders - a.total_orders)[0];

  if (!hotStrategy && !problemSymbol && !mostActiveServer) {
    return null;
  }

  return (
    <div className={styles.hotIndicators}>
      {hotStrategy && (
        <div className={`${styles.hotCard} ${styles.hotSuccess}`}>
          <FaFire className={styles.hotIcon} />
          <div>
            <div className={styles.hotLabel}>Горячая стратегия</div>
            <div className={styles.hotValue}>{hotStrategy.strategy}</div>
            <div className={styles.hotSubtext}>
              {hotStrategy.total_profit > 0 ? '+' : ''}
              {hotStrategy.total_profit.toFixed(2)} USDT
            </div>
          </div>
        </div>
      )}
      
      {problemSymbol && (
        <div className={`${styles.hotCard} ${styles.hotWarning}`}>
          <FaExclamationTriangle className={styles.hotIcon} />
          <div>
            <div className={styles.hotLabel}>Проблемная монета</div>
            <div className={styles.hotValue}>{problemSymbol.symbol}</div>
            <div className={styles.hotSubtext}>
              {problemSymbol.total_profit.toFixed(2)} USDT
            </div>
          </div>
        </div>
      )}
      
      {mostActiveServer && (
        <div className={`${styles.hotCard} ${styles.hotInfo}`}>
          <FaBolt className={styles.hotIcon} />
          <div>
            <div className={styles.hotLabel}>Активный бот</div>
            <div className={styles.hotValue}>{mostActiveServer.server_name}</div>
            <div className={styles.hotSubtext}>
              {mostActiveServer.total_orders} сделок
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HotIndicators;



