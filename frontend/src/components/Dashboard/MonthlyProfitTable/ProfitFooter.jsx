/**
 * Футер таблицы прибыли
 */

import React from 'react';
import { FiTrendingUp, FiTrendingDown } from 'react-icons/fi';
import styles from '../../../pages/Dashboard-profit.module.css';
import { MONTHS } from './utils';

/**
 * Компонент футера с итогами
 */
const ProfitFooter = ({ selectedMonth, totalProfit, profitableDays, losingDays }) => {
    return (
        <div className={styles.profitTableFooter}>
            <div className={styles.profitTotalRow}>
                <span className={styles.profitTotalLabel}>Итого за {MONTHS[selectedMonth]}:</span>
                <span className={`${styles.profitTotalValue} ${totalProfit >= 0 ? styles.profitPositive : styles.profitNegative}`}>
                    {totalProfit >= 0 ? '+' : ''}{totalProfit.toFixed(2)} USDT
                </span>
            </div>
            <div className={styles.profitStats}>
                <span className={styles.profitStatItem}>
                    <FiTrendingUp className={styles.profitStatIconPositive} />
                    {profitableDays} дней в плюс
                </span>
                <span className={styles.profitStatItem}>
                    <FiTrendingDown className={styles.profitStatIconNegative} />
                    {losingDays} дней в минус
                </span>
            </div>
        </div>
    );
};

export default ProfitFooter;

