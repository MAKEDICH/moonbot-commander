import React, { useState } from 'react';
import { FiTrendingUp } from 'react-icons/fi';
import styles from '../../pages/Dashboard.module.css';

/**
 * График прибыли для дашборда
 */
const ProfitChart = ({ profitData, loading, onPeriodChange }) => {
  const [period, setPeriod] = useState('day');

  const handlePeriodChange = (newPeriod) => {
    setPeriod(newPeriod);
    if (onPeriodChange) {
      onPeriodChange(newPeriod);
    }
  };

  if (loading) {
    return (
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2><FiTrendingUp /> График прибыли</h2>
        </div>
        <div className={styles.loadingSection}>Загрузка...</div>
      </div>
    );
  }

  const chartData = profitData?.data || [];
  
  if (chartData.length === 0) {
    return (
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2><FiTrendingUp /> График прибыли</h2>
          <div className={styles.periodSelector}>
            {['day', 'week', 'month'].map((p) => (
              <button
                key={p}
                className={`${styles.periodBtn} ${period === p ? styles.periodActive : ''}`}
                onClick={() => handlePeriodChange(p)}
              >
                {p === 'day' ? '24ч' : p === 'week' ? '7д' : '30д'}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.emptySection}>
          <FiTrendingUp size={32} />
          <p>Нет данных о прибыли за выбранный период</p>
        </div>
      </div>
    );
  }

  // Находим мин/макс для масштабирования
  const profits = chartData.map(d => d.cumulative_profit || 0);
  const minProfit = Math.min(...profits, 0);
  const maxProfit = Math.max(...profits, 0);
  const range = maxProfit - minProfit || 1;

  // Итоговая прибыль
  const totalProfit = chartData[chartData.length - 1]?.cumulative_profit || 0;
  const totalOrders = chartData.reduce((sum, d) => sum + (d.orders_count || 0), 0);

  // Нормализация для SVG
  const normalizeY = (value) => {
    return 100 - ((value - minProfit) / range) * 100;
  };

  // Создаем путь для линии
  const createPath = () => {
    if (chartData.length === 0) return '';
    
    const width = 100;
    const stepX = width / (chartData.length - 1 || 1);
    
    let path = '';
    chartData.forEach((point, index) => {
      const x = index * stepX;
      const y = normalizeY(point.cumulative_profit || 0);
      
      if (index === 0) {
        path += `M ${x} ${y}`;
      } else {
        path += ` L ${x} ${y}`;
      }
    });
    
    return path;
  };

  // Создаем путь для заливки
  const createAreaPath = () => {
    if (chartData.length === 0) return '';
    
    const width = 100;
    const stepX = width / (chartData.length - 1 || 1);
    const zeroY = normalizeY(0);
    
    let path = `M 0 ${zeroY}`;
    
    chartData.forEach((point, index) => {
      const x = index * stepX;
      const y = normalizeY(point.cumulative_profit || 0);
      path += ` L ${x} ${y}`;
    });
    
    path += ` L 100 ${zeroY} Z`;
    
    return path;
  };

  const isProfitable = totalProfit >= 0;

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2><FiTrendingUp /> График прибыли</h2>
        <div className={styles.periodSelector}>
          {['day', 'week', 'month'].map((p) => (
            <button
              key={p}
              className={`${styles.periodBtn} ${period === p ? styles.periodActive : ''}`}
              onClick={() => handlePeriodChange(p)}
            >
              {p === 'day' ? '24ч' : p === 'week' ? '7д' : '30д'}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.profitChartContainer}>
        <div className={styles.profitChartStats}>
          <div className={styles.profitChartStat}>
            <span className={styles.profitChartLabel}>Итого</span>
            <span className={`${styles.profitChartValue} ${isProfitable ? styles.positive : styles.negative}`}>
              {isProfitable ? '+' : ''}{totalProfit.toFixed(2)} USDT
            </span>
          </div>
          <div className={styles.profitChartStat}>
            <span className={styles.profitChartLabel}>Сделок</span>
            <span className={styles.profitChartValue}>{totalOrders}</span>
          </div>
        </div>

        <div className={styles.profitChartSvg}>
          <svg viewBox="0 0 100 60" preserveAspectRatio="none">
            {/* Нулевая линия */}
            <line 
              x1="0" 
              y1={normalizeY(0)} 
              x2="100" 
              y2={normalizeY(0)} 
              stroke="rgba(255,255,255,0.1)" 
              strokeWidth="0.3"
              strokeDasharray="2,2"
            />
            
            {/* Область под графиком */}
            <path
              d={createAreaPath()}
              fill={isProfitable ? 'url(#profitGradient)' : 'url(#lossGradient)'}
              opacity="0.3"
            />
            
            {/* Линия графика */}
            <path
              d={createPath()}
              fill="none"
              stroke={isProfitable ? '#00ff88' : '#ff0055'}
              strokeWidth="0.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            
            {/* Градиенты */}
            <defs>
              <linearGradient id="profitGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#00ff88" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#00ff88" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="lossGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#ff0055" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#ff0055" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <div className={styles.profitChartLabels}>
          <span>{chartData[0]?.time || ''}</span>
          <span>{chartData[chartData.length - 1]?.time || ''}</span>
        </div>
      </div>
    </div>
  );
};

export default ProfitChart;

