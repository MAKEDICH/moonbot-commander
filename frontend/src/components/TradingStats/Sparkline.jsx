import React from 'react';
import styles from '../../pages/TradingStats.module.css';

/**
 * Компонент Sparkline (мини-график)
 */
const Sparkline = ({ data = [], height = 40 }) => {
  if (!data || data.length === 0) return null;
  
  const max = Math.max(...data.map(v => Math.abs(v)));
  
  return (
    <div className={styles.sparkline} style={{ height: `${height}px` }}>
      {data.map((value, index) => {
        const percentage = max > 0 ? (Math.abs(value) / max) * 100 : 10;
        const isNegative = value < 0;
        
        return (
          <div
            key={index}
            className={`${styles.sparklineBar} ${isNegative ? styles.negative : ''}`}
            style={{ height: `${percentage}%` }}
            title={value.toFixed(2)}
          />
        );
      })}
    </div>
  );
};

export default Sparkline;





