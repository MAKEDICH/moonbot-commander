/**
 * Компоненты вкладок для страницы Полезное
 */

import React from 'react';
import styles from '../../pages/Useful.module.css';

/**
 * Главные вкладки (SPOT / FUTURES)
 */
export const MainTabs = ({ activeTab, onTabChange }) => {
    const tabs = [
        { id: 'spot', label: 'SPOT', icon: '📊' },
        { id: 'futures', label: 'FUTURES', icon: '📈' }
    ];
    
    return (
        <div className={styles.mainTabs}>
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    className={`${styles.mainTab} ${activeTab === tab.id ? styles.active : ''}`}
                    onClick={() => onTabChange(tab.id)}
                >
                    <span className={styles.tabIcon}>{tab.icon}</span>
                    {tab.label}
                </button>
            ))}
        </div>
    );
};

/**
 * Подвкладки для SPOT
 */
export const SpotSubTabs = ({ activeTab, onTabChange }) => {
    const tabs = [
        { id: 'upbit-bases', label: 'Upbit по базам' },
        { id: 'upbit-internal', label: 'Upbit (внутренние базы)' },
        { id: 'upbit-binance', label: 'Upbit & Binance Spot' },
        { id: 'upbit-bybit', label: 'Upbit & Bybit Spot' },
        { id: 'upbit-binance-bybit', label: 'Upbit & Binance & Bybit Spot' }
    ];
    
    return (
        <div className={styles.subTabs}>
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    className={`${styles.subTab} ${activeTab === tab.id ? styles.active : ''}`}
                    onClick={() => onTabChange(tab.id)}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );
};

/**
 * Подвкладки для FUTURES
 */
export const FuturesSubTabs = ({ activeTab, onTabChange }) => {
    const tabs = [
        { id: 'upbit-binance', label: 'Upbit & Binance Futures' },
        { id: 'upbit-bybit', label: 'Upbit & Bybit Futures' },
        { id: 'upbit-binance-bybit', label: 'Upbit & Binance & Bybit Futures' }
    ];
    
    return (
        <div className={styles.subTabs}>
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    className={`${styles.subTab} ${activeTab === tab.id ? styles.active : ''}`}
                    onClick={() => onTabChange(tab.id)}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );
};

/**
 * Вкладки баз (KRW, BTC, USDT и их комбинации)
 */
export const BaseTabs = ({ combinations, activeTab, onTabChange }) => {
    return (
        <div className={styles.baseTabs}>
            {combinations.map(combo => (
                <button
                    key={combo.id}
                    className={`${styles.baseTab} ${activeTab === combo.id ? styles.active : ''}`}
                    onClick={() => onTabChange(combo.id)}
                >
                    {combo.label}
                </button>
            ))}
        </div>
    );
};

export default { MainTabs, SpotSubTabs, FuturesSubTabs, BaseTabs };



