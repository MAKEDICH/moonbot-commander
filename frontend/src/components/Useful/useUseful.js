/**
 * Хук для управления состоянием страницы Полезное (Upbit Market Data)
 * Быстрая загрузка данных напрямую с бирж
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { loadAllDataOptimized, abortAllRequests } from './usefulApi';
import {
    intersectionSets,
    UPBIT_BASE_MARKET_COMBINATIONS,
    PREFERRED_BASE_ORDER
} from './usefulUtils';

/**
 * Начальное состояние данных
 */
const initialState = {
    upbitMarkets: [],
    upbitGrouped: {},
    upbitTickers: new Map(),
    external: {
        binanceSpot: null,
        bybitSpot: null,
        binanceFutures: null,
        bybitFutures: null
    },
    normalizedUpbitByBase: {},
    normalizedExternal: {
        binanceSpot: null,
        bybitSpot: null,
        binanceFutures: null,
        bybitFutures: null
    }
};

/**
 * Хук для страницы Полезное
 */
export default function useUseful() {
    const [state, setState] = useState(initialState);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [progress, setProgress] = useState({ value: 0, text: 'Ожидание...' });
    const [status, setStatus] = useState('Загрузка...');
    
    // Активные вкладки
    const [activeMainTab, setActiveMainTab] = useState('spot');
    const [activeSpotSubTab, setActiveSpotSubTab] = useState('upbit-bases');
    const [activeFuturesSubTab, setActiveFuturesSubTab] = useState('upbit-binance');
    const [activeBaseTab, setActiveBaseTab] = useState('krw');
    const [activeComboTab, setActiveComboTab] = useState('krw');
    
    // Ref для отслеживания монтирования
    const isMountedRef = useRef(true);
    const isLoadingRef = useRef(false);
    
    // Обновление прогресса
    const updateProgress = useCallback((value, text) => {
        if (isMountedRef.current) {
            setProgress({ value, text });
        }
    }, []);
    
    // Загрузка всех данных
    const loadAllData = useCallback(async () => {
        // Предотвращаем параллельные загрузки
        if (isLoadingRef.current) {
            return;
        }
        
        isLoadingRef.current = true;
        setError(null);
        setLoading(true);
        setStatus('Загрузка...');
        updateProgress(0, 'Подготовка');
        
        try {
            const data = await loadAllDataOptimized(updateProgress);
            
            // Если запрос устарел или компонент размонтирован
            if (!data || !isMountedRef.current) {
                isLoadingRef.current = false;
                return;
            }
            
            // Обновляем состояние
            setState({
                upbitMarkets: data.upbit.markets,
                upbitGrouped: data.upbit.grouped,
                upbitTickers: data.upbit.tickers,
                normalizedUpbitByBase: data.upbit.normalizedByBase,
                external: data.external,
                normalizedExternal: data.normalizedExternal
            });
            
            // Проверяем данные
            const hasMarkets = data.upbit.markets.length > 0;
            const hasTickers = data.upbit.tickers.size > 0;
            
            if (!hasMarkets || !hasTickers) {
                setError('Не удалось загрузить данные Upbit');
                setStatus('Ошибка');
            } else {
                setError(null);
                setStatus('Готово');
            }
            
        } catch (e) {
            if (isMountedRef.current) {
                setError(`Ошибка загрузки: ${e.message}`);
                setStatus('Ошибка');
            }
        } finally {
            if (isMountedRef.current) {
                setLoading(false);
            }
            isLoadingRef.current = false;
        }
    }, [updateProgress]);
    
    // Получение нормализованного множества Upbit для баз
    const getUpbitNormForBases = useCallback((bases) => {
        if (!bases || !bases.length) return new Set();
        const sets = bases.map(b => state.normalizedUpbitByBase[b]?.set || new Set());
        return intersectionSets(sets);
    }, [state.normalizedUpbitByBase]);
    
    // Получение данных для пересечения
    const getIntersectionData = useCallback((setsWithLabels) => {
        const sets = setsWithLabels.map(x => x.set);
        const inter = intersectionSets(sets);
        return {
            coins: Array.from(inter),
            count: inter.size,
            setsWithLabels
        };
    }, []);
    
    // Загрузка при монтировании
    useEffect(() => {
        isMountedRef.current = true;
        loadAllData();
        
        return () => {
            isMountedRef.current = false;
            abortAllRequests();
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    
    return {
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
        getUpbitNormForBases,
        getIntersectionData,
        baseCombinations: UPBIT_BASE_MARKET_COMBINATIONS,
        preferredBaseOrder: PREFERRED_BASE_ORDER
    };
}
