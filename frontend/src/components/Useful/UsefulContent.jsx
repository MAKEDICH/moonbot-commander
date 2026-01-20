/**
 * Компонент контента для страницы Полезное
 * Отображает содержимое в зависимости от выбранных вкладок
 * Упрощённая версия без дат листинга
 */

import React, { useMemo } from 'react';
import styles from '../../pages/Useful.module.css';
import { BaseTabs } from './UsefulTabs';
import { UpbitMarketsTable, IntersectionTable } from './UsefulTables';
import { UPBIT_BASE_MARKET_COMBINATIONS } from './usefulUtils';

/**
 * Контент для вкладки "Upbit по базам"
 */
export const UpbitBasesContent = ({
    grouped,
    tickers,
    normalizedExternal,
    activeBaseTab,
    setActiveBaseTab,
    preferredBaseOrder
}) => {
    // Сортировка баз
    const bases = useMemo(() => {
        return Object.keys(grouped).sort((a, b) => {
            const ia = preferredBaseOrder.indexOf(a);
            const ib = preferredBaseOrder.indexOf(b);
            if (ia !== -1 || ib !== -1) {
                return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
            }
            return a.localeCompare(b);
        });
    }, [grouped, preferredBaseOrder]);
    
    // Создание комбинаций для вкладок
    const baseCombinations = useMemo(() => {
        return bases.map(base => ({
            id: base.toLowerCase(),
            label: base,
            bases: [base]
        }));
    }, [bases]);
    
    // Текущая база
    const currentBase = useMemo(() => {
        const found = bases.find(b => b.toLowerCase() === activeBaseTab);
        return found || bases[0] || 'KRW';
    }, [bases, activeBaseTab]);
    
    const markets = grouped[currentBase] || [];
    
    return (
        <div className={styles.contentSection}>
            <BaseTabs
                combinations={baseCombinations}
                activeTab={activeBaseTab}
                onTabChange={setActiveBaseTab}
            />
            
            <div className={styles.sectionCard}>
                <h3 className={styles.sectionTitle}>
                    Upbit {currentBase} ({markets.length})
                </h3>
                
                <UpbitMarketsTable
                    markets={markets}
                    tickers={tickers}
                    normalizedExternal={normalizedExternal}
                />
            </div>
        </div>
    );
};

/**
 * Контент для вкладки "Upbit (внутренние базы)"
 */
export const UpbitInternalContent = ({
    normalizedUpbitByBase,
    activeComboTab,
    setActiveComboTab
}) => {
    // Текущая комбинация
    const currentCombo = useMemo(() => {
        return UPBIT_BASE_MARKET_COMBINATIONS.find(c => c.id === activeComboTab) 
            || UPBIT_BASE_MARKET_COMBINATIONS[0];
    }, [activeComboTab]);
    
    // Данные пересечения
    const intersectionData = useMemo(() => {
        const normSets = currentCombo.bases.map(base => ({
            label: `Upbit ${base}`,
            set: normalizedUpbitByBase[base]?.set || new Set()
        }));
        
        // Пересечение множеств
        const sets = normSets.map(x => x.set);
        let result = new Set(sets[0] || []);
        for (let i = 1; i < sets.length; i++) {
            result = new Set([...result].filter(x => sets[i].has(x)));
        }
        
        return {
            coins: Array.from(result),
            count: result.size,
            setsWithLabels: normSets
        };
    }, [currentCombo, normalizedUpbitByBase]);
    
    return (
        <div className={styles.contentSection}>
            <BaseTabs
                combinations={UPBIT_BASE_MARKET_COMBINATIONS}
                activeTab={activeComboTab}
                onTabChange={setActiveComboTab}
            />
            
            <IntersectionTable
                coins={intersectionData.coins}
                count={intersectionData.count}
                setsWithLabels={intersectionData.setsWithLabels}
                title={currentCombo.label}
            />
        </div>
    );
};

/**
 * Контент для сравнения с внешними биржами (Spot)
 */
export const SpotComparisonContent = ({
    type, // 'binance' | 'bybit' | 'binance-bybit'
    normalizedUpbitByBase,
    normalizedExternal,
    activeComboTab,
    setActiveComboTab
}) => {
    // Текущая комбинация
    const currentCombo = useMemo(() => {
        return UPBIT_BASE_MARKET_COMBINATIONS.find(c => c.id === activeComboTab) 
            || UPBIT_BASE_MARKET_COMBINATIONS[0];
    }, [activeComboTab]);
    
    // Построение множеств для сравнения
    const setsBuilder = useMemo(() => {
        // Upbit множество
        const upbitSets = currentCombo.bases.map(b => normalizedUpbitByBase[b]?.set || new Set());
        let upbitSet = new Set(upbitSets[0] || []);
        for (let i = 1; i < upbitSets.length; i++) {
            upbitSet = new Set([...upbitSet].filter(x => upbitSets[i].has(x)));
        }
        
        const result = [
            { label: `Upbit (${currentCombo.label})`, set: upbitSet }
        ];
        
        if (type === 'binance' || type === 'binance-bybit') {
            result.push({
                label: 'Binance Spot',
                set: normalizedExternal.binanceSpot?.set || new Set(),
                map: normalizedExternal.binanceSpot?.map,
                source: 'bin'
            });
        }
        
        if (type === 'bybit' || type === 'binance-bybit') {
            result.push({
                label: 'Bybit Spot',
                set: normalizedExternal.bybitSpot?.set || new Set(),
                map: normalizedExternal.bybitSpot?.map,
                source: 'bb'
            });
        }
        
        return result;
    }, [type, currentCombo, normalizedUpbitByBase, normalizedExternal]);
    
    // Данные пересечения
    const intersectionData = useMemo(() => {
        const sets = setsBuilder.map(x => x.set);
        let result = new Set(sets[0] || []);
        for (let i = 1; i < sets.length; i++) {
            result = new Set([...result].filter(x => sets[i].has(x)));
        }
        
        return {
            coins: Array.from(result),
            count: result.size,
            setsWithLabels: setsBuilder
        };
    }, [setsBuilder]);
    
    return (
        <div className={styles.contentSection}>
            <BaseTabs
                combinations={UPBIT_BASE_MARKET_COMBINATIONS}
                activeTab={activeComboTab}
                onTabChange={setActiveComboTab}
            />
            
            <IntersectionTable
                coins={intersectionData.coins}
                count={intersectionData.count}
                setsWithLabels={intersectionData.setsWithLabels}
                title={currentCombo.label}
            />
        </div>
    );
};

/**
 * Контент для сравнения с фьючерсами внешних бирж
 */
export const FuturesComparisonContent = ({
    type, // 'binance' | 'bybit' | 'binance-bybit'
    normalizedUpbitByBase,
    normalizedExternal,
    activeComboTab,
    setActiveComboTab
}) => {
    // Текущая комбинация
    const currentCombo = useMemo(() => {
        return UPBIT_BASE_MARKET_COMBINATIONS.find(c => c.id === activeComboTab) 
            || UPBIT_BASE_MARKET_COMBINATIONS[0];
    }, [activeComboTab]);
    
    // Построение множеств для сравнения
    const setsBuilder = useMemo(() => {
        // Upbit множество
        const upbitSets = currentCombo.bases.map(b => normalizedUpbitByBase[b]?.set || new Set());
        let upbitSet = new Set(upbitSets[0] || []);
        for (let i = 1; i < upbitSets.length; i++) {
            upbitSet = new Set([...upbitSet].filter(x => upbitSets[i].has(x)));
        }
        
        const result = [
            { label: `Upbit (${currentCombo.label})`, set: upbitSet }
        ];
        
        if (type === 'binance' || type === 'binance-bybit') {
            result.push({
                label: 'Binance Futures',
                set: normalizedExternal.binanceFutures?.set || new Set(),
                map: normalizedExternal.binanceFutures?.map,
                source: 'bin'
            });
        }
        
        if (type === 'bybit' || type === 'binance-bybit') {
            result.push({
                label: 'Bybit Futures',
                set: normalizedExternal.bybitFutures?.set || new Set(),
                map: normalizedExternal.bybitFutures?.map,
                source: 'bb'
            });
        }
        
        return result;
    }, [type, currentCombo, normalizedUpbitByBase, normalizedExternal]);
    
    // Данные пересечения
    const intersectionData = useMemo(() => {
        const sets = setsBuilder.map(x => x.set);
        let result = new Set(sets[0] || []);
        for (let i = 1; i < sets.length; i++) {
            result = new Set([...result].filter(x => sets[i].has(x)));
        }
        
        return {
            coins: Array.from(result),
            count: result.size,
            setsWithLabels: setsBuilder
        };
    }, [setsBuilder]);
    
    return (
        <div className={styles.contentSection}>
            <BaseTabs
                combinations={UPBIT_BASE_MARKET_COMBINATIONS}
                activeTab={activeComboTab}
                onTabChange={setActiveComboTab}
            />
            
            <IntersectionTable
                coins={intersectionData.coins}
                count={intersectionData.count}
                setsWithLabels={intersectionData.setsWithLabels}
                title={currentCombo.label}
            />
        </div>
    );
};

export default {
    UpbitBasesContent,
    UpbitInternalContent,
    SpotComparisonContent,
    FuturesComparisonContent
};
