/**
 * Хук для вычисления доменов (границ) графика
 */
import { useMemo } from 'react';

/**
 * Вычисляет границы графика на основе данных
 */
export const useChartDomain = ({
  priceData,
  buyTrades,
  sellTrades,
  buyOrderPoints,
  sellOrderPoints,
  orders,
  selectedScale
}) => {
  return useMemo(() => {
    if (!priceData.length) {
      return { domainMin: 0, domainMax: 1, timeMin: 0, timeMax: 1, scale: 0, yTicks: [], xTicks: [] };
    }

    let minPrice = Infinity;
    let maxPrice = -Infinity;
    priceData.forEach(p => {
      if (p.price < minPrice) minPrice = p.price;
      if (p.price > maxPrice) maxPrice = p.price;
    });
    buyTrades.forEach(t => {
      if (t.price < minPrice) minPrice = t.price;
      if (t.price > maxPrice) maxPrice = t.price;
    });
    sellTrades.forEach(t => {
      if (t.price < minPrice) minPrice = t.price;
      if (t.price > maxPrice) maxPrice = t.price;
    });
    if (orders?.length) {
      orders.forEach(o => {
        if (o.mean_price < minPrice) minPrice = o.mean_price;
        if (o.mean_price > maxPrice) maxPrice = o.mean_price;
      });
    }

    // Вычисляем авто-масштаб (реальный диапазон данных)
    const autoScalePercent = minPrice > 0 ? ((maxPrice - minPrice) / minPrice) * 100 : 0;

    // Определяем границы Y на основе выбранного масштаба
    let yMin, yMax;
    
    if (selectedScale === 'auto') {
      // Авто-режим: используем реальный диапазон + padding
      const pricePadding = (maxPrice - minPrice) * 0.1 || 0.0001;
      yMin = minPrice - pricePadding;
      yMax = maxPrice + pricePadding;
    } else {
      // Фиксированный масштаб: вычисляем диапазон относительно средней цены
      const midPrice = (minPrice + maxPrice) / 2;
      const scaleValue = parseFloat(selectedScale);
      const halfRange = (midPrice * scaleValue) / 100 / 2;
      yMin = midPrice - halfRange;
      yMax = midPrice + halfRange;
    }

    let xMin = Infinity;
    let xMax = -Infinity;
    priceData.forEach(p => {
      if (p.timeMs < xMin) xMin = p.timeMs;
      if (p.timeMs > xMax) xMax = p.timeMs;
    });
    buyTrades.forEach(t => {
      if (t.timeMs < xMin) xMin = t.timeMs;
      if (t.timeMs > xMax) xMax = t.timeMs;
    });
    sellTrades.forEach(t => {
      if (t.timeMs < xMin) xMin = t.timeMs;
      if (t.timeMs > xMax) xMax = t.timeMs;
    });
    buyOrderPoints.forEach(o => {
      if (o.timeMs < xMin) xMin = o.timeMs;
      if (o.timeMs > xMax) xMax = o.timeMs;
    });
    sellOrderPoints.forEach(o => {
      if (o.timeMs < xMin) xMin = o.timeMs;
      if (o.timeMs > xMax) xMax = o.timeMs;
    });

    const yTickStep = (yMax - yMin) / 10;
    const yTicksArr = [];
    for (let i = 0; i <= 10; i++) {
      yTicksArr.push(yMin + yTickStep * i);
    }

    const xTickStep = (xMax - xMin) / 10;
    const xTicksArr = [];
    for (let i = 0; i <= 10; i++) {
      xTicksArr.push(xMin + xTickStep * i);
    }

    return {
      domainMin: yMin,
      domainMax: yMax,
      timeMin: xMin,
      timeMax: xMax,
      scale: autoScalePercent,
      yTicks: yTicksArr,
      xTicks: xTicksArr,
    };
  }, [priceData, buyTrades, sellTrades, buyOrderPoints, sellOrderPoints, orders, selectedScale]);
};

