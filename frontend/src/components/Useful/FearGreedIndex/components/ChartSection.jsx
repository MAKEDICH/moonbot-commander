/**
 * Секция графика Fear & Greed
 */

import React from 'react';
import {
    ComposedChart,
    Line,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';
import styles from '../FearGreedIndex.module.css';
import CustomTooltip from './CustomTooltip';
import { CHART_PERIODS } from '../constants';

/**
 * Секция с графиком
 */
const ChartSection = ({ 
    chartData, 
    chartLoading, 
    chartPeriod, 
    onPeriodChange 
}) => {
    return (
        <div className={styles.chartSection}>
            <div className={styles.chartHeader}>
                <h3 className={styles.chartTitle}>
                    Historical Chart
                </h3>
                <div className={styles.periodButtons}>
                    {CHART_PERIODS.map(period => (
                        <button
                            key={period.id}
                            className={`${styles.periodBtn} ${chartPeriod === period.id ? styles.active : ''}`}
                            onClick={() => onPeriodChange(period.id)}
                        >
                            {period.label}
                        </button>
                    ))}
                </div>
            </div>
            <div className={styles.chartWrapper}>
                {chartLoading ? (
                    <div className={styles.chartLoading}>
                        <span>Загрузка...</span>
                    </div>
                ) : chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                            data={chartData}
                            margin={{ top: 20, right: 60, left: 20, bottom: 20 }}
                        >
                            <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="rgba(255,255,255,0.05)"
                            />
                            <XAxis
                                dataKey="idx"
                                type="number"
                                domain={['dataMin', 'dataMax']}
                                stroke="#718096"
                                tick={{ fill: '#718096', fontSize: 11 }}
                                tickCount={10}
                                tickFormatter={(idx) => {
                                    const item = chartData[idx];
                                    if (!item) return '';
                                    const date = new Date(item.timestamp);
                                    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
                                }}
                            />
                            <YAxis
                                yAxisId="left"
                                stroke="#f7931a"
                                tick={{ fill: '#f7931a', fontSize: 11 }}
                                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                                domain={['auto', 'auto']}
                            />
                            <YAxis
                                yAxisId="right"
                                orientation="right"
                                stroke="#8b5cf6"
                                tick={{ fill: '#8b5cf6', fontSize: 11 }}
                                domain={[0, 100]}
                            />
                            <Tooltip
                                content={<CustomTooltip />}
                                cursor={{ stroke: 'rgba(255,255,255,0.3)', strokeWidth: 1 }}
                                isAnimationActive={false}
                                allowEscapeViewBox={{ x: true, y: true }}
                                wrapperStyle={{ pointerEvents: 'none' }}
                            />
                            <Legend
                                wrapperStyle={{ paddingTop: '10px' }}
                                formatter={(value) => <span style={{ color: '#a0aec0' }}>{value}</span>}
                            />
                            <Area
                                yAxisId="left"
                                type="monotone"
                                dataKey="btcPrice"
                                name="Цена BTC"
                                stroke="#f7931a"
                                fill="rgba(247, 147, 26, 0.15)"
                                strokeWidth={2}
                                dot={false}
                                activeDot={{ r: 6, fill: '#f7931a', stroke: '#fff', strokeWidth: 2 }}
                                connectNulls
                                isAnimationActive={false}
                            />
                            <Line
                                yAxisId="right"
                                type="monotone"
                                dataKey="fearGreed"
                                name="Fear & Greed"
                                stroke="#8b5cf6"
                                strokeWidth={2}
                                dot={false}
                                activeDot={{ r: 6, fill: '#8b5cf6', stroke: '#fff', strokeWidth: 2 }}
                                connectNulls
                                isAnimationActive={false}
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                ) : (
                    <div className={styles.chartLoading}>
                        <span>Нет данных для отображения</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChartSection;

