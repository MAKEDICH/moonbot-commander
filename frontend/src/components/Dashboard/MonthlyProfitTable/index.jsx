/**
 * Таблица прибыли по дням за месяц
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FiCalendar, FiChevronLeft, FiChevronRight, FiCheck, FiShare2 } from 'react-icons/fi';
import { dashboardAPI } from '../../../api/api';
import styles from '../../../pages/Dashboard-profit.module.css';
import { MONTHS, formatMonthData } from './utils';
import CopyMenu from './CopyMenu';
import ProfitTableRow from './ProfitTableRow';
import ProfitFooter from './ProfitFooter';

/**
 * Таблица прибыли по дням за месяц
 */
const MonthlyProfitTable = () => {
    const currentDate = new Date();
    const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth());
    const [selectedYear] = useState(currentDate.getFullYear());
    const [profitData, setProfitData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [copied, setCopied] = useState(false);

    // Состояние меню копирования
    const [showCopyMenu, setShowCopyMenu] = useState(false);
    const [copyPeriod, setCopyPeriod] = useState(() => {
        const saved = localStorage.getItem('profitTableCopyPeriod');
        return saved ? parseInt(saved, 10) : 1;
    });
    const [copyLoading, setCopyLoading] = useState(false);
    const [copyOptions, setCopyOptions] = useState(() => {
        const saved = localStorage.getItem('profitTableCopyOptions');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch {
                // Используем дефолтные
            }
        }
        return {
            header: true,
            table: true,
            weekdays: true,
            ordersCount: true,
            totals: true,
            stats: true
        };
    });
    const copyMenuRef = useRef(null);

    // Сохранение настроек копирования в localStorage
    useEffect(() => {
        localStorage.setItem('profitTableCopyOptions', JSON.stringify(copyOptions));
    }, [copyOptions]);

    // Сохранение периода копирования
    useEffect(() => {
        localStorage.setItem('profitTableCopyPeriod', copyPeriod.toString());
    }, [copyPeriod]);

    useEffect(() => {
        loadMonthlyProfit();
    }, [selectedMonth, selectedYear]);

    // Закрытие меню при клике вне его
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (copyMenuRef.current && !copyMenuRef.current.contains(event.target)) {
                setShowCopyMenu(false);
            }
        };

        if (showCopyMenu) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showCopyMenu]);

    const loadMonthlyProfit = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await dashboardAPI.getMonthlyProfit(selectedYear, selectedMonth + 1);
            setProfitData(response.data.days || []);
        } catch (err) {
            console.error('Error loading monthly profit:', err);
            setError('Ошибка загрузки данных');
            setProfitData([]);
        } finally {
            setLoading(false);
        }
    };

    const handlePrevMonth = () => {
        if (selectedMonth > 0) {
            setSelectedMonth(selectedMonth - 1);
        }
    };

    const handleNextMonth = () => {
        const now = new Date();
        if (selectedMonth < now.getMonth() || selectedYear < now.getFullYear()) {
            setSelectedMonth(selectedMonth + 1);
        }
    };

    // Расчёт общей прибыли за месяц
    const totalProfit = profitData.reduce((sum, day) => sum + (day.profit || 0), 0);
    const profitableDays = profitData.filter(d => d.profit > 0).length;
    const losingDays = profitData.filter(d => d.profit < 0).length;

    // Проверка, можно ли переключить на следующий месяц
    const now = new Date();
    const canGoNext = selectedMonth < now.getMonth() || selectedYear < now.getFullYear();
    const canGoPrev = selectedMonth > 0;

    /**
     * Переключение опции копирования
     */
    const toggleCopyOption = (option) => {
        setCopyOptions(prev => ({
            ...prev,
            [option]: !prev[option]
        }));
    };

    /**
     * Загрузка данных за несколько месяцев
     */
    const loadMultipleMonths = useCallback(async (monthsCount) => {
        const results = [];
        const now = new Date();

        for (let i = 0; i < monthsCount; i++) {
            let targetMonth = selectedMonth - i;
            let targetYear = selectedYear;

            while (targetMonth < 0) {
                targetMonth += 12;
                targetYear -= 1;
            }

            if (targetYear > now.getFullYear() ||
                (targetYear === now.getFullYear() && targetMonth > now.getMonth())) {
                continue;
            }

            try {
                const response = await dashboardAPI.getMonthlyProfit(targetYear, targetMonth + 1);
                results.push({
                    month: targetMonth,
                    year: targetYear,
                    days: response.data.days || []
                });
            } catch (err) {
                console.error(`Error loading month ${targetMonth + 1}/${targetYear}:`, err);
            }
        }

        return results.sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;
            return a.month - b.month;
        });
    }, [selectedMonth, selectedYear]);

    /**
     * Копирование таблицы в формате для Telegram
     */
    const copyToClipboard = async () => {
        setCopyLoading(true);

        try {
            let text = '';

            // Заголовок
            if (copyOptions.header) {
                text += `**✦ MOONBOT COMMANDER ✦**\n`;
                text += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
            }

            // Загружаем данные за выбранный период
            if (copyPeriod === 1) {
                if (copyOptions.table) {
                    text += formatMonthData({ month: selectedMonth, year: selectedYear, days: profitData }, copyOptions);
                    text += '\n';
                } else if (copyOptions.totals) {
                    const sign = totalProfit >= 0 ? '+' : '';
                    const emoji = totalProfit >= 0 ? '✅' : '❌';
                    text += `📅 **${MONTHS[selectedMonth]} ${selectedYear}**\n`;
                    text += `${emoji} **ИТОГО: ${sign}${totalProfit.toFixed(2)} USDT**\n`;
                    if (copyOptions.stats) {
                        text += `📈 Прибыльных: **${profitableDays}** дн. | 📉 Убыточных: **${losingDays}** дн.\n`;
                    }
                }
            } else {
                const monthsData = await loadMultipleMonths(copyPeriod);

                let grandTotal = 0;
                let grandProfitable = 0;
                let grandLosing = 0;

                monthsData.forEach(monthData => {
                    if (copyOptions.table) {
                        text += formatMonthData(monthData, copyOptions);
                        text += '\n';
                    } else if (copyOptions.totals) {
                        const monthProfit = monthData.days.reduce((sum, d) => sum + (d.profit || 0), 0);
                        const sign = monthProfit >= 0 ? '+' : '';
                        const emoji = monthProfit >= 0 ? '✅' : '❌';
                        text += `📅 ${MONTHS[monthData.month]} ${monthData.year}: ${emoji} **${sign}${monthProfit.toFixed(2)} USDT**\n`;
                    }

                    grandTotal += monthData.days.reduce((sum, d) => sum + (d.profit || 0), 0);
                    grandProfitable += monthData.days.filter(d => d.profit > 0).length;
                    grandLosing += monthData.days.filter(d => d.profit < 0).length;
                });

                if (copyOptions.totals && monthsData.length > 1) {
                    text += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
                    const sign = grandTotal >= 0 ? '+' : '';
                    const emoji = grandTotal >= 0 ? '🏆' : '💔';
                    text += `${emoji} **ВСЕГО за ${copyPeriod} мес: ${sign}${grandTotal.toFixed(2)} USDT**\n`;
                    if (copyOptions.stats) {
                        text += `📈 Прибыльных: **${grandProfitable}** дн. | 📉 Убыточных: **${grandLosing}** дн.`;
                    }
                }
            }

            text = text.trim();

            await navigator.clipboard.writeText(text);
            setCopied(true);
            setShowCopyMenu(false);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        } finally {
            setCopyLoading(false);
        }
    };

    return (
        <div className={styles.section}>
            <div className={styles.sectionHeader}>
                <h2><FiCalendar /> Прибыль по дням</h2>
                {profitData.length > 0 && !loading && (
                    <div className={styles.copyMenuWrapper} ref={copyMenuRef}>
                        <button
                            className={`${styles.shareBtn} ${copied ? styles.copied : ''}`}
                            onClick={() => setShowCopyMenu(!showCopyMenu)}
                            title="Скопировать для Telegram"
                        >
                            {copied ? (
                                <>
                                    <FiCheck /> Скопировано!
                                </>
                            ) : (
                                <>
                                    <FiShare2 /> Поделиться
                                </>
                            )}
                        </button>

                        {showCopyMenu && (
                            <CopyMenu
                                copyOptions={copyOptions}
                                toggleCopyOption={toggleCopyOption}
                                copyPeriod={copyPeriod}
                                setCopyPeriod={setCopyPeriod}
                                copyToClipboard={copyToClipboard}
                                copyLoading={copyLoading}
                            />
                        )}
                    </div>
                )}
            </div>

            {/* Выбор месяца */}
            <div className={styles.monthSelector}>
                <button
                    className={styles.monthNavBtn}
                    onClick={handlePrevMonth}
                    disabled={!canGoPrev}
                    title="Предыдущий месяц"
                >
                    <FiChevronLeft />
                </button>

                <div className={styles.monthDisplay}>
                    <span className={styles.monthName}>{MONTHS[selectedMonth]}</span>
                    <span className={styles.monthYear}>{selectedYear}</span>
                </div>

                <button
                    className={styles.monthNavBtn}
                    onClick={handleNextMonth}
                    disabled={!canGoNext}
                    title="Следующий месяц"
                >
                    <FiChevronRight />
                </button>
            </div>

            {/* Контент */}
            {loading ? (
                <div className={styles.loadingSection}>Загрузка...</div>
            ) : error ? (
                <div className={styles.errorSection}>{error}</div>
            ) : profitData.length === 0 ? (
                <div className={styles.emptySection}>
                    <FiCalendar size={32} />
                    <p>Нет данных за {MONTHS[selectedMonth]}</p>
                </div>
            ) : (
                <>
                    {/* Таблица по дням */}
                    <div className={styles.profitTable}>
                        <div className={styles.profitTableHeader}>
                            <span className={styles.profitTableDay}>День</span>
                            <span className={styles.profitTableValue}>Прибыль (USDT)</span>
                        </div>

                        <div className={styles.profitTableBody}>
                            {profitData.map((day) => (
                                <ProfitTableRow key={day.date} day={day} />
                            ))}
                        </div>
                    </div>

                    {/* Итого за месяц */}
                    <ProfitFooter
                        selectedMonth={selectedMonth}
                        totalProfit={totalProfit}
                        profitableDays={profitableDays}
                        losingDays={losingDays}
                    />
                </>
            )}
        </div>
    );
};

export default MonthlyProfitTable;

