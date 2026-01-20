import React from 'react';
import styles from '../../pages/TradingStats.module.css';
import { formatNumber } from './statsUtils';

/**
 * Топ прибыльных и убыточных сделок
 */
const TopDealsTable = ({ topProfitable, topLosing }) => {
  return (
    <div className={styles.topDeals}>
      <div className={styles.section}>
        <h2>🏆 Топ прибыльных</h2>
        <div className={styles.table}>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Монета</th>
                <th>Стратегия</th>
                <th>Прибыль</th>
                <th>%</th>
              </tr>
            </thead>
            <tbody>
              {topProfitable.map((deal, idx) => (
                <tr key={idx}>
                  <td>#{deal.id}</td>
                  <td>{deal.symbol || '-'}</td>
                  <td>{deal.strategy || '-'}</td>
                  <td className={styles.positive}>
                    {formatNumber(deal.profit, 2)} USDT
                  </td>
                  <td className={styles.positive}>
                    {formatNumber(deal.profit_percent, 2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.section}>
        <h2>💔 Топ убыточных</h2>
        <div className={styles.table}>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Монета</th>
                <th>Стратегия</th>
                <th>Прибыль</th>
                <th>%</th>
              </tr>
            </thead>
            <tbody>
              {topLosing.map((deal, idx) => (
                <tr key={idx}>
                  <td>#{deal.id}</td>
                  <td>{deal.symbol || '-'}</td>
                  <td>{deal.strategy || '-'}</td>
                  <td className={styles.negative}>
                    {formatNumber(deal.profit, 2)} USDT
                  </td>
                  <td className={styles.negative}>
                    {formatNumber(deal.profit_percent, 2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TopDealsTable;



