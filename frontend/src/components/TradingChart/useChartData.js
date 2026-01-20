/**
 * Хук для обработки данных TradingChart
 */
import { useMemo, useCallback } from 'react';
import { MAX_PRICE_POINTS, COLORS } from './constants';
import { formatTime, findClosestPrice } from './utils';

/**
 * Хук для обработки и подготовки данных графика
 */
export const useChartData = (chartData) => {
  const {
    history_prices,
    historical_prices: historical_prices_legacy,
    orders = [],
    trades = [],
    closest_prices = [],
    candles = [],
    stats,
    deltas,
    market_name,
    market_currency,
    strategy_name,
    start_time,
    end_time
  } = chartData || {};

  // Используем history_prices если есть, иначе historical_prices
  const historical_prices = history_prices || historical_prices_legacy || [];

  // Подготовка closest_prices для бинарного поиска
  const sortedClosestPrices = useMemo(() => {
    if (!closest_prices?.length) return [];
    return closest_prices
      .map(cp => ({
        timeMs: new Date(cp.time).getTime(),
        price: cp.price,
      }))
      .sort((a, b) => a.timeMs - b.timeMs);
  }, [closest_prices]);

  // Основные данные цен + SAMPLING
  const priceData = useMemo(() => {
    if (!historical_prices?.length) return [];
    
    let dataToProcess = historical_prices;
    if (historical_prices.length > MAX_PRICE_POINTS) {
      const step = Math.ceil(historical_prices.length / MAX_PRICE_POINTS);
      dataToProcess = historical_prices.filter((_, i) =>
        i === 0 || i === historical_prices.length - 1 || i % step === 0
      );
    }
    
    return dataToProcess.map((p, index) => {
      const time = new Date(p.time);
      const timeMs = time.getTime();
      const closestPrice = findClosestPrice(sortedClosestPrices, timeMs);
      return {
        index,
        timeMs,
        timeLabel: formatTime(timeMs),
        fullTime: p.time,
        price: p.price,
        closestPrice,
      };
    });
  }, [historical_prices, sortedClosestPrices]);

  // Map для lookup timeLabel
  const timeLabelMap = useMemo(() => {
    const map = new Map();
    priceData.forEach(p => map.set(p.timeMs, p.timeLabel));
    return map;
  }, [priceData]);

  // Данные объёмов из candles
  const volumeData = useMemo(() => {
    if (!candles?.length) return [];
    
    return candles.map(candle => {
      const timeMs = new Date(candle.time).getTime();
      const buyVol = candle.buy_volume || 0;
      const sellVol = candle.sell_volume || 0;
      const delta = buyVol - sellVol;
      
      return {
        timeMs,
        buyVolume: buyVol,
        sellVolume: sellVol,
        totalVolume: buyVol + sellVol,
        delta,
        volumeColor: delta >= 0 ? COLORS.BUY : COLORS.SELL,
      };
    });
  }, [candles]);

  // Максимальный объём для масштабирования
  const maxVolume = useMemo(() => {
    if (!volumeData.length) return 1;
    return Math.max(...volumeData.map(v => v.totalVolume)) || 1;
  }, [volumeData]);

  // Данные трейдов (разделение на покупки/продажи)
  const { buyTrades, sellTrades } = useMemo(() => {
    const buys = [];
    const sells = [];
    if (trades?.length > 0) {
      trades.forEach((trade) => {
        const tradeTimeMs = new Date(trade.time).getTime();
        const isSell = trade.price < 0;
        const actualPrice = Math.abs(trade.price);
        const tradePoint = {
          timeMs: tradeTimeMs,
          timeLabel: formatTime(tradeTimeMs),
          fullTime: trade.time,
          price: actualPrice,
          type: isSell ? 'SELL' : 'BUY',
        };
        if (isSell) sells.push(tradePoint);
        else buys.push(tradePoint);
      });
    }
    return { buyTrades: buys, sellTrades: sells };
  }, [trades]);

  // Извлекаем дату из первого трейда для emu ордеров
  const baseDate = useMemo(() => {
    const firstTime = trades?.[0]?.time;
    if (!firstTime) return '';
    const match = firstTime.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : '';
  }, [trades]);

  // Функция парсинга времени ордера
  const parseOrderTime = useCallback((timeStr) => {
    if (!timeStr) return NaN;
    const normalized = timeStr.replace(' ', 'T');
    if (normalized.includes('-')) {
      return new Date(normalized).getTime();
    }
    if (baseDate) {
      return new Date(`${baseDate}T${normalized}`).getTime();
    }
    return new Date(normalized).getTime();
  }, [baseDate]);

  // Данные ордеров
  const { buyOrderOpens, buyOrderCloses, sellOrderOpens, sellOrderCloses } = useMemo(() => {
    const buyOpens = [];
    const buyCloses = [];
    const sellOpens = [];
    const sellCloses = [];
    if (orders?.length > 0) {
      orders.forEach((order, index) => {
        const isBuyOrder = index % 2 === 0;
        const openPoint = {
          timeMs: parseOrderTime(order.open_time),
          price: order.mean_price,
          orderId: order.order_id,
          fullTime: order.open_time,
        };
        const closePoint = {
          timeMs: parseOrderTime(order.close_time),
          price: order.mean_price,
          orderId: order.order_id,
          fullTime: order.close_time,
        };
        if (isBuyOrder) {
          if (order.open_time) buyOpens.push(openPoint);
          if (order.close_time) buyCloses.push(closePoint);
        } else {
          if (order.open_time) sellOpens.push(openPoint);
          if (order.close_time) sellCloses.push(closePoint);
        }
      });
    }
    return { buyOrderOpens: buyOpens, buyOrderCloses: buyCloses, sellOrderOpens: sellOpens, sellOrderCloses: sellCloses };
  }, [orders, parseOrderTime]);

  // Объединённые точки ордеров
  const { buyOrderPoints, sellOrderPoints } = useMemo(() => {
    return {
      buyOrderPoints: [...buyOrderOpens, ...buyOrderCloses],
      sellOrderPoints: [...sellOrderOpens, ...sellOrderCloses],
    };
  }, [buyOrderOpens, buyOrderCloses, sellOrderOpens, sellOrderCloses]);

  // Соединительные линии ордеров
  const { buyConnectionLines, sellConnectionLines } = useMemo(() => {
    const buyLines = [];
    const sellLines = [];
    if (!orders?.length) return { buyConnectionLines: buyLines, sellConnectionLines: sellLines };
    orders.forEach((order, index) => {
      if (!order.open_time || !order.close_time) return;
      const openMs = parseOrderTime(order.open_time);
      const closeMs = parseOrderTime(order.close_time);
      const isBuyOrder = index % 2 === 0;
      const line = {
        openTimeMs: openMs,
        closeTimeMs: closeMs,
        price: order.mean_price,
        orderId: order.order_id,
      };
      if (isBuyOrder) buyLines.push(line);
      else sellLines.push(line);
    });
    return { buyConnectionLines: buyLines, sellConnectionLines: sellLines };
  }, [orders, parseOrderTime]);

  // Уникальные цены ордеров для ReferenceLine
  const uniqueOrderPrices = useMemo(() => {
    if (!orders?.length) return [];
    return [...new Set(orders.map(o => o.mean_price))];
  }, [orders]);

  // Проверка наличия gaps в closestPrice
  const hasClosestGaps = useMemo(() =>
    priceData.some(p => p.closestPrice === null), [priceData]);

  return {
    priceData,
    timeLabelMap,
    volumeData,
    maxVolume,
    buyTrades,
    sellTrades,
    buyOrderPoints,
    sellOrderPoints,
    buyConnectionLines,
    sellConnectionLines,
    uniqueOrderPrices,
    hasClosestGaps,
    orders,
    stats,
    deltas,
    market_name,
    market_currency,
    strategy_name,
    start_time,
    end_time,
    closest_prices,
    historical_prices,
  };
};

