import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import styles from '../../pages/TradingStats.module.css';

const COLORS = ['#00C49F', '#0088FE', '#FFBB28', '#FF8042', '#8884d8'];

/**
 * Круговая диаграмма распределения прибыли по стратегиям
 */
const StrategyPieChart = ({ byStrategy }) => {
  const pieData = byStrategy.slice(0, 5).map(s => ({
    name: s.strategy,
    value: Math.abs(s.total_profit)
  }));

  if (pieData.length === 0) {
    return null;
  }

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
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default StrategyPieChart;



