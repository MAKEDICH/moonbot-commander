import React from 'react';
import styles from '../../pages/TradingStats.module.css';
import { getProfitClass, getWinrateClass, formatNumber } from './statsUtils';

/**
 * Таблица статистики по стратегиям
 */
const StrategiesTable = ({ byStrategy, sortConfig, onSort }) => {
  const renderSortArrow = (key) => {
    if (sortConfig.table === 'strategy' && sortConfig.key === key) {
      return sortConfig.direction === 'asc' ? ' ▲' : ' ▼';
    }
    return '';
  };

  return (
    <div className={styles.section}>
      <h2>📈 По стратегиям</h2>
      <div className={styles.table}>
        <table>
          <thead>
            <tr>
              <th 
                onClick={() => onSort('strategy', 'strategy')} 
                style={{ cursor: 'pointer' }}
              >
                Стратегия{renderSortArrow('strategy')}
              </th>
              <th 
                onClick={() => onSort('strategy', 'total_orders')} 
                style={{ cursor: 'pointer' }}
              >
                Сделок{renderSortArrow('total_orders')}
              </th>
              <th 
                onClick={() => onSort('strategy', 'total_profit')} 
                style={{ cursor: 'pointer' }}
              >
                Прибыль USDT{renderSortArrow('total_profit')}
              </th>
              <th 
                onClick={() => onSort('strategy', 'avg_profit_percent')} 
                style={{ cursor: 'pointer' }}
              >
                Средний %{renderSortArrow('avg_profit_percent')}
              </th>
              <th 
                onClick={() => onSort('strategy', 'winrate')} 
                style={{ cursor: 'pointer' }}
              >
                Винрейт{renderSortArrow('winrate')}
              </th>
            </tr>
          </thead>
          <tbody>
            {byStrategy.map((s, idx) => (
              <tr key={idx}>
                <td>{s.strategy}</td>
                <td>{s.total_orders}</td>
                <td className={getProfitClass(s.total_profit, styles)}>
                  {formatNumber(s.total_profit, 2)}
                </td>
                <td className={getProfitClass(s.avg_profit_percent, styles)}>
                  {formatNumber(s.avg_profit_percent, 2)}%
                </td>
                <td className={getWinrateClass(s.winrate, styles)}>
                  {formatNumber(s.winrate, 1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StrategiesTable;



