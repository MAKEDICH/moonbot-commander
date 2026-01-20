import React from 'react';
import styles from '../../pages/TradingStats.module.css';
import { getProfitClass, getWinrateClass, formatNumber } from './statsUtils';

/**
 * Таблица статистики по монетам (символам)
 */
const SymbolsTable = ({ bySymbol, sortConfig, onSort }) => {
  const renderSortArrow = (key) => {
    if (sortConfig.table === 'symbol' && sortConfig.key === key) {
      return sortConfig.direction === 'asc' ? ' ▲' : ' ▼';
    }
    return '';
  };

  return (
    <div className={styles.section}>
      <h2>💰 По монетам</h2>
      <div className={styles.table}>
        <table>
          <thead>
            <tr>
              <th 
                onClick={() => onSort('symbol', 'symbol')} 
                style={{ cursor: 'pointer' }}
              >
                Монета{renderSortArrow('symbol')}
              </th>
              <th 
                onClick={() => onSort('symbol', 'total_orders')} 
                style={{ cursor: 'pointer' }}
              >
                Сделок{renderSortArrow('total_orders')}
              </th>
              <th 
                onClick={() => onSort('symbol', 'total_profit')} 
                style={{ cursor: 'pointer' }}
              >
                Прибыль USDT{renderSortArrow('total_profit')}
              </th>
              <th 
                onClick={() => onSort('symbol', 'avg_profit_percent')} 
                style={{ cursor: 'pointer' }}
              >
                Средний %{renderSortArrow('avg_profit_percent')}
              </th>
              <th 
                onClick={() => onSort('symbol', 'winrate')} 
                style={{ cursor: 'pointer' }}
              >
                Винрейт{renderSortArrow('winrate')}
              </th>
            </tr>
          </thead>
          <tbody>
            {bySymbol.map((s, idx) => (
              <tr key={idx}>
                <td>{s.symbol}</td>
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

export default SymbolsTable;



