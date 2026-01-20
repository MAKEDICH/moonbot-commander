/**
 * API функции для страницы Полезное (Upbit Market Data)
 * Использует backend proxy для надежности (кэширование, обход rate-limit)
 */

import {
    buildNormalizedIndex,
    groupUpbitMarkets
} from './usefulUtils';

// Определяем базовый URL API
const getApiBaseUrl = () => {
    if (import.meta.env.DEV) {
        return ''; // Vite proxy в dev режиме
    }
    // Production: используем тот же хост
    return `${window.location.protocol}//${window.location.hostname}:3000`;
};

const API_BASE = getApiBaseUrl();

/**
 * Загрузка всех данных через backend proxy (оптимизированно)
 * Backend кэширует данные на 5 минут - быстро и надежно
 */
async function loadAllDataViaBackend(onProgress) {
    onProgress?.(10, 'Загрузка данных через сервер...');
    
    try {
        const response = await fetch(`${API_BASE}/api/upbit/all-data`, {
            cache: 'no-store'
        });
        
        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }
        
        const data = await response.json();
        
        onProgress?.(50, 'Обработка данных Upbit...');
        
        // Преобразуем markets в grouped структуру
        const markets = data.markets || [];
        const grouped = groupUpbitMarkets(markets);
        
        // Преобразуем tickers array в Map
        const tickers = new Map();
        for (const t of (data.tickers || [])) {
            tickers.set(t.market, t);
        }
        
        // Строим нормализованные индексы для Upbit
        const normalizedByBase = {};
        for (const base of Object.keys(grouped)) {
            const coins = new Set((grouped[base] || []).map(m => m.split('-')[1]));
            normalizedByBase[base] = buildNormalizedIndex(coins);
        }
        
        onProgress?.(70, 'Обработка внешних бирж...');
        
        // Преобразуем external данные
        const external = {
            binanceSpot: data.external?.binanceSpot ? new Set(data.external.binanceSpot) : null,
            bybitSpot: data.external?.bybitSpot ? new Set(data.external.bybitSpot) : null,
            binanceFutures: data.external?.binanceFutures ? new Set(data.external.binanceFutures) : null,
            bybitFutures: data.external?.bybitFutures ? new Set(data.external.bybitFutures) : null
        };
        
        // Нормализуем external
        const normalizedExternal = {};
        for (const [key, set] of Object.entries(external)) {
            if (set) {
                normalizedExternal[key] = buildNormalizedIndex(set);
            }
        }
        
        onProgress?.(90, 'Готово');
        
        // Проверяем ошибки от backend
        const errors = data.errors || [];
        
        return {
            upbit: { markets, grouped, tickers, normalizedByBase },
            external,
            normalizedExternal,
            errors // Передаём ошибки для отображения
        };
        
    } catch (e) {
        console.error('[UPBIT API] Backend error:', e);
        throw e;
    }
}

/**
 * Fallback: прямые запросы к биржам (если backend недоступен)
 */
async function loadUpbitDataDirect(onProgress) {
    onProgress?.(5, 'Загрузка рынков Upbit (direct)...');
    
    const UPBIT_API_URL = 'https://api.upbit.com/v1';
    
    // 1. Загружаем markets
    const marketsRes = await fetch(`${UPBIT_API_URL}/market/all`);
    if (!marketsRes.ok) throw new Error(`Upbit markets: ${marketsRes.status}`);
    const markets = await marketsRes.json();
    
    const grouped = groupUpbitMarkets(markets);
    const marketList = Object.values(grouped).flat();
    
    onProgress?.(20, 'Загрузка тикеров Upbit...');
    
    // 2. Загружаем тикеры чанками
    const tickers = new Map();
    const chunkSize = 100;
    const chunks = [];
    for (let i = 0; i < marketList.length; i += chunkSize) {
        chunks.push(marketList.slice(i, i + chunkSize));
    }
    
    let done = 0;
    for (const chunk of chunks) {
        try {
            const url = `${UPBIT_API_URL}/ticker?markets=${chunk.join(',')}`;
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                for (const t of data) {
                    tickers.set(t.market, t);
                }
            }
        } catch (e) {
            // Игнорируем ошибки отдельных чанков
        }
        done++;
        onProgress?.(20 + Math.round((done / chunks.length) * 30), `Тикеры: ${done}/${chunks.length}`);
    }
    
    // 3. Нормализованные индексы
    const normalizedByBase = {};
    for (const base of Object.keys(grouped)) {
        const coins = new Set((grouped[base] || []).map(m => m.split('-')[1]));
        normalizedByBase[base] = buildNormalizedIndex(coins);
    }
    
    return { markets, grouped, tickers, normalizedByBase };
}

async function loadExternalDataDirect(onProgress) {
    onProgress?.(55, 'Загрузка внешних бирж...');
    
    const external = {
        binanceSpot: null,
        bybitSpot: null,
        binanceFutures: null,
        bybitFutures: null
    };
    const normalizedExternal = {};
    
    // Binance Spot
    try {
        const res = await fetch('https://api.binance.com/api/v3/exchangeInfo');
        if (res.ok) {
            const data = await res.json();
            external.binanceSpot = new Set(data.symbols.flatMap(s => [s.baseAsset, s.quoteAsset]));
            normalizedExternal.binanceSpot = buildNormalizedIndex(external.binanceSpot);
        }
    } catch (e) { /* ignore */ }
    
    onProgress?.(65, 'Bybit Spot...');
    
    // Bybit Spot
    try {
        const res = await fetch('https://api.bybit.com/v5/market/instruments-info?category=spot&limit=1000');
        if (res.ok) {
            const data = await res.json();
            if (data.retCode === 0) {
                external.bybitSpot = new Set(data.result.list.flatMap(i => [i.baseCoin, i.quoteCoin]));
                normalizedExternal.bybitSpot = buildNormalizedIndex(external.bybitSpot);
            }
        }
    } catch (e) { /* ignore */ }
    
    onProgress?.(75, 'Binance Futures...');
    
    // Binance Futures
    try {
        const res = await fetch('https://fapi.binance.com/fapi/v1/exchangeInfo');
        if (res.ok) {
            const data = await res.json();
            external.binanceFutures = new Set(
                data.symbols.filter(s => s.contractType === 'PERPETUAL').map(s => s.baseAsset)
            );
            normalizedExternal.binanceFutures = buildNormalizedIndex(external.binanceFutures);
        }
    } catch (e) { /* ignore */ }
    
    onProgress?.(85, 'Bybit Futures...');
    
    // Bybit Futures
    try {
        const res = await fetch('https://api.bybit.com/v5/market/instruments-info?category=linear&limit=1000');
        if (res.ok) {
            const data = await res.json();
            if (data.retCode === 0) {
                external.bybitFutures = new Set(data.result.list.map(i => i.baseCoin));
                normalizedExternal.bybitFutures = buildNormalizedIndex(external.bybitFutures);
            }
        }
    } catch (e) { /* ignore */ }
    
    return { external, normalizedExternal };
}

/**
 * Загрузка ВСЕХ данных
 * Сначала пробуем через backend (быстро, кэшировано)
 * Если не получается - прямые запросы к биржам
 */
export async function loadAllDataOptimized(onProgress) {
    // Пробуем через backend (рекомендуется)
    try {
        const result = await loadAllDataViaBackend(onProgress);
        
        // Если есть ошибки от backend - логируем но не падаем
        if (result.errors && result.errors.length > 0) {
            console.warn('[UPBIT] Backend warnings:', result.errors);
        }
        
        return result;
    } catch (backendError) {
        console.warn('[UPBIT] Backend failed, trying direct:', backendError.message);
        
        // Fallback на прямые запросы
        onProgress?.(0, 'Переключение на прямые запросы...');
        
        try {
            const upbitData = await loadUpbitDataDirect(onProgress);
            const externalData = await loadExternalDataDirect(onProgress);
            
            onProgress?.(95, 'Готово (direct mode)');
            
            return {
                upbit: upbitData,
                external: externalData.external,
                normalizedExternal: externalData.normalizedExternal,
                errors: ['Использован прямой режим загрузки']
            };
        } catch (directError) {
            throw new Error(`Не удалось загрузить данные: ${directError.message}`);
        }
    }
}

/**
 * Отмена запросов (заглушка для совместимости)
 */
export function abortAllRequests() {
    // Не используется - как в оригинале
}
