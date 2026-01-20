import React, { useState, useRef, useEffect } from 'react';
import { 
  FiTrendingUp, 
  FiTrendingDown, 
  FiDollarSign,
  FiPercent,
  FiActivity,
  FiClock,
  FiChevronDown
} from 'react-icons/fi';
import styles from '../../pages/Dashboard.module.css';

/**
 * Опции периодов
 */
const PERIOD_OPTIONS = [
  { value: 'today', label: 'За сегодня' },
  { value: 'week', label: 'За неделю' },
  { value: 'month', label: 'За месяц' }
];

/**
 * Мини-карточка трейдинговой статистики
 */
const TradingMiniCard = ({ icon: Icon, value, label, color, trend }) => (
  <div className={styles.tradingMiniCard}>
    <div className={styles.tradingMiniIcon} style={{ color }}>
      <Icon />
    </div>
    <div className={styles.tradingMiniInfo}>
      <span className={styles.tradingMiniValue}>{value}</span>
      <span className={styles.tradingMiniLabel}>{label}</span>
    </div>
    {trend !== undefined && (
      <div className={`${styles.tradingMiniTrend} ${trend >= 0 ? styles.positive : styles.negative}`}>
        {trend >= 0 ? <FiTrendingUp /> : <FiTrendingDown />}
        {Math.abs(trend).toFixed(1)}%
      </div>
    )}
  </div>
);

/**
 * Обзор трейдинга для дашборда
 */
const TradingOverview = ({ tradingStats, loading, period = 'today', onPeriodChange }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Закрытие дропдауна при клике вне
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentPeriodLabel = PERIOD_OPTIONS.find(p => p.value === period)?.label || 'За сегодня';
  if (loading) {
    return (
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2><FiActivity /> Торговая статистика</h2>
        </div>
        <div className={styles.loadingSection}>Загрузка...</div>
      </div>
    );
  }

  if (!tradingStats || !tradingStats.overall) {
    return (
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2><FiActivity /> Торговая статистика</h2>
        </div>
        <div className={styles.emptySection}>
          <FiActivity size={32} />
          <p>Нет данных о сделках</p>
        </div>
      </div>
    );
  }

  const { overall, previous_period } = tradingStats;
  
  // Расчет трендов (используем процентное изменение для прибыли)
  const profitTrend = previous_period?.profit_change_percent;
  const winrateTrend = previous_period?.winrate_change;

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2><FiActivity /> Торговая статистика</h2>
        <div className={styles.periodDropdownWrapper} ref={dropdownRef}>
          <button 
            className={styles.periodDropdownBtn}
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            {currentPeriodLabel}
            <FiChevronDown className={dropdownOpen ? styles.rotated : ''} />
          </button>
          
          {dropdownOpen && (
            <div className={styles.periodDropdownMenu}>
              {PERIOD_OPTIONS.map(option => (
                <button
                  key={option.value}
                  className={`${styles.periodDropdownItem} ${period === option.value ? styles.active : ''}`}
                  onClick={() => {
                    onPeriodChange(option.value);
                    setDropdownOpen(false);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      
      <div className={styles.tradingOverviewGrid}>
        <TradingMiniCard
          icon={FiDollarSign}
          value={`${overall.total_profit >= 0 ? '+' : ''}${overall.total_profit.toFixed(2)} USDT`}
          label="Общая прибыль"
          color={overall.total_profit >= 0 ? '#00ff88' : '#ff0055'}
          trend={profitTrend}
        />
        
        <TradingMiniCard
          icon={FiPercent}
          value={`${overall.winrate.toFixed(1)}%`}
          label="Винрейт"
          color={overall.winrate >= 50 ? '#00ff88' : '#ff6b00'}
          trend={winrateTrend}
        />
        
        <TradingMiniCard
          icon={FiTrendingUp}
          value={overall.profitable_count}
          label="Прибыльных"
          color="#00ff88"
        />
        
        <TradingMiniCard
          icon={FiTrendingDown}
          value={overall.losing_count}
          label="Убыточных"
          color="#ff0055"
        />
        
        <TradingMiniCard
          icon={FiActivity}
          value={overall.total_orders}
          label="Всего сделок"
          color="#00f5ff"
        />
        
        <TradingMiniCard
          icon={FiClock}
          value={`${overall.avg_duration_hours.toFixed(1)}ч`}
          label="Ср. время"
          color="#ffc800"
        />
      </div>

      {overall.max_win_streak > 0 && (
        <div className={styles.streaksRow}>
          <div className={styles.streakItem}>
            <span className={styles.streakLabel}>Макс. серия побед:</span>
            <span className={styles.streakValue} style={{ color: '#00ff88' }}>
              {overall.max_win_streak}
            </span>
          </div>
          <div className={styles.streakItem}>
            <span className={styles.streakLabel}>Макс. серия проигрышей:</span>
            <span className={styles.streakValue} style={{ color: '#ff0055' }}>
              {overall.max_loss_streak}
            </span>
          </div>
          <div className={styles.streakItem}>
            <span className={styles.streakLabel}>Profit Factor:</span>
            <span className={styles.streakValue} style={{ color: overall.profit_factor >= 1 ? '#00ff88' : '#ff0055' }}>
              {overall.profit_factor.toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradingOverview;

