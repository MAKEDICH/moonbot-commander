/**
 * Секция UPBIT для страницы Полезное
 * Содержит весь функционал работы с Upbit и сравнения с биржами
 */

import React from 'react';
import styles from '../../pages/Useful.module.css';
import useUseful from './useUseful';
import UsefulHeader from './UsefulHeader';
import { MainTabs, SpotSubTabs, FuturesSubTabs } from './UsefulTabs';
import {
    UpbitBasesContent,
    UpbitInternalContent,
    SpotComparisonContent,
    FuturesComparisonContent
} from './UsefulContent';

/**
 * Компонент секции UPBIT
 */
const UpbitSection = () => {
    const {
        state,
        loading,
        error,
        progress,
        status,
        activeMainTab,
        setActiveMainTab,
        activeSpotSubTab,
        setActiveSpotSubTab,
        activeFuturesSubTab,
        setActiveFuturesSubTab,
        activeBaseTab,
        setActiveBaseTab,
        activeComboTab,
        setActiveComboTab,
        loadAllData,
        preferredBaseOrder
    } = useUseful();
    
    /**
     * Рендер контента SPOT вкладки
     */
    const renderSpotContent = () => {
        switch (activeSpotSubTab) {
            case 'upbit-bases':
                return (
                    <UpbitBasesContent
                        grouped={state.upbitGrouped}
                        tickers={state.upbitTickers}
                        normalizedExternal={state.normalizedExternal}
                        activeBaseTab={activeBaseTab}
                        setActiveBaseTab={setActiveBaseTab}
                        preferredBaseOrder={preferredBaseOrder}
                    />
                );
            
            case 'upbit-internal':
                return (
                    <UpbitInternalContent
                        normalizedUpbitByBase={state.normalizedUpbitByBase}
                        activeComboTab={activeComboTab}
                        setActiveComboTab={setActiveComboTab}
                    />
                );
            
            case 'upbit-binance':
                return (
                    <SpotComparisonContent
                        type="binance"
                        normalizedUpbitByBase={state.normalizedUpbitByBase}
                        normalizedExternal={state.normalizedExternal}
                        activeComboTab={activeComboTab}
                        setActiveComboTab={setActiveComboTab}
                    />
                );
            
            case 'upbit-bybit':
                return (
                    <SpotComparisonContent
                        type="bybit"
                        normalizedUpbitByBase={state.normalizedUpbitByBase}
                        normalizedExternal={state.normalizedExternal}
                        activeComboTab={activeComboTab}
                        setActiveComboTab={setActiveComboTab}
                    />
                );
            
            case 'upbit-binance-bybit':
                return (
                    <SpotComparisonContent
                        type="binance-bybit"
                        normalizedUpbitByBase={state.normalizedUpbitByBase}
                        normalizedExternal={state.normalizedExternal}
                        activeComboTab={activeComboTab}
                        setActiveComboTab={setActiveComboTab}
                    />
                );
            
            default:
                return null;
        }
    };
    
    /**
     * Рендер контента FUTURES вкладки
     */
    const renderFuturesContent = () => {
        switch (activeFuturesSubTab) {
            case 'upbit-binance':
                return (
                    <FuturesComparisonContent
                        type="binance"
                        normalizedUpbitByBase={state.normalizedUpbitByBase}
                        normalizedExternal={state.normalizedExternal}
                        activeComboTab={activeComboTab}
                        setActiveComboTab={setActiveComboTab}
                    />
                );
            
            case 'upbit-bybit':
                return (
                    <FuturesComparisonContent
                        type="bybit"
                        normalizedUpbitByBase={state.normalizedUpbitByBase}
                        normalizedExternal={state.normalizedExternal}
                        activeComboTab={activeComboTab}
                        setActiveComboTab={setActiveComboTab}
                    />
                );
            
            case 'upbit-binance-bybit':
                return (
                    <FuturesComparisonContent
                        type="binance-bybit"
                        normalizedUpbitByBase={state.normalizedUpbitByBase}
                        normalizedExternal={state.normalizedExternal}
                        activeComboTab={activeComboTab}
                        setActiveComboTab={setActiveComboTab}
                    />
                );
            
            default:
                return null;
        }
    };
    
    return (
        <div className={styles.sectionContainer}>
            <UsefulHeader
                status={status}
                progress={progress}
                error={error}
                loading={loading}
                onRefresh={loadAllData}
            />
            
            <MainTabs
                activeTab={activeMainTab}
                onTabChange={setActiveMainTab}
            />
            
            <div className={styles.tabPanels}>
                {activeMainTab === 'spot' && (
                    <div className={styles.panel}>
                        <SpotSubTabs
                            activeTab={activeSpotSubTab}
                            onTabChange={setActiveSpotSubTab}
                        />
                        <div className={styles.panelContent}>
                            {renderSpotContent()}
                        </div>
                    </div>
                )}
                
                {activeMainTab === 'futures' && (
                    <div className={styles.panel}>
                        <FuturesSubTabs
                            activeTab={activeFuturesSubTab}
                            onTabChange={setActiveFuturesSubTab}
                        />
                        <div className={styles.panelContent}>
                            {renderFuturesContent()}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UpbitSection;

