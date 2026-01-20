import React from 'react';
import styles from '../../pages/TradingStats.module.css';
import { sortTableData, getRowRank } from './statsUtils';

/**
 * Заголовок сортируемой таблицы
 */
const SortableHeader = ({ table, sortKey, label, sortConfig, onSort }) => {
  const isActive = sortConfig.table === table && sortConfig.key === sortKey;
  const arrow = isActive ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '';
  
  return (
    <th onClick={() => onSort(table, sortKey)} style={{ cursor: 'pointer' }}>
      {label} {arrow}
    </th>
  );
};

/**
 * Статистика по стратегиям
 */
export const StrategiesTable = ({ by_strategy, sortConfig, onSort, onRowClick }) => {
  const sortedData = sortTableData(by_strategy, sortConfig.table === 'strategy' ? sortConfig : { key: null });
  
  return (
    <div className={styles.section}>
      <h2>📈 По стратегиям</h2>
      <div className={styles.table}>
        <table>
          <thead>
            <tr>
              <SortableHeader 
                table="strategy" 
                sortKey="strategy" 
                label="Стратегия" 
                sortConfig={sortConfig} 
                onSort={onSort} 
              />
              <SortableHeader 
                table="strategy" 
                sortKey="total_orders" 
                label="Сделок" 
                sortConfig={sortConfig} 
                onSort={onSort} 
              />
              <SortableHeader 
                table="strategy" 
                sortKey="total_profit" 
                label="Прибыль USDT" 
                sortConfig={sortConfig} 
                onSort={onSort} 
              />
              <SortableHeader 
                table="strategy" 
                sortKey="avg_profit_percent" 
                label="Средний %" 
                sortConfig={sortConfig} 
                onSort={onSort} 
              />
              <SortableHeader 
                table="strategy" 
                sortKey="winrate" 
                label="Винрейт" 
                sortConfig={sortConfig} 
                onSort={onSort} 
              />
            </tr>
          </thead>
          <tbody>
            {sortedData.map((s, idx) => {
              const rank = getRowRank(by_strategy, s, 'total_profit');
              const rowClass = rank === 'top' ? styles.topRow : rank === 'worst' ? styles.worstRow : '';
              
              return (
                <tr 
                  key={idx} 
                  className={`${rowClass} ${styles.clickableRow}`}
                  onClick={() => onRowClick(s, 'strategy')}
                  title="Кликните для подробной информации"
                >
                  <td>{s.strategy}</td>
                  <td>{s.total_orders}</td>
                  <td className={s.total_profit >= 0 ? styles.positive : styles.negative}>
                    {s.total_profit.toFixed(2)}
                  </td>
                  <td className={s.avg_profit_percent >= 0 ? styles.positive : styles.negative}>
                    {s.avg_profit_percent.toFixed(2)}%
                  </td>
                  <td className={s.winrate >= 50 ? styles.positive : styles.negative}>
                    {s.winrate.toFixed(1)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/**
 * Статистика по ботам
 */
export const ServersTable = ({ by_server, sortConfig, onSort, onRowClick }) => {
  const sortedData = sortTableData(by_server, sortConfig.table === 'server' ? sortConfig : { key: null });
  
  return (
    <div className={styles.section}>
      <h2>🤖 По ботам</h2>
      <div className={styles.table}>
        <table>
          <thead>
            <tr>
              <SortableHeader 
                table="server" 
                sortKey="server_name" 
                label="Бот" 
                sortConfig={sortConfig} 
                onSort={onSort} 
              />
              <SortableHeader 
                table="server" 
                sortKey="total_orders" 
                label="Сделок" 
                sortConfig={sortConfig} 
                onSort={onSort} 
              />
              <SortableHeader 
                table="server" 
                sortKey="open_orders" 
                label="Открытых" 
                sortConfig={sortConfig} 
                onSort={onSort} 
              />
              <SortableHeader 
                table="server" 
                sortKey="total_profit" 
                label="Прибыль USDT" 
                sortConfig={sortConfig} 
                onSort={onSort} 
              />
              <SortableHeader 
                table="server" 
                sortKey="winrate" 
                label="Винрейт" 
                sortConfig={sortConfig} 
                onSort={onSort} 
              />
            </tr>
          </thead>
          <tbody>
            {sortedData.map((s, idx) => {
              const rank = getRowRank(by_server, s, 'total_profit');
              const rowClass = rank === 'top' ? styles.topRow : rank === 'worst' ? styles.worstRow : '';
              
              return (
                <tr 
                  key={idx}
                  className={`${rowClass} ${styles.clickableRow}`}
                  onClick={() => onRowClick(s, 'server')}
                  title="Кликните для подробной информации"
                >
                  <td>{s.server_name}</td>
                  <td>{s.total_orders}</td>
                  <td>{s.open_orders}</td>
                  <td className={s.total_profit >= 0 ? styles.positive : styles.negative}>
                    {s.total_profit.toFixed(2)}
                  </td>
                  <td className={s.winrate >= 50 ? styles.positive : styles.negative}>
                    {s.winrate.toFixed(1)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/**
 * Статистика по монетам
 */
export const SymbolsTable = ({ by_symbol, sortConfig, onSort, onRowClick }) => {
  const sortedData = sortTableData(by_symbol, sortConfig.table === 'symbol' ? sortConfig : { key: null });
  
  return (
    <div className={styles.section}>
      <h2>💰 По монетам</h2>
      <div className={styles.table}>
        <table>
          <thead>
            <tr>
              <SortableHeader 
                table="symbol" 
                sortKey="symbol" 
                label="Монета" 
                sortConfig={sortConfig} 
                onSort={onSort} 
              />
              <SortableHeader 
                table="symbol" 
                sortKey="total_orders" 
                label="Сделок" 
                sortConfig={sortConfig} 
                onSort={onSort} 
              />
              <SortableHeader 
                table="symbol" 
                sortKey="total_profit" 
                label="Прибыль USDT" 
                sortConfig={sortConfig} 
                onSort={onSort} 
              />
              <SortableHeader 
                table="symbol" 
                sortKey="avg_profit_percent" 
                label="Средний %" 
                sortConfig={sortConfig} 
                onSort={onSort} 
              />
              <SortableHeader 
                table="symbol" 
                sortKey="winrate" 
                label="Винрейт" 
                sortConfig={sortConfig} 
                onSort={onSort} 
              />
            </tr>
          </thead>
          <tbody>
            {sortedData.map((s, idx) => {
              const rank = getRowRank(by_symbol, s, 'total_profit');
              const rowClass = rank === 'top' ? styles.topRow : rank === 'worst' ? styles.worstRow : '';
              
              return (
                <tr 
                  key={idx}
                  className={`${rowClass} ${styles.clickableRow}`}
                  onClick={() => onRowClick(s, 'symbol')}
                  title="Кликните для подробной информации"
                >
                  <td>{s.symbol}</td>
                  <td>{s.total_orders}</td>
                  <td className={s.total_profit >= 0 ? styles.positive : styles.negative}>
                    {s.total_profit.toFixed(2)}
                  </td>
                  <td className={s.avg_profit_percent >= 0 ? styles.positive : styles.negative}>
                    {s.avg_profit_percent.toFixed(2)}%
                  </td>
                  <td className={s.winrate >= 50 ? styles.positive : styles.negative}>
                    {s.winrate.toFixed(1)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/**
 * Топ сделок (прибыльные и убыточные)
 */
export const TopDealsTable = ({ top_profitable, top_losing }) => {
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
              {top_profitable.map((deal, idx) => (
                <tr key={idx}>
                  <td>#{deal.id}</td>
                  <td>{deal.symbol || '-'}</td>
                  <td>{deal.strategy || '-'}</td>
                  <td className={styles.positive}>{deal.profit.toFixed(2)} USDT</td>
                  <td className={styles.positive}>{deal.profit_percent.toFixed(2)}%</td>
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
              {top_losing.map((deal, idx) => (
                <tr key={idx}>
                  <td>#{deal.id}</td>
                  <td>{deal.symbol || '-'}</td>
                  <td>{deal.strategy || '-'}</td>
                  <td className={styles.negative}>{deal.profit.toFixed(2)} USDT</td>
                  <td className={styles.negative}>{deal.profit_percent.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};




