/**
 * Кастомный тултип для графика
 */

import React from 'react';
import styles from '../FearGreedIndex.module.css';

/**
 * Компонент тултипа
 */
const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
        const dateLabel = payload[0]?.payload?.tooltipDate || '';

        return (
            <div className={styles.customTooltip}>
                <p className={styles.tooltipLabel}>{dateLabel}</p>
                {payload.map((entry, index) => (
                    <p key={index} style={{ color: entry.color }}>
                        {entry.name}: {entry.name === 'Цена BTC'
                            ? `$${entry.value?.toLocaleString()}`
                            : entry.value}
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

export default CustomTooltip;

