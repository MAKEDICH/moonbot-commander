import React from 'react';
import { 
  FiList, 
  FiTrendingUp, 
  FiTrendingDown,
  FiClock,
  FiExternalLink
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import styles from '../../pages/Dashboard.module.css';
import { formatServerDateCompact } from '../../utils/dateUtils';

/**
 * Последние сделки для дашборда
 */
const RecentOrders = ({ orders, loading }) => {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2><FiList /> Последние сделки</h2>
        </div>
        <div className={styles.loadingSection}>Загрузка...</div>
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2><FiList /> Последние сделки</h2>
        </div>
        <div className={styles.emptySection}>
          <FiList size={32} />
          <p>Нет последних сделок</p>
        </div>
      </div>
    );
  }

  const formatTime = (dateStr) => {
    return formatServerDateCompact(dateStr);
  };

  const formatProfit = (profit) => {
    if (profit === null || profit === undefined) return '-';
    const value = parseFloat(profit);
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}`;
  };

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2><FiList /> Последние сделки</h2>
        <button 
          className={styles.viewAllBtn}
          onClick={() => navigate('/orders')}
        >
          Все сделки <FiExternalLink />
        </button>
      </div>
      
      <div className={styles.recentOrdersList}>
        {orders.slice(0, 8).map((order, index) => {
          const profit = parseFloat(order.profit_btc || 0);
          const isProfitable = profit >= 0;
          
          return (
            <div key={order.id || index} className={styles.recentOrderItem}>
              <div className={styles.orderSymbol}>
                <span className={`${styles.orderIcon} ${isProfitable ? styles.profitIcon : styles.lossIcon}`}>
                  {isProfitable ? <FiTrendingUp /> : <FiTrendingDown />}
                </span>
                <div className={styles.orderSymbolInfo}>
                  <span className={styles.symbolName}>{order.symbol || 'N/A'}</span>
                  <span className={styles.strategyName}>{order.strategy || 'MANUAL'}</span>
                </div>
              </div>
              
              <div className={styles.orderProfit}>
                <span className={`${styles.profitValue} ${isProfitable ? styles.positive : styles.negative}`}>
                  {formatProfit(order.profit_btc)} USDT
                </span>
              </div>
              
              <div className={styles.orderTime}>
                <FiClock />
                <span>{formatTime(order.closed_at || order.opened_at)}</span>
              </div>
              
              <div className={`${styles.orderStatus} ${order.status === 'Closed' ? styles.statusClosed : styles.statusOpen}`}>
                {order.status === 'Closed' ? 'Закрыт' : 'Открыт'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RecentOrders;

