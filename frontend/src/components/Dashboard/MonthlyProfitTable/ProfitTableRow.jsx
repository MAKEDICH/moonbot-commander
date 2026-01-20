/**
 * Строка таблицы прибыли
 */

import React from 'react';
import { FiTrendingUp, FiTrendingDown } from 'react-icons/fi';
import styles from '../../../pages/Dashboard-profit.module.css';
import { formatDay, formatWeekday } from './utils';

/**
 * Компонент строки таблицы
 */
const ProfitTableRow = ({ day }) => {
    const isProfit = day.profit >= 0;
    const isWeekend = ['Сб', 'Вс'].includes(formatWeekday(day.date));

    return (
        <div
            className={`${styles.profitTableRow} ${isWeekend ? styles.weekend : ''}`}
        >
            <div className={styles.profitTableDay}>
                <span className={styles.dayNumber}>{formatDay(day.date)}</span>
                <span className={styles.dayWeekday}>{formatWeekday(day.date)}</span>
            </div>
            <div className={`${styles.profitTableValue} ${isProfit ? styles.profitPositive : styles.profitNegative}`}>
                {day.orders_count > 0 ? (
                    <>
                        <span className={styles.profitIcon}>
                            {isProfit ? <FiTrendingUp /> : <FiTrendingDown />}
                        </span>
                        <span>{isProfit ? '+' : ''}{day.profit.toFixed(2)}</span>
                        <span className={styles.ordersCount}>({day.orders_count})</span>
                    </>
                ) : (
                    <span className={styles.noTrades}>—</span>
                )}
            </div>
        </div>
    );
};

export default ProfitTableRow;

