/**
 * API функции для страницы Полезное (Upbit Market Data)
 * Прямые запросы к API бирж - как в оригинальном UPBIT-11.html
 */

import {
    buildNormalizedIndex,
    groupUpbitMarkets
} from './usefulUtils';

// URLs API
const UPBIT_API_URL = 'https://api.upbit.com/v1';
const MAX_MARKETS_PER_REQUEST = 150; // Как в оригинале
const TICKER_CONCURRENCY = 6; // Параллельные запросы тикеров

/**
 * Простой fetch JSON без сложной логики
 */
async function fetchJson(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
}

/**
 * Загрузка данных Upbit - как в оригинале
 */
async function loadUpbitData(onProgress) {
    onProgress?.(5, 'Загрузка рынков Upbit...');
    
    // 1. Загружаем markets
    const markets = await fetchJson(`${UPBIT_API_URL}/market/all`);
    const grouped = groupUpbitMarkets(markets);
    const marketList = Object.values(grouped).flat();
    
    // 2. Разбиваем на чанки по 150 (как в оригинале)
    const chunks = [];
    for (let i = 0; i < marketList.length; i += MAX_MARKETS_PER_REQUEST) {
        chunks.push(marketList.slice(i, i + MAX_MARKETS_PER_REQUEST));
    }
    
    onProgress?.(10, 'Загрузка тикеров Upbit...');
    
    // 3. Параллельная загрузка с ограниченным concurrency (как в оригинале)
    const tickers = new Map();
    let done = 0;
    const total = chunks.length;
    const queue = [...chunks];
    
    async function worker() {
        while (queue.length) {
            const chunk = queue.shift();
            try {
                const url = `${UPBIT_API_URL}/ticker?markets=${chunk.join(',')}`;
                const data = await fetchJson(url);
                for (const t of data) {
                    tickers.set(t.market, t);
                }
            } catch (e) {
                // Игнорируем ошибки отдельных чанков как в оригинале
            }
            done++;
            const pct = Math.round(10 + (done / Math.max(1, total)) * 40);
            onProgress?.(pct, `Загрузка тикеров Upbit: ${done}/${total}`);
        }
    }
    
    // Запускаем воркеры параллельно
    const concurrency = Math.min(TICKER_CONCURRENCY, Math.max(1, total));
    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    
    // 4. Строим нормализованные индексы
    const normalizedByBase = {};
    for (const base of Object.keys(grouped)) {
        const coins = new Set((grouped[base] || []).map(m => m.split('-')[1]));
        normalizedByBase[base] = buildNormalizedIndex(coins);
    }
    
    return { markets, grouped, tickers, normalizedByBase };
}

/**
 * Загрузка данных внешних бирж - как в оригинале
 */
async function loadExternalData(onProgress) {
    onProgress?.(55, 'Загрузка внешних бирж...');
    
    const tasks = [
        fetchJson('https://api.binance.com/api/v3/exchangeInfo')
            .then(data => ({
                key: 'binanceSpot',
                set: new Set(data.symbols.flatMap(s => [s.baseAsset, s.quoteAsset]))
            }))
            .catch(e => ({ key: 'binanceSpot', error: e })),
        
        fetchJson('https://api.bybit.com/v5/market/instruments-info?category=spot&limit=1000')
            .then(data => {
                if (data.retCode !== 0) throw new Error(data.retMsg || 'Bybit error');
                return {
                    key: 'bybitSpot',
                    set: new Set(data.result.list.flatMap(i => [i.baseCoin, i.quoteCoin]))
                };
            })
            .catch(e => ({ key: 'bybitSpot', error: e })),
        
        fetchJson('https://fapi.binance.com/fapi/v1/exchangeInfo')
            .then(data => ({
                key: 'binanceFutures',
                set: new Set(data.symbols.filter(s => s.contractType === 'PERPETUAL').map(s => s.baseAsset))
            }))
            .catch(e => ({ key: 'binanceFutures', error: e })),
        
        fetchJson('https://api.bybit.com/v5/market/instruments-info?category=linear&limit=1000')
            .then(data => {
                if (data.retCode !== 0) throw new Error(data.retMsg || 'Bybit error');
                return {
                    key: 'bybitFutures',
                    set: new Set(data.result.list.map(i => i.baseCoin))
                };
            })
            .catch(e => ({ key: 'bybitFutures', error: e }))
    ];
    
    const results = await Promise.all(tasks);
    
    const external = {
        binanceSpot: null,
        bybitSpot: null,
        binanceFutures: null,
        bybitFutures: null
    };
    const normalizedExternal = {};
    
    for (const r of results) {
        if (r.error) {
            // Игнорируем ошибки отдельных бирж
            continue;
        }
        external[r.key] = r.set;
        normalizedExternal[r.key] = buildNormalizedIndex(r.set);
    }
    
    onProgress?.(80, 'Внешние биржи загружены');
    
    return { external, normalizedExternal };
}

/**
 * Загрузка ВСЕХ данных - как в оригинале resetAndLoadAll
 */
export async function loadAllDataOptimized(onProgress) {
    // Загружаем последовательно как в оригинале
    const upbitData = await loadUpbitData(onProgress);
    const externalData = await loadExternalData(onProgress);
    
    onProgress?.(90, 'Рендер интерфейса...');
    
    return {
        upbit: upbitData,
        external: externalData.external,
        normalizedExternal: externalData.normalizedExternal
    };
}

/**
 * Отмена запросов (заглушка для совместимости)
 */
export function abortAllRequests() {
    // Не используется - как в оригинале
}
