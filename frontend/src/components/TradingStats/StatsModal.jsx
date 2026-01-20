import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import styles from '../../pages/TradingStats.module.css';
import { formatServerDateCompact } from '../../utils/dateUtils';

/**
 * Модальное окно с детальной информацией
 */
const StatsModal = ({
  modalOpen,
  modalData,
  modalType,
  modalDetails,
  modalDetailsLoading,
  onClose
}) => {
  if (!modalOpen || !modalData) return null;
  
  const getTitle = () => {
    switch (modalType) {
      case 'strategy':
        return `📊 Стратегия: ${modalData.strategy}`;
      case 'server':
        return `🤖 Бот: ${modalData.server_name}`;
      case 'symbol':
        return `💰 Монета: ${modalData.symbol}`;
      default:
        return 'Детали';
    }
  };
  
  const getAdvice = () => {
    if (modalData.winrate >= 70) return 'Отличная производительность!';
    if (modalData.winrate >= 50) return 'Стабильная стратегия';
    return 'Требует оптимизации';
  };
  
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContentLarge} onClick={(e) => e.stopPropagation()}>
        <button className={styles.modalClose} onClick={onClose}>✕</button>
        
        <h2 className={styles.modalTitle}>{getTitle()}</h2>
        
        <div className={styles.modalStats}>
          <div className={styles.modalStatCard}>
            <div className={styles.modalStatLabel}>Всего сделок</div>
            <div className={styles.modalStatValue}>{modalData.total_orders}</div>
          </div>
          
          <div className={styles.modalStatCard}>
            <div className={styles.modalStatLabel}>Прибыль</div>
            <div className={`${styles.modalStatValue} ${modalData.total_profit >= 0 ? styles.positive : styles.negative}`}>
              {modalData.total_profit.toFixed(2)} USDT
            </div>
          </div>
          
          {modalData.avg_profit_percent !== undefined && (
            <div className={styles.modalStatCard}>
              <div className={styles.modalStatLabel}>Средний %</div>
              <div className={`${styles.modalStatValue} ${modalData.avg_profit_percent >= 0 ? styles.positive : styles.negative}`}>
                {modalData.avg_profit_percent.toFixed(2)}%
              </div>
            </div>
          )}
          
          <div className={styles.modalStatCard}>
            <div className={styles.modalStatLabel}>Винрейт</div>
            <div className={`${styles.modalStatValue} ${modalData.winrate >= 50 ? styles.positive : styles.negative}`}>
              {modalData.winrate.toFixed(1)}%
            </div>
          </div>
        </div>
        
        {modalDetailsLoading && (
          <div className={styles.modalLoading}>⏳ Загрузка детальной информации...</div>
        )}
        
        {modalDetails && (
          <>
            {modalDetails.profit_timeline && modalDetails.profit_timeline.length > 0 && (
              <div className={styles.modalSection}>
                <h3>📈 График прибыли</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={modalDetails.profit_timeline}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="date" stroke="#00ff88" tick={{ fill: '#aaa', fontSize: 11 }} />
                    <YAxis stroke="#00ff88" tick={{ fill: '#aaa', fontSize: 11 }} />
                    <Tooltip 
                      contentStyle={{ 
                        background: 'rgba(20, 20, 20, 0.95)', 
                        border: '1px solid #00ff88',
                        borderRadius: '8px'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="cumulative_profit" 
                      stroke="#00ff88" 
                      strokeWidth={2}
                      name="Накопительная"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            
            {modalDetails.symbol_distribution && modalDetails.symbol_distribution.length > 0 && (
              <div className={styles.modalSection}>
                <h3>🎯 Распределение по монетам</h3>
                <div className={styles.modalTable}>
                  <table>
                    <thead>
                      <tr>
                        <th>Символ</th>
                        <th>Сделок</th>
                        <th>Прибыль</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modalDetails.symbol_distribution.slice(0, 10).map((item, idx) => (
                        <tr key={idx}>
                          <td>{item.symbol}</td>
                          <td>{item.count}</td>
                          <td className={item.profit >= 0 ? styles.positive : styles.negative}>
                            {item.profit.toFixed(2)} USDT
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            {modalDetails.recent_orders && modalDetails.recent_orders.length > 0 && (
              <div className={styles.modalSection}>
                <h3>📋 Последние сделки</h3>
                <div className={styles.modalTable}>
                  <table>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Символ</th>
                        <th>Тип</th>
                        <th>Закрыто</th>
                        <th>Прибыль</th>
                        <th>%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modalDetails.recent_orders.map((order, idx) => (
                        <tr key={idx}>
                          <td>#{order.id}</td>
                          <td>{order.symbol || '-'}</td>
                          <td>
                            {order.is_emulator ? (
                              <span className={styles.emulatorBadge}>🎮</span>
                            ) : (
                              <span className={styles.realBadge}>💰</span>
                            )}
                          </td>
                          <td style={{ fontSize: '0.85rem' }}>
                            {order.closed_at ? formatServerDateCompact(order.closed_at) : '-'}
                          </td>
                          <td className={order.profit >= 0 ? styles.positive : styles.negative}>
                            {order.profit.toFixed(2)} USDT
                          </td>
                          <td className={order.profit_percent >= 0 ? styles.positive : styles.negative}>
                            {order.profit_percent.toFixed(2)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
        
        <div className={styles.modalNote}>
          💡 <strong>Совет:</strong> {getAdvice()}
        </div>
        
        <div className={styles.modalFooter}>
          <button onClick={onClose} className={styles.modalBtn}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};

export default StatsModal;




