import React from 'react';
import { LineChart, Line, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import styles from '../../pages/TradingStats.module.css';
import { preparePieData, CHART_COLORS } from './statsUtils';
import { ChangeIndicator } from './StatsMetrics';

/**
 * График прибыли по времени
 */
export const ProfitTimelineChart = ({ profitTimeline, previousPeriod, timePeriod, overall }) => {
  if (profitTimeline.length === 0) return null;
  
  return (
    <div className={styles.section}>
      <h2>📈 Динамика прибыли</h2>
      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={profitTimeline}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          <XAxis 
            dataKey="date" 
            stroke="#00ff88"
            tick={{ fill: '#aaa', fontSize: 12 }}
          />
          <YAxis 
            stroke="#00ff88"
            tick={{ fill: '#aaa', fontSize: 12 }}
          />
          <Tooltip 
            contentStyle={{ 
              background: 'rgba(20, 20, 20, 0.95)', 
              border: '1px solid #00ff88',
              borderRadius: '8px',
              padding: '10px'
            }}
            labelStyle={{ color: '#00ff88' }}
            itemStyle={{ color: '#e5e7eb' }}
          />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="cumulative_profit" 
            stroke="#00ff88" 
            strokeWidth={3}
            name="Накопительная прибыль"
            dot={{ fill: '#00ff88', r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line 
            type="monotone" 
            dataKey="daily_profit" 
            stroke="#667eea" 
            strokeWidth={2}
            name="Дневная прибыль"
            dot={{ fill: '#667eea', r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
      
      {previousPeriod && timePeriod !== 'all' && (
        <div className={styles.comparisonBlock}>
          <div className={styles.comparisonTitle}>
            📊 Сравнение с предыдущим периодом
          </div>
          <div className={styles.comparisonGrid}>
            <div className={styles.comparisonCard}>
              <div className={styles.comparisonLabel}>Прибыль</div>
              <div className={styles.comparisonValue}>
                {overall.total_profit.toFixed(2)} USDT
                <ChangeIndicator value={previousPeriod.profit_change_percent} />
              </div>
              <div className={styles.comparisonDetail}>
                Было: {previousPeriod.prev_total_profit.toFixed(2)} USDT
              </div>
            </div>
            
            <div className={styles.comparisonCard}>
              <div className={styles.comparisonLabel}>Винрейт</div>
              <div className={styles.comparisonValue}>
                {overall.winrate.toFixed(1)}%
                <ChangeIndicator value={previousPeriod.winrate_change} showPercent={false} />
              </div>
              <div className={styles.comparisonDetail}>
                Было: {previousPeriod.prev_winrate.toFixed(1)}%
              </div>
            </div>
            
            <div className={styles.comparisonCard}>
              <div className={styles.comparisonLabel}>Сделок</div>
              <div className={styles.comparisonValue}>
                {overall.total_orders}
                <ChangeIndicator value={previousPeriod.orders_change_percent} />
              </div>
              <div className={styles.comparisonDetail}>
                Было: {previousPeriod.prev_total_orders}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * График винрейта по дням
 */
export const WinrateTimelineChart = ({ winrateTimeline }) => {
  if (winrateTimeline.length === 0) return null;
  
  return (
    <div className={styles.section}>
      <h2>🎯 Динамика винрейта</h2>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={winrateTimeline}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          <XAxis 
            dataKey="date" 
            stroke="#00ff88"
            tick={{ fill: '#aaa', fontSize: 12 }}
          />
          <YAxis 
            stroke="#00ff88"
            tick={{ fill: '#aaa', fontSize: 12 }}
            domain={[0, 100]}
          />
          <Tooltip 
            contentStyle={{ 
              background: 'rgba(20, 20, 20, 0.95)', 
              border: '1px solid #667eea',
              borderRadius: '8px',
              padding: '10px'
            }}
            labelStyle={{ color: '#00ff88' }}
            itemStyle={{ color: '#e5e7eb' }}
          />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="winrate" 
            stroke="#667eea" 
            strokeWidth={3}
            name="Винрейт %"
            dot={{ fill: '#667eea', r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
      
      {winrateTimeline.length >= 7 && (
        <div className={styles.heatmapContainer}>
          <h3 style={{ color: '#00ff88', marginBottom: '15px' }}>🔥 Тепловая карта эффективности</h3>
          <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', color: '#999' }}>
              <span>Винрейт:</span>
              <div className={`${styles.heatmapCell} ${styles.heat1}`} style={{ width: '30px', height: '30px' }}>0-20%</div>
              <div className={`${styles.heatmapCell} ${styles.heat2}`} style={{ width: '30px', height: '30px' }}>20-40%</div>
              <div className={`${styles.heatmapCell} ${styles.heat3}`} style={{ width: '30px', height: '30px' }}>40-60%</div>
              <div className={`${styles.heatmapCell} ${styles.heat4}`} style={{ width: '30px', height: '30px' }}>60-80%</div>
              <div className={`${styles.heatmapCell} ${styles.heat5}`} style={{ width: '30px', height: '30px' }}>80-100%</div>
            </div>
          </div>
          
          <div className={styles.heatmapGrid} style={{ marginTop: '20px' }}>
            <div className={styles.heatmapLabel}></div>
            {Array.from({ length: 7 }, (_, i) => (
              <div key={`day-${i}`} className={styles.heatmapLabel}>
                День {i + 1}
              </div>
            ))}
            
            {['Утро', 'День', 'Вечер'].map((period) => (
              <React.Fragment key={period}>
                <div className={styles.heatmapLabel}>{period}</div>
                {winrateTimeline.slice(-7).map((item, dayIndex) => {
                  const winrate = item.winrate || 0;
                  let heatClass = styles.heat0;
                  if (winrate > 80) heatClass = styles.heat5;
                  else if (winrate > 60) heatClass = styles.heat4;
                  else if (winrate > 40) heatClass = styles.heat3;
                  else if (winrate > 20) heatClass = styles.heat2;
                  else if (winrate > 0) heatClass = styles.heat1;
                  
                  return (
                    <div 
                      key={`${period}-${dayIndex}`}
                      className={`${styles.heatmapCell} ${heatClass}`}
                      title={`${item.date} ${period}: ${winrate.toFixed(1)}% (${item.total_orders} сделок)`}
                    >
                      {winrate > 0 ? winrate.toFixed(0) : '-'}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * График распределения прибыли по стратегиям (Pie Chart)
 */
export const StrategyDistributionPieChart = ({ by_strategy }) => {
  const pieData = preparePieData(by_strategy);
  
  if (pieData.length === 0) return null;
  
  return (
    <div className={styles.section}>
      <h2>🥧 Распределение прибыли по стратегиям</h2>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={(entry) => `${entry.name}: ${entry.value.toFixed(2)}`}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
          >
            {pieData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ 
              background: 'rgba(20, 20, 20, 0.95)', 
              border: '1px solid #667eea',
              borderRadius: '8px',
              padding: '10px'
            }}
            labelStyle={{ color: '#00ff88' }}
            itemStyle={{ color: '#e5e7eb' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

/**
 * Барчарт сравнения ботов
 */
export const ServersComparisonBarChart = ({ by_server }) => {
  if (by_server.length === 0) return null;
  
  return (
    <div className={styles.section}>
      <h2>📊 Сравнение ботов</h2>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={by_server}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          <XAxis dataKey="server_name" stroke="#00ff88" />
          <YAxis stroke="#00ff88" />
          <Tooltip 
            contentStyle={{ 
              background: 'rgba(20, 20, 20, 0.95)', 
              border: '1px solid #00ff88',
              borderRadius: '8px',
              padding: '10px'
            }}
            labelStyle={{ color: '#00ff88' }}
            itemStyle={{ color: '#e5e7eb' }}
            cursor={{ fill: 'rgba(255, 255, 255, 0.1)' }}
          />
          <Legend />
          <Bar dataKey="total_profit" fill="#00ff88" name="Прибыль USDT" />
          <Bar dataKey="total_orders" fill="#667eea" name="Сделок" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};




