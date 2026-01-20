/**
 * Индекс страха и жадности + мониторинг Bitcoin
 * 
 * Отображает текущий индекс страха и жадности, доминацию BTC,
 * цену BTC и исторический график.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FiRefreshCw } from 'react-icons/fi';
import styles from './FearGreedIndex.module.css';
import { CHART_PERIODS, getColorByValue } from './constants';
import { FearGreedGauge, DataCard, ChartSection } from './components';

/**
 * Интерполяция Fear & Greed значений между дневными точками
 */
const interpolateFearGreed = (fearGreedMap, timestamp) => {
    const dateKey = new Date(timestamp).toISOString().split('T')[0];
    const value = fearGreedMap.get(dateKey);
    if (value !== undefined) return value;

    const sortedDates = Array.from(fearGreedMap.keys()).sort();
    let prevDate = null;
    let nextDate = null;

    for (const date of sortedDates) {
        const dateTs = new Date(date).getTime();
        if (dateTs <= timestamp) prevDate = date;
        if (dateTs > timestamp && !nextDate) nextDate = date;
    }

    if (prevDate && nextDate) {
        const prevValue = fearGreedMap.get(prevDate);
        const nextValue = fearGreedMap.get(nextDate);
        const prevTs = new Date(prevDate).getTime();
        const nextTs = new Date(nextDate).getTime();
        const ratio = (timestamp - prevTs) / (nextTs - prevTs);
        return Math.round(prevValue + (nextValue - prevValue) * ratio);
    }

    return prevDate ? fearGreedMap.get(prevDate) : (nextDate ? fearGreedMap.get(nextDate) : null);
};

/**
 * Главный компонент
 */
const FearGreedIndex = () => {
    const [fearGreed, setFearGreed] = useState({ value: 0, classification: 'Загрузка...' });
    const [btcDominance, setBtcDominance] = useState(null);
    const [btcPrice, setBtcPrice] = useState(null);
    const [allHistoricalData, setAllHistoricalData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState(null);
    const [error, setError] = useState(null);
    const [chartLoading, setChartLoading] = useState(true);
    const [chartPeriod, setChartPeriod] = useState('30');

    /**
     * Загрузка индекса страха и жадности
     */
    const fetchFearGreedIndex = useCallback(async () => {
        try {
            const response = await fetch('https://api.alternative.me/fng/?limit=1');
            const data = await response.json();
            if (data?.data?.[0]) {
                setFearGreed({
                    value: parseInt(data.data[0].value),
                    classification: data.data[0].value_classification
                });
            }
        } catch (err) {
            console.error('Error fetching fear & greed:', err);
        }
    }, []);

    /**
     * Загрузка доминации Bitcoin
     */
    const fetchBtcDominance = useCallback(async () => {
        try {
            const response = await fetch('https://api.coingecko.com/api/v3/global');
            const data = await response.json();
            if (data?.data?.market_cap_percentage?.btc !== undefined) {
                setBtcDominance(data.data.market_cap_percentage.btc.toFixed(2));
            }
        } catch (err) {
            console.error('Error fetching BTC dominance:', err);
        }
    }, []);

    /**
     * Загрузка цены Bitcoin
     */
    const fetchBtcPrice = useCallback(async () => {
        try {
            const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
            const data = await response.json();
            if (data?.bitcoin?.usd !== undefined) {
                setBtcPrice(data.bitcoin.usd);
            }
        } catch (err) {
            console.error('Error fetching BTC price:', err);
        }
    }, []);

    /**
     * Загрузка исторических данных с кэшированием
     */
    const fetchHistoricalData = useCallback(async () => {
        const cacheKey = 'feargreed_chart_cache_v8';
        const cacheTimeKey = 'feargreed_chart_time_v8';
        const cached = localStorage.getItem(cacheKey);
        const cacheTime = localStorage.getItem(cacheTimeKey);

        if (cached && cacheTime) {
            const age = Date.now() - parseInt(cacheTime);
            if (age < 10 * 60 * 1000) {
                try {
                    const data = JSON.parse(cached);
                    if (data.length > 0) {
                        setAllHistoricalData(data);
                        setChartLoading(false);
                        return;
                    }
                } catch (e) {}
            }
        }

        setChartLoading(true);
        try {
            const [btcResponse, fgResponse] = await Promise.allSettled([
                fetch('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=90'),
                fetch('https://api.alternative.me/fng/?limit=90')
            ]);

            let btcPrices = [];
            let fearGreedMap = new Map();

            if (btcResponse.status === 'fulfilled') {
                const data = await btcResponse.value.json();
                if (data?.prices && Array.isArray(data.prices)) {
                    btcPrices = data.prices.map(item => ({
                        timestamp: item[0],
                        price: Math.round(item[1])
                    }));
                }
            }

            if (fgResponse.status === 'fulfilled') {
                const data = await fgResponse.value.json();
                if (data?.data && Array.isArray(data.data)) {
                    data.data.forEach(item => {
                        const dateKey = new Date(parseInt(item.timestamp) * 1000).toISOString().split('T')[0];
                        fearGreedMap.set(dateKey, parseInt(item.value));
                    });
                }
            }

            const combinedData = btcPrices.map(item => {
                const date = new Date(item.timestamp);
                return {
                    timestamp: item.timestamp,
                    fullDate: date.toISOString().split('T')[0],
                    btcPrice: item.price,
                    fearGreed: interpolateFearGreed(fearGreedMap, item.timestamp)
                };
            }).filter(item => item.btcPrice !== null);

            console.log(`[FearGreed] Loaded ${combinedData.length} data points for chart`);
            setAllHistoricalData(combinedData);

            localStorage.setItem(cacheKey, JSON.stringify(combinedData));
            localStorage.setItem(cacheTimeKey, Date.now().toString());
        } catch (err) {
            console.error('Error fetching historical data:', err);
        } finally {
            setChartLoading(false);
        }
    }, []);

    /**
     * Загрузка всех данных
     */
    const fetchAllData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            await Promise.all([
                fetchFearGreedIndex(),
                fetchBtcDominance(),
                fetchBtcPrice(),
                fetchHistoricalData()
            ]);
            setLastUpdate(new Date());
        } catch (err) {
            setError('Ошибка загрузки данных');
        } finally {
            setLoading(false);
        }
    }, [fetchFearGreedIndex, fetchBtcDominance, fetchBtcPrice, fetchHistoricalData]);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    /**
     * Форматирование цены
     */
    const formatPrice = (price) => {
        if (!price) return '—';
        return '$' + price.toLocaleString('en-US', { maximumFractionDigits: 0 });
    };

    /**
     * Данные для графика
     */
    const chartData = useMemo(() => {
        if (!allHistoricalData.length) return [];

        const periodConfig = CHART_PERIODS.find(p => p.id === chartPeriod) || CHART_PERIODS[0];
        const days = periodConfig.days;
        const cutoffDate = Date.now() - (days * 24 * 60 * 60 * 1000);

        const filtered = allHistoricalData.filter(item => item.timestamp >= cutoffDate);

        console.log(`[FearGreed] Period: ${days} days, Chart points: ${filtered.length}`);

        return filtered.map((item, index) => {
            const date = new Date(item.timestamp);
            const tooltipDate = date.toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'short',
                year: '2-digit'
            });

            return {
                ...item,
                idx: index,
                tooltipDate: tooltipDate
            };
        });
    }, [allHistoricalData, chartPeriod]);

    return (
        <div className={styles.container}>
            {/* Заголовок */}
            <div className={styles.header}>
                <h2 className={styles.title}>
                    Fear & Greed Index
                </h2>
                <button
                    onClick={fetchAllData}
                    className={`${styles.refreshBtn} ${loading ? styles.spinning : ''}`}
                    disabled={loading}
                    title="Обновить данные"
                >
                    <FiRefreshCw />
                </button>
            </div>

            {error && (
                <div className={styles.error}>{error}</div>
            )}

            {/* Главный индикатор */}
            <div className={styles.mainIndicator}>
                <FearGreedGauge
                    value={fearGreed.value}
                    classification={fearGreed.classification}
                />
            </div>

            {/* Карточки данных */}
            <div className={styles.dataCards}>
                <DataCard
                    title="Fear & Greed"
                    value={`${fearGreed.value} • ${fearGreed.classification}`}
                    color={getColorByValue(fearGreed.value)}
                    loading={loading && !fearGreed.value}
                />
                <DataCard
                    title="BTC Dominance"
                    value={btcDominance ? `${btcDominance}%` : '—'}
                    color="#818cf8"
                    loading={loading && !btcDominance}
                />
                <DataCard
                    title="BTC Price"
                    value={formatPrice(btcPrice)}
                    color="#f7931a"
                    loading={loading && !btcPrice}
                />
            </div>

            {/* График */}
            <ChartSection
                chartData={chartData}
                chartLoading={chartLoading}
                chartPeriod={chartPeriod}
                onPeriodChange={setChartPeriod}
            />

            {/* Последнее обновление */}
            {lastUpdate && (
                <div className={styles.lastUpdate}>
                    Последнее обновление: {lastUpdate.toLocaleTimeString('ru-RU')}
                </div>
            )}
        </div>
    );
};

export default FearGreedIndex;
