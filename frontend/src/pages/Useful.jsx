/**
 * Страница "Полезное" - контейнер для различных полезных инструментов
 * Содержит подвкладки: UPBIT, Сравнение стратегий и другие
 */

import React, { useState, Suspense, lazy } from 'react';
import styles from './Useful.module.css';

// Lazy loading для секций (загружаются только при открытии)
const UpbitSection = lazy(() => import('../components/Useful/UpbitSection'));
const StrategyCompareSection = lazy(() => import('../components/Useful/StrategyCompare/StrategyCompareSection'));
const CryptoSessionsSection = lazy(() => import('../components/Useful/CryptoSessions/CryptoSessionsSection'));
const FearGreedSection = lazy(() => import('../components/Useful/FearGreedIndex/FearGreedSection'));
const BinanceAlphaSection = lazy(() => import('../components/Useful/BinanceAlpha/BinanceAlphaSection'));
const TriggersHubSection = lazy(() => import('../components/Useful/TriggersHub/TriggersHubSection'));

/**
 * Конфигурация подвкладок страницы Полезное
 */
const USEFUL_TABS = [
    { id: 'upbit', label: 'UPBIT', icon: '📊' },
    { id: 'strategy-compare', label: 'Сравнение стратегий', icon: '⚖️' },
    { id: 'crypto-sessions', label: 'Торговые сессии', icon: '🕐' },
    { id: 'fear-greed', label: 'Индекс страха', icon: '😱' },
    { id: 'binance-alpha', label: 'Binance Alpha', icon: '🚀' },
    { id: 'triggers-hub', label: 'Хаб триггеров', icon: '🔀' }
];

/**
 * Заглушка для загрузки секции
 */
const SectionLoader = () => (
    <div className={styles.sectionLoader}>
        <div className={styles.loaderSpinner}></div>
        <span>Загрузка...</span>
    </div>
);

/**
 * Главный компонент страницы Полезное
 */
const Useful = () => {
    const [activeTab, setActiveTab] = useState('upbit');
    
    /**
     * Рендер контента активной вкладки
     */
    const renderContent = () => {
        switch (activeTab) {
            case 'fear-greed':
                return (
                    <Suspense fallback={<SectionLoader />}>
                        <FearGreedSection />
                    </Suspense>
                );
            
            case 'binance-alpha':
                return (
                    <Suspense fallback={<SectionLoader />}>
                        <BinanceAlphaSection />
                    </Suspense>
                );
            
            case 'upbit':
                return (
                    <Suspense fallback={<SectionLoader />}>
                        <UpbitSection />
                    </Suspense>
                );
            
            case 'strategy-compare':
                return (
                    <Suspense fallback={<SectionLoader />}>
                        <StrategyCompareSection />
                    </Suspense>
                );
            
            case 'triggers-hub':
                return (
                    <Suspense fallback={<SectionLoader />}>
                        <TriggersHubSection />
                    </Suspense>
                );
            
            case 'crypto-sessions':
                return (
                    <Suspense fallback={<SectionLoader />}>
                        <CryptoSessionsSection />
                    </Suspense>
                );
            
            default:
                return null;
        }
    };
    
    return (
        <div className={styles.container}>
            {/* Заголовок страницы */}
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>🔧 Полезное</h1>
                <p className={styles.pageDescription}>
                    Инструменты и данные для анализа рынков
                </p>
            </div>
            
            {/* Главные вкладки страницы */}
            <div className={styles.usefulTabs}>
                {USEFUL_TABS.map(tab => (
                    <button
                        key={tab.id}
                        className={`${styles.usefulTab} ${activeTab === tab.id ? styles.active : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        <span className={styles.tabIcon}>{tab.icon}</span>
                        {tab.label}
                    </button>
                ))}
            </div>
            
            {/* Контент активной вкладки */}
            <div className={styles.usefulContent}>
                {renderContent()}
            </div>
        </div>
    );
};

export default Useful;
