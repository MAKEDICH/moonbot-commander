/**
 * Таблица ордеров Orders
 */

import React, { useState } from 'react';
import { FaCheckCircle, FaTimesCircle, FaTrash, FaChartLine } from 'react-icons/fa';
import styles from '../../pages/Orders.module.css';
import { formatDate, formatPercent, sortOrders } from './ordersUtils';
import { useNotification } from '../../context/NotificationContext';

export default function OrdersTable({
  orders,
  loading,
  loadingProgress,
  selectedServer,
  visibleColumns,
  sortBy,
  sortOrder,
  page,
  totalPages,
  onSort,
  onDeleteOrder,
  onPageChange,
  onRowClick
}) {
  const { error: showError } = useNotification();
  const [pageInput, setPageInput] = useState('');
  
  // Применяем сортировку
  const sortedOrders = sortOrders(orders, sortBy, sortOrder);

  // Обработчик быстрого перехода на страницу
  const handleGoToPage = () => {
    const pageNum = parseInt(pageInput);
    if (isNaN(pageNum) || pageNum < 1 || pageNum > totalPages) {
      showError(`Введите номер страницы от 1 до ${totalPages}`);
      setPageInput('');
      return;
    }
    onPageChange(pageNum);
    setPageInput('');
  };

  // Обработчик нажатия Enter в поле ввода
  const handlePageInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleGoToPage();
    }
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        Загрузка...
        {selectedServer === 'all' && loadingProgress > 0 && (
          <div className={styles.progressBar}>
            <div 
              className={styles.progressFill} 
              style={{ width: `${loadingProgress}%` }}
            />
            <span className={styles.progressText}>{loadingProgress}%</span>
          </div>
        )}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className={styles.empty}>
        <FaChartLine size={48} />
        <p>Ордеров пока нет</p>
        <small>Listener будет сохранять ордера автоматически</small>
      </div>
    );
  }

  return (
    <>
      <div className={styles.tableWrapper}>
        <table className={styles.ordersTable}>
          <thead>
            <tr>
              {visibleColumns.id && (
                <th className={styles.stickyCol} onClick={() => onSort('moonbot_order_id')} style={{ cursor: 'pointer' }}>
                  ID {sortBy === 'moonbot_order_id' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
              )}
              {visibleColumns.taskId && (
                <th onClick={() => onSort('task_id')} style={{ cursor: 'pointer' }}>
                  Task ID {sortBy === 'task_id' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
              )}
              {visibleColumns.botName && (
                <th onClick={() => onSort('bot_name')} style={{ cursor: 'pointer' }}>
                  Название бота {sortBy === 'bot_name' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
              )}
              {visibleColumns.type && (
                <th onClick={() => onSort('is_emulator')} style={{ cursor: 'pointer' }}>
                  Тип {sortBy === 'is_emulator' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
              )}
              {visibleColumns.status && (
                <th onClick={() => onSort('status')} style={{ cursor: 'pointer' }}>
                  Статус {sortBy === 'status' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
              )}
              {visibleColumns.symbol && (
                <th onClick={() => onSort('symbol')} style={{ cursor: 'pointer' }}>
                  Символ {sortBy === 'symbol' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
              )}
              {visibleColumns.buyPrice && (
                <th onClick={() => onSort('buy_price')} style={{ cursor: 'pointer' }}>
                  Цена покупки {sortBy === 'buy_price' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
              )}
              {visibleColumns.sellPrice && (
                <th onClick={() => onSort('sell_price')} style={{ cursor: 'pointer' }}>
                  Цена продажи {sortBy === 'sell_price' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
              )}
              {visibleColumns.quantity && (
                <th onClick={() => onSort('quantity')} style={{ cursor: 'pointer' }}>
                  Количество {sortBy === 'quantity' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
              )}
              {visibleColumns.profitUSDT && (
                <th onClick={() => onSort('profit_btc')} style={{ cursor: 'pointer' }}>
                  Прибыль USDT {sortBy === 'profit_btc' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
              )}
              {visibleColumns.profitPercent && (
                <th onClick={() => onSort('profit_percent')} style={{ cursor: 'pointer' }}>
                  Прибыль % {sortBy === 'profit_percent' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
              )}
              {visibleColumns.delta1h && (
                <th onClick={() => onSort('exchange_1h_delta')} style={{ cursor: 'pointer' }}>
                  Δ 1h % {sortBy === 'exchange_1h_delta' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
              )}
              {visibleColumns.delta24h && (
                <th onClick={() => onSort('exchange_24h_delta')} style={{ cursor: 'pointer' }}>
                  Δ 24h % {sortBy === 'exchange_24h_delta' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
              )}
              {visibleColumns.delta3h && (
                <th onClick={() => onSort('d3h')} style={{ cursor: 'pointer' }}>
                  Δ 3h % {sortBy === 'd3h' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
              )}
              {visibleColumns.delta5m && (
                <th onClick={() => onSort('d5m')} style={{ cursor: 'pointer' }}>
                  Δ 5m % {sortBy === 'd5m' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
              )}
              {visibleColumns.delta15m && (
                <th onClick={() => onSort('d15m')} style={{ cursor: 'pointer' }}>
                  Δ 15m % {sortBy === 'd15m' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
              )}
              {visibleColumns.delta1m && (
                <th onClick={() => onSort('d1m')} style={{ cursor: 'pointer' }}>
                  Δ 1m % {sortBy === 'd1m' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
              )}
              {visibleColumns.pump1h && (
                <th onClick={() => onSort('pump_1h')} style={{ cursor: 'pointer' }}>
                  Pump 1h % {sortBy === 'pump_1h' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
              )}
              {visibleColumns.dump1h && (
                <th onClick={() => onSort('dump_1h')} style={{ cursor: 'pointer' }}>
                  Dump 1h % {sortBy === 'dump_1h' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
              )}
              {visibleColumns.leverage && (
                <th onClick={() => onSort('lev')} style={{ cursor: 'pointer' }}>
                  Плечо {sortBy === 'lev' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
              )}
              {visibleColumns.bvsvRatio && (
                <th onClick={() => onSort('bvsv_ratio')} style={{ cursor: 'pointer' }}>
                  BV/SV {sortBy === 'bvsv_ratio' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
              )}
              {visibleColumns.isShort && (
                <th onClick={() => onSort('is_short')} style={{ cursor: 'pointer' }}>
                  Short {sortBy === 'is_short' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
              )}
              {visibleColumns.hvol && (
                <th onClick={() => onSort('hvol')} style={{ cursor: 'pointer' }}>
                  hVol {sortBy === 'hvol' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
              )}
              {visibleColumns.hvolf && (
                <th onClick={() => onSort('hvolf')} style={{ cursor: 'pointer' }}>
                  hVolF {sortBy === 'hvolf' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
              )}
              {visibleColumns.dvol && (
                <th onClick={() => onSort('dvol')} style={{ cursor: 'pointer' }}>
                  dVol {sortBy === 'dvol' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
              )}
              {visibleColumns.signalType && (
                <th onClick={() => onSort('signal_type')} style={{ cursor: 'pointer' }}>
                  Сигнал {sortBy === 'signal_type' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
              )}
              {visibleColumns.sellReason && (
                <th onClick={() => onSort('sell_reason')} style={{ cursor: 'pointer' }}>
                  Причина {sortBy === 'sell_reason' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
              )}
              {visibleColumns.strategy && (
                <th onClick={() => onSort('strategy')} style={{ cursor: 'pointer' }}>
                  Стратегия / Task ID {sortBy === 'strategy' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
              )}
              {visibleColumns.openedAt && (
                <th onClick={() => onSort('opened_at')} style={{ cursor: 'pointer' }}>
                  Открыт {(sortBy === 'opened_at' || sortBy === 'openedAt') && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
              )}
              {visibleColumns.closedAt && (
                <th onClick={() => onSort('closed_at')} style={{ cursor: 'pointer' }}>
                  Закрыт {(sortBy === 'closed_at' || sortBy === 'closedAt') && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
              )}
              <th style={{ width: '60px', textAlign: 'center' }}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {sortedOrders.map(order => {
              const profitPercentData = formatPercent(order.profit_percent);
              
              return (
                <tr 
                  key={order.id} 
                  className={`${order.status === 'Open' ? styles.openOrder : ''} ${styles.clickableRow}`}
                  onClick={() => onRowClick && onRowClick(order)}
                  title="Нажмите для просмотра графика"
                >
                  {visibleColumns.id && (
                    <td className={`${styles.orderId} ${styles.stickyCol}`}>#{order.moonbot_order_id}</td>
                  )}
                  {visibleColumns.taskId && (
                    <td className={styles.quantity}>
                      {order.task_id ? `#${order.task_id}` : '-'}
                    </td>
                  )}
                  {visibleColumns.botName && (
                    <td className={styles.botName}>
                      {order.bot_name || '-'}
                    </td>
                  )}
                  {visibleColumns.type && (
                    <td>
                      <span className={order.is_emulator ? styles.emulatorBadge : styles.realBadge}>
                        {order.is_emulator ? '🎮 EMU' : '💰 REAL'}
                      </span>
                    </td>
                  )}
                  {visibleColumns.status && (
                    <td>
                      <span className={`${styles.status} ${order.status === 'Open' ? styles.statusOpen : styles.statusClosed}`}>
                        {order.status === 'Open' ? <FaTimesCircle /> : <FaCheckCircle />}
                        {order.status}
                      </span>
                    </td>
                  )}
                  {visibleColumns.symbol && (
                    <td className={styles.symbol}>{order.symbol}</td>
                  )}
                  {visibleColumns.buyPrice && (
                    <td className={styles.price}>{order.buy_price?.toFixed(8) || '-'}</td>
                  )}
                  {visibleColumns.sellPrice && (
                    <td className={styles.price}>{order.sell_price?.toFixed(8) || '-'}</td>
                  )}
                  {visibleColumns.quantity && (
                    <td className={styles.quantity}>{order.quantity?.toFixed(4) || '-'}</td>
                  )}
                  {visibleColumns.profitUSDT && (
                    <td className={styles.btc}>
                      {order.profit_btc !== null && order.profit_btc !== undefined ? (
                        <span className={order.profit_btc >= 0 ? styles.profitPositive : styles.profitNegative}>
                          {order.profit_btc.toFixed(2)}
                        </span>
                      ) : '-'}
                    </td>
                  )}
                  {visibleColumns.profitPercent && (
                    <td className={styles.percent}>
                      {profitPercentData === '-' ? '-' : (
                        <span className={styles[profitPercentData.className]}>
                          {profitPercentData.value}%
                        </span>
                      )}
                    </td>
                  )}
                  {visibleColumns.delta1h && (
                    <td className={styles.delta}>
                      {order.exchange_1h_delta !== null && order.exchange_1h_delta !== undefined ? (
                        <span className={order.exchange_1h_delta >= 0 ? styles.profitPositive : styles.profitNegative}>
                          {order.exchange_1h_delta.toFixed(2)}%
                        </span>
                      ) : '-'}
                    </td>
                  )}
                  {visibleColumns.delta24h && (
                    <td className={styles.delta}>
                      {order.exchange_24h_delta !== null && order.exchange_24h_delta !== undefined ? (
                        <span className={order.exchange_24h_delta >= 0 ? styles.profitPositive : styles.profitNegative}>
                          {order.exchange_24h_delta.toFixed(2)}%
                        </span>
                      ) : '-'}
                    </td>
                  )}
                  {visibleColumns.delta3h && (
                    <td className={styles.delta}>
                      {order.d3h !== null && order.d3h !== undefined ? `${order.d3h.toFixed(2)}%` : '-'}
                    </td>
                  )}
                  {visibleColumns.delta5m && (
                    <td className={styles.delta}>
                      {order.d5m !== null && order.d5m !== undefined ? `${order.d5m.toFixed(2)}%` : '-'}
                    </td>
                  )}
                  {visibleColumns.delta15m && (
                    <td className={styles.delta}>
                      {order.d15m !== null && order.d15m !== undefined ? `${order.d15m.toFixed(2)}%` : '-'}
                    </td>
                  )}
                  {visibleColumns.delta1m && (
                    <td className={styles.delta}>
                      {order.d1m !== null && order.d1m !== undefined ? `${order.d1m.toFixed(2)}%` : '-'}
                    </td>
                  )}
                  {visibleColumns.pump1h && (
                    <td className={styles.delta}>
                      {order.pump_1h !== null && order.pump_1h !== undefined ? `${order.pump_1h.toFixed(2)}%` : '-'}
                    </td>
                  )}
                  {visibleColumns.dump1h && (
                    <td className={styles.delta}>
                      {order.dump_1h !== null && order.dump_1h !== undefined ? `${order.dump_1h.toFixed(2)}%` : '-'}
                    </td>
                  )}
                  {visibleColumns.leverage && (
                    <td className={styles.quantity}>
                      {order.lev ? `x${order.lev}` : '-'}
                    </td>
                  )}
                  {visibleColumns.bvsvRatio && (
                    <td className={styles.quantity}>
                      {order.bvsv_ratio !== null && order.bvsv_ratio !== undefined ? order.bvsv_ratio.toFixed(2) : '-'}
                    </td>
                  )}
                  {visibleColumns.isShort && (
                    <td className={styles.quantity}>
                      {order.is_short ? 'Да' : 'Нет'}
                    </td>
                  )}
                  {visibleColumns.hvol && (
                    <td className={styles.quantity}>
                      {order.hvol !== null && order.hvol !== undefined ? order.hvol.toFixed(1) : '-'}
                    </td>
                  )}
                  {visibleColumns.hvolf && (
                    <td className={styles.quantity}>
                      {order.hvolf !== null && order.hvolf !== undefined ? order.hvolf.toFixed(1) : '-'}
                    </td>
                  )}
                  {visibleColumns.dvol && (
                    <td className={styles.quantity}>
                      {order.dvol !== null && order.dvol !== undefined ? order.dvol.toFixed(1) : '-'}
                    </td>
                  )}
                  {visibleColumns.signalType && (
                    <td className={styles.quantity}>
                      {order.signal_type || '-'}
                    </td>
                  )}
                  {visibleColumns.sellReason && (
                    <td className={styles.quantity}>
                      {order.sell_reason || '-'}
                    </td>
                  )}
                  {visibleColumns.strategy && (
                    <td className={styles.strategy}>
                      {order.strategy ? (
                        <code>{order.strategy}</code>
                      ) : order.comment && order.comment.trim().startsWith('CPU:') ? (
                        <code>MANUAL</code>
                      ) : order.task_id ? (
                        <code>Task #{order.task_id}</code>
                      ) : '-'}
                    </td>
                  )}
                  {visibleColumns.openedAt && (
                    <td className={styles.date}>{formatDate(order.opened_at)}</td>
                  )}
                  {visibleColumns.closedAt && (
                    <td className={styles.date}>{formatDate(order.closed_at)}</td>
                  )}
                  <td style={{ textAlign: 'center' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // Предотвращаем открытие графика
                        onDeleteOrder(order.server_id, order.id);
                      }}
                      className={styles.deleteBtn}
                      title="Удалить ордер"
                    >
                      <FaTrash />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button 
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            className={styles.pageBtn}
          >
            ← Назад
          </button>
          
          <span className={styles.pageInfo}>
            Страница {page} из {totalPages}
          </span>
          
          <div className={styles.pageJump}>
            <input
              type="number"
              min="1"
              max={totalPages}
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onKeyPress={handlePageInputKeyPress}
              placeholder="№"
              className={styles.pageInput}
            />
            <button
              onClick={handleGoToPage}
              className={styles.goToPageBtn}
              title={`Перейти на страницу (1-${totalPages})`}
            >
              Перейти
            </button>
          </div>
          
          <button 
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
            className={styles.pageBtn}
          >
            Вперед →
          </button>
        </div>
      )}
    </>
  );
}
