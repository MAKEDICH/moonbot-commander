/**
 * Компонент индикатора страха/жадности - круговой прогресс
 */

import React from 'react';
import styles from '../FearGreedIndex.module.css';

/**
 * Получить цвет по значению индекса
 */
const getColor = (val) => {
    if (val <= 25) return '#ef4444';
    if (val <= 45) return '#f97316';
    if (val <= 55) return '#eab308';
    if (val <= 75) return '#22c55e';
    return '#10b981';
};

/**
 * Компонент круговой шкалы
 */
const FearGreedGauge = ({ value, classification }) => {
    // SVG круговой прогресс
    const radius = 80;
    const stroke = 12;
    const normalizedRadius = radius - stroke / 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const strokeDashoffset = circumference - (value / 100) * circumference;

    const color = getColor(value);

    return (
        <div className={styles.gaugeContainer}>
            <div className={styles.circleGauge}>
                <svg width={radius * 2} height={radius * 2}>
                    {/* Фоновый круг */}
                    <circle
                        stroke="rgba(255,255,255,0.1)"
                        fill="transparent"
                        strokeWidth={stroke}
                        r={normalizedRadius}
                        cx={radius}
                        cy={radius}
                    />
                    {/* Прогресс */}
                    <circle
                        stroke={color}
                        fill="transparent"
                        strokeWidth={stroke}
                        strokeLinecap="round"
                        strokeDasharray={circumference + ' ' + circumference}
                        style={{
                            strokeDashoffset,
                            transition: 'stroke-dashoffset 1s ease-out, stroke 0.5s',
                            transform: 'rotate(-90deg)',
                            transformOrigin: '50% 50%',
                            filter: `drop-shadow(0 0 10px ${color})`
                        }}
                        r={normalizedRadius}
                        cx={radius}
                        cy={radius}
                    />
                </svg>
                <div className={styles.gaugeInner}>
                    <span
                        className={styles.gaugeValue}
                        style={{ color }}
                    >
                        {value}
                    </span>
                    <span className={styles.gaugeLabel}>{classification}</span>
                </div>
            </div>
        </div>
    );
};

export default FearGreedGauge;

