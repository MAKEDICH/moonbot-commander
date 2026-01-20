/**
 * Компонент карточки данных
 */

import React from 'react';
import styles from '../FearGreedIndex.module.css';

/**
 * Карточка с данными
 */
const DataCard = ({ title, value, color, loading }) => (
    <div className={styles.dataCard}>
        <div className={styles.cardContent}>
            <span className={styles.cardTitle}>{title}</span>
            <span
                className={styles.cardValue}
                style={{ color: color || '#fff' }}
            >
                {loading ? '...' : value}
            </span>
        </div>
    </div>
);

export default DataCard;

