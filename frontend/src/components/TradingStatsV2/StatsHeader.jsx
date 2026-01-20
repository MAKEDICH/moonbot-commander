import React from 'react';
import { FiTrendingUp } from 'react-icons/fi';
import styles from '../../pages/TradingStats.module.css';
import PageHeader from '../PageHeader';

/**
 * Шапка страницы статистики с кнопками управления
 */
const StatsHeader = ({ onRefresh, loading, autoRefresh, setAutoRefresh }) => {
  return (
    <PageHeader 
      icon={<FiTrendingUp />} 
      title="Статистика торговли" 
      gradient="green"
    >
      <button 
        onClick={onRefresh} 
        className={styles.refreshBtn} 
        disabled={loading}
      >
        🔄 {loading ? 'Загрузка...' : 'Обновить'}
      </button>
      <label className={styles.autoRefreshLabel}>
        <input
          type="checkbox"
          checked={autoRefresh}
          onChange={(e) => setAutoRefresh(e.target.checked)}
        />
        Автообновление
      </label>
    </PageHeader>
  );
};

export default StatsHeader;



