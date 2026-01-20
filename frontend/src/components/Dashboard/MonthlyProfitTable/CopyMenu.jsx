/**
 * Меню копирования для таблицы прибыли
 */

import React from 'react';
import { FiCopy } from 'react-icons/fi';
import styles from '../../../pages/Dashboard-profit.module.css';
import { COPY_PERIODS } from './utils';

/**
 * Компонент меню копирования
 */
const CopyMenu = ({
    copyOptions,
    toggleCopyOption,
    copyPeriod,
    setCopyPeriod,
    copyToClipboard,
    copyLoading
}) => {
    return (
        <div className={styles.copyMenu}>
            {/* Выбор периода */}
            <div className={styles.copyMenuSection}>
                <div className={styles.copyMenuLabel}>Период:</div>
                <div className={styles.copyPeriodButtons}>
                    {COPY_PERIODS.map(period => (
                        <button
                            key={period.value}
                            className={`${styles.copyPeriodBtn} ${copyPeriod === period.value ? styles.active : ''}`}
                            onClick={() => setCopyPeriod(period.value)}
                        >
                            {period.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className={styles.copyMenuDivider}></div>

            <div className={styles.copyMenuTitle}>Что включить:</div>

            <label className={styles.copyMenuOption}>
                <input
                    type="checkbox"
                    checked={copyOptions.header}
                    onChange={() => toggleCopyOption('header')}
                />
                <span className={styles.copyMenuCheckbox}></span>
                <span>Заголовок</span>
            </label>

            <label className={styles.copyMenuOption}>
                <input
                    type="checkbox"
                    checked={copyOptions.table}
                    onChange={() => toggleCopyOption('table')}
                />
                <span className={styles.copyMenuCheckbox}></span>
                <span>Таблица по дням</span>
            </label>

            <label className={`${styles.copyMenuOption} ${styles.copyMenuSubOption}`}>
                <input
                    type="checkbox"
                    checked={copyOptions.weekdays}
                    onChange={() => toggleCopyOption('weekdays')}
                    disabled={!copyOptions.table}
                />
                <span className={styles.copyMenuCheckbox}></span>
                <span>↳ Дни недели</span>
            </label>

            <label className={`${styles.copyMenuOption} ${styles.copyMenuSubOption}`}>
                <input
                    type="checkbox"
                    checked={copyOptions.ordersCount}
                    onChange={() => toggleCopyOption('ordersCount')}
                    disabled={!copyOptions.table}
                />
                <span className={styles.copyMenuCheckbox}></span>
                <span>↳ Кол-во сделок</span>
            </label>

            <label className={styles.copyMenuOption}>
                <input
                    type="checkbox"
                    checked={copyOptions.totals}
                    onChange={() => toggleCopyOption('totals')}
                />
                <span className={styles.copyMenuCheckbox}></span>
                <span>Итого за месяц</span>
            </label>

            <label className={styles.copyMenuOption}>
                <input
                    type="checkbox"
                    checked={copyOptions.stats}
                    onChange={() => toggleCopyOption('stats')}
                />
                <span className={styles.copyMenuCheckbox}></span>
                <span>Статистика дней</span>
            </label>

            <button
                className={styles.copyMenuButton}
                onClick={copyToClipboard}
                disabled={!Object.values(copyOptions).some(v => v) || copyLoading}
            >
                {copyLoading ? (
                    <>⏳ Загрузка...</>
                ) : (
                    <><FiCopy /> Скопировать</>
                )}
            </button>
        </div>
    );
};

export default CopyMenu;

