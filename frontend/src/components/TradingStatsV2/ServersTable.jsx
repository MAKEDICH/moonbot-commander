import React from 'react';
import styles from '../../pages/TradingStats.module.css';
import { getProfitClass, getWinrateClass, formatNumber } from './statsUtils';

/**
 * Таблица статистики по ботам (серверам)
 */
const ServersTable = ({ byServer, sortConfig, onSort }) => {
  const renderSortArrow = (key) => {
    if (sortConfig.table === 'server' && sortConfig.key === key) {
      return sortConfig.direction === 'asc' ? ' ▲' : ' ▼';
    }
    return '';
  };

  return (
    <div className={styles.section}>
      <h2>🤖 По ботам</h2>
      <div className={styles.table}>
        <table>
          <thead>
            <tr>
              <th 
                onClick={() => onSort('server', 'server_name')} 
                style={{ cursor: 'pointer' }}
              >
                Бот{renderSortArrow('server_name')}
              </th>
              <th 
                onClick={() => onSort('server', 'total_orders')} 
                style={{ cursor: 'pointer' }}
              >
                Сделок{renderSortArrow('total_orders')}
              </th>
              <th 
                onClick={() => onSort('server', 'open_orders')} 
                style={{ cursor: 'pointer' }}
              >
                Открытых{renderSortArrow('open_orders')}
              </th>
              <th 
                onClick={() => onSort('server', 'total_profit')} 
                style={{ cursor: 'pointer' }}
              >
                Прибыль USDT{renderSortArrow('total_profit')}
              </th>
              <th 
                onClick={() => onSort('server', 'winrate')} 
                style={{ cursor: 'pointer' }}
              >
                Винрейт{renderSortArrow('winrate')}
              </th>
            </tr>
          </thead>
          <tbody>
            {byServer.map((s, idx) => (
              <tr key={idx}>
                <td>{s.server_name}</td>
                <td>{s.total_orders}</td>
                <td>{s.open_orders}</td>
                <td className={getProfitClass(s.total_profit, styles)}>
                  {formatNumber(s.total_profit, 2)}
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

export default ServersTable;



