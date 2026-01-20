import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import api from '../api/api';
import styles from './ProfitChart.module.css';

const ProfitChart = ({ serverId }) => {
  const [chartData, setChartData] = useState([]);
  const [period, setPeriod] = useState('day'); // day, week, month
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (serverId) {
      loadChartData();
    }
  }, [serverId, period]);

  const loadChartData = async () => {
    if (!serverId) {
      setChartData([]);
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      if (serverId === 'all') {
        // Получаем данные со всех серверов
        const response = await api.get(`/api/profit-chart-all?period=${period}`);
        setChartData(response.data.data || []);
      } else {
        // Получаем данные с конкретного сервера
        const response = await api.get(`/api/servers/${serverId}/orders/profit-chart?period=${period}`);
        setChartData(response.data.data || []);
      }
    } catch (err) {
      console.error('Error loading chart data:', err);
      setError('Ошибка загрузки данных графика');
      setChartData([]);
    } finally {
      setLoading(false);
    }
  };

  const formatProfit = (value) => {
    if (typeof value === 'number') {
      return value.toFixed(4);
    }
    return '0.0000';
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className={styles.tooltip}>
          <p className={styles.tooltipTime}>{payload[0].payload.time}</p>
          <p className={styles.tooltipProfit}>
            Прибыль: <span style={{ color: payload[0].value >= 0 ? '#00ff88' : '#ff4444' }}>
              {formatProfit(payload[0].value)} USDT
            </span>
          </p>
          <p className={styles.tooltipCumulative}>
            Накопленная: <span style={{ color: payload[1].value >= 0 ? '#00ff88' : '#ff4444' }}>
              {formatProfit(payload[1].value)} USDT
            </span>
          </p>
          <p className={styles.tooltipOrders}>
            Сделок: {payload[0].payload.orders_count}
          </p>
        </div>
      );
    }
    return null;
  };

  if (!serverId) {
    return null; // Не показываем ничего если serverId не передан
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>
          📈 График прибыли
          {serverId === 'all' && <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>(Все сервера)</span>}
        </h3>
        <div className={styles.periodSelector}>
          <button
            className={`${styles.periodBtn} ${period === 'day' ? styles.active : ''}`}
            onClick={() => setPeriod('day')}
          >
            24 часа
          </button>
          <button
            className={`${styles.periodBtn} ${period === 'week' ? styles.active : ''}`}
            onClick={() => setPeriod('week')}
          >
            7 дней
          </button>
          <button
            className={`${styles.periodBtn} ${period === 'month' ? styles.active : ''}`}
            onClick={() => setPeriod('month')}
          >
            30 дней
          </button>
        </div>
      </div>

      {loading && <div className={styles.loading}>Загрузка данных...</div>}
      {error && <div className={styles.error}>{error}</div>}

      {!loading && !error && chartData.length === 0 && (
        <div className={styles.noData}>
          <p>📊 Нет данных за выбранный период</p>
          <small>Закрытые сделки появятся на графике автоматически</small>
        </div>
      )}

      {!loading && chartData.length > 0 && (
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00f5ff" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#00f5ff" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="colorCumulative" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00ff88" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#00ff88" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a1f3a" />
            <XAxis 
              dataKey="time" 
              stroke="#8b949e"
              style={{ fontSize: '12px' }}
            />
            <YAxis 
              stroke="#8b949e"
              style={{ fontSize: '12px' }}
              tickFormatter={formatProfit}
            />
            <Tooltip 
              content={<CustomTooltip />} 
              cursor={{ stroke: 'rgba(255, 255, 255, 0.2)', strokeWidth: 1 }}
            />
            <Legend 
              wrapperStyle={{ fontSize: '14px', color: '#c9d1d9' }}
              formatter={(value) => {
                if (value === 'profit') return 'Прибыль за период';
                if (value === 'cumulative_profit') return 'Накопленная прибыль';
                return value;
              }}
            />
            <Area
              type="monotone"
              dataKey="profit"
              stroke="#00f5ff"
              fillOpacity={1}
              fill="url(#colorProfit)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="cumulative_profit"
              stroke="#00ff88"
              fillOpacity={1}
              fill="url(#colorCumulative)"
              strokeWidth={3}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default ProfitChart;

