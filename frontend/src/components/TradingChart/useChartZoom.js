/**
 * Хук для управления zoom и pan графика
 */
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { CHART_MARGIN, Y_AXIS_WIDTH } from './constants';

/**
 * Хук для управления zoom, pan и вертикальным масштабированием
 */
export const useChartZoom = ({
  chartKey,
  timeMin,
  timeMax,
  domainMin,
  domainMax,
  onInteractionChange
}) => {
  // Состояние для zoom
  const [zoomDomain, setZoomDomain] = useState(null);
  
  // Ref для отслеживания инициализации zoom
  const zoomInitializedRef = useRef(false);
  
  // Состояния для pan/scale
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: null, y: null, domainX: null, domainY: null, button: null });
  
  // Состояние для отслеживания зажатой ПКМ
  const [isRightMouseDown, setIsRightMouseDown] = useState(false);
  
  // Ref для wrapper
  const wrapperRef = useRef(null);

  // Восстановление zoom из sessionStorage при первой загрузке
  useEffect(() => {
    if (chartKey && !zoomInitializedRef.current) {
      try {
        const stored = sessionStorage.getItem(`chart_zoom_${chartKey}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          setZoomDomain(parsed);
        }
        zoomInitializedRef.current = true;
      } catch {
        // Игнорируем ошибки парсинга
      }
    }
  }, [chartKey]);
  
  // Сохранение zoom в sessionStorage при изменении
  useEffect(() => {
    if (chartKey && zoomInitializedRef.current) {
      if (zoomDomain) {
        sessionStorage.setItem(`chart_zoom_${chartKey}`, JSON.stringify(zoomDomain));
      } else {
        sessionStorage.removeItem(`chart_zoom_${chartKey}`);
      }
    }
  }, [zoomDomain, chartKey]);

  // Вычисляем актуальные домены с учётом zoom
  const actualDomainX = zoomDomain?.x || [timeMin, timeMax];
  const actualDomainY = zoomDomain?.y || [domainMin, domainMax];

  // Вычисляем текущий Scale в процентах
  const currentScalePercent = useMemo(() => {
    const [yMin, yMax] = actualDomainY;
    const midPrice = (yMin + yMax) / 2;
    if (midPrice <= 0) return 0;
    const range = yMax - yMin;
    return (range / midPrice) * 100;
  }, [actualDomainY]);

  // Функция конвертации пикселей в значения данных
  const pixelToData = useCallback((pixelX, pixelY, chartWidth, chartHeight) => {
    const plotAreaLeft = CHART_MARGIN.left + Y_AXIS_WIDTH;
    const plotAreaRight = chartWidth - CHART_MARGIN.right;
    const plotAreaTop = CHART_MARGIN.top;
    const plotAreaBottom = chartHeight - CHART_MARGIN.bottom;
    
    const plotWidth = plotAreaRight - plotAreaLeft;
    const plotHeight = plotAreaBottom - plotAreaTop;
    
    const normalizedX = (pixelX - plotAreaLeft) / plotWidth;
    const normalizedY = (pixelY - plotAreaTop) / plotHeight;
    
    const [xMin, xMax] = actualDomainX;
    const [yMin, yMax] = actualDomainY;
    
    const dataX = xMin + normalizedX * (xMax - xMin);
    const dataY = yMax - normalizedY * (yMax - yMin);
    
    return { dataX, dataY };
  }, [actualDomainX, actualDomainY]);

  // Сброс zoom
  const handleResetZoom = useCallback(() => {
    setZoomDomain(null);
  }, []);

  // Обработчик колёсика мыши для zoom
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    
    if (!wrapperRef.current) return;
    
    const rect = wrapperRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const chartWidth = rect.width;
    const actualChartHeight = rect.height;
    
    const mouseData = pixelToData(mouseX, mouseY, chartWidth, actualChartHeight);
    
    const zoomFactor = e.deltaY < 0 ? 0.8 : 1.25;
    
    const [currentXMin, currentXMax] = actualDomainX;
    const [currentYMin, currentYMax] = actualDomainY;
    
    const xRange = currentXMax - currentXMin;
    const yRange = currentYMax - currentYMin;
    
    const originalXMin = timeMin;
    const originalXMax = timeMax;
    const originalYMin = domainMin;
    const originalYMax = domainMax;
    const originalXRange = originalXMax - originalXMin;
    const originalYRange = originalYMax - originalYMin;
    
    let newXMin, newXMax, newYMin, newYMax;
    
    if (isRightMouseDown) {
      // ПКМ зажата - только горизонтальный zoom
      const newXRange = xRange * zoomFactor;
      
      const minXRange = originalXRange * 0.01;
      const maxXRange = originalXRange * 5;
      
      if (newXRange < minXRange || newXRange > maxXRange) return;
      
      const xRatio = (mouseData.dataX - currentXMin) / xRange;
      
      newXMin = mouseData.dataX - newXRange * xRatio;
      newXMax = mouseData.dataX + newXRange * (1 - xRatio);
      
      newYMin = currentYMin;
      newYMax = currentYMax;
    } else {
      // Обычный zoom (и по X и по Y)
      const newXRange = xRange * zoomFactor;
      const newYRange = yRange * zoomFactor;
      
      const xRatio = (mouseData.dataX - currentXMin) / xRange;
      const yRatio = (mouseData.dataY - currentYMin) / yRange;
      
      newXMin = mouseData.dataX - newXRange * xRatio;
      newXMax = mouseData.dataX + newXRange * (1 - xRatio);
      newYMin = mouseData.dataY - newYRange * yRatio;
      newYMax = mouseData.dataY + newYRange * (1 - yRatio);
      
      const minXRange = originalXRange * 0.01;
      const minYRange = originalYRange * 0.01;
      
      if (newXMax - newXMin < minXRange || newYMax - newYMin < minYRange) return;
      
      const maxXRange = originalXRange * 5;
      const maxYRange = originalYRange * 5;
      
      if (newXMax - newXMin > maxXRange || newYMax - newYMin > maxYRange) return;
    }
    
    setZoomDomain({
      x: [newXMin, newXMax],
      y: [newYMin, newYMax]
    });
    
    if (isRightMouseDown && isPanning) {
      setPanStart(prev => ({
        ...prev,
        domainX: [newXMin, newXMax],
        domainY: [newYMin, newYMax]
      }));
    }
  }, [pixelToData, actualDomainX, actualDomainY, timeMin, timeMax, domainMin, domainMax, isRightMouseDown, isPanning]);

  // Привязываем wheel handler
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    
    const wheelHandler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleWheel(e);
    };
    
    wrapper.addEventListener('wheel', wheelHandler, { passive: false });
    
    return () => {
      wrapper.removeEventListener('wheel', wheelHandler);
    };
  }, [handleWheel]);

  // Обработчик начала pan/scale
  const handlePanStart = useCallback((e) => {
    if (e.button !== 0 && e.button !== 2) return;
    
    e.preventDefault();
    
    if (e.button === 2) {
      setIsRightMouseDown(true);
    }
    
    if (!wrapperRef.current) return;
    
    const rect = wrapperRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setPanStart({
      x,
      y,
      domainX: [...actualDomainX],
      domainY: [...actualDomainY],
      button: e.button
    });
    setIsPanning(true);
    
    if (onInteractionChange) {
      onInteractionChange(true);
    }
  }, [actualDomainX, actualDomainY, onInteractionChange]);

  // Обработчик движения при pan/scale
  const handlePanMove = useCallback((e) => {
    if (!isPanning || !wrapperRef.current || !panStart.domainX) return;
    
    const rect = wrapperRef.current.getBoundingClientRect();
    const chartWidth = rect.width;
    const actualChartHeight = rect.height;
    
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    
    const deltaX = currentX - panStart.x;
    const deltaY = currentY - panStart.y;
    
    const plotAreaLeft = CHART_MARGIN.left + Y_AXIS_WIDTH;
    const plotAreaRight = chartWidth - CHART_MARGIN.right;
    const plotAreaTop = CHART_MARGIN.top;
    const plotAreaBottom = actualChartHeight - CHART_MARGIN.bottom;
    
    const plotWidth = plotAreaRight - plotAreaLeft;
    const plotHeight = plotAreaBottom - plotAreaTop;
    
    const [startXMin, startXMax] = panStart.domainX;
    const [startYMin, startYMax] = panStart.domainY;
    
    const xRange = startXMax - startXMin;
    const yRange = startYMax - startYMin;
    
    // ПКМ (button 2) - вертикальный масштаб
    if (panStart.button === 2) {
      if (Math.abs(deltaY) < 5) return;
      
      const scaleFactor = 1 - (deltaY / plotHeight) * 2;
      
      if (scaleFactor <= 0.1 || scaleFactor >= 10) return;
      
      const yCenter = (startYMin + startYMax) / 2;
      const newYRange = yRange * scaleFactor;
      
      const newYMin = yCenter - newYRange / 2;
      const newYMax = yCenter + newYRange / 2;
      
      setZoomDomain({
        x: [startXMin, startXMax],
        y: [newYMin, newYMax]
      });
    } else {
      // ЛКМ (button 0) - обычный pan
      const dataOffsetX = -(deltaX / plotWidth) * xRange;
      const dataOffsetY = (deltaY / plotHeight) * yRange;
      
      const newXMin = startXMin + dataOffsetX;
      const newXMax = startXMax + dataOffsetX;
      const newYMin = startYMin + dataOffsetY;
      const newYMax = startYMax + dataOffsetY;
      
      setZoomDomain({
        x: [newXMin, newXMax],
        y: [newYMin, newYMax]
      });
    }
  }, [isPanning, panStart]);

  // Обработчик окончания pan/scale
  const handlePanEnd = useCallback((e) => {
    if (e && e.button === 2) {
      setIsRightMouseDown(false);
    }
    if (!e || e.type === 'mouseleave') {
      setIsRightMouseDown(false);
    }
    setIsPanning(false);
    setPanStart({ x: null, y: null, domainX: null, domainY: null, button: null });
    
    if (onInteractionChange) {
      onInteractionChange(false);
    }
  }, [onInteractionChange]);

  // Блокируем контекстное меню
  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
  }, []);

  // Пересчитываем ticks для zoom области
  const actualXTicks = useMemo(() => {
    const [xMin, xMax] = actualDomainX;
    const step = (xMax - xMin) / 8;
    const ticks = [];
    for (let i = 0; i <= 8; i++) {
      ticks.push(xMin + step * i);
    }
    return ticks;
  }, [actualDomainX]);

  const actualYTicks = useMemo(() => {
    const [yMin, yMax] = actualDomainY;
    const step = (yMax - yMin) / 8;
    const ticks = [];
    for (let i = 0; i <= 8; i++) {
      ticks.push(yMin + step * i);
    }
    return ticks;
  }, [actualDomainY]);

  return {
    wrapperRef,
    zoomDomain,
    setZoomDomain,
    isPanning,
    actualDomainX,
    actualDomainY,
    currentScalePercent,
    actualXTicks,
    actualYTicks,
    handleResetZoom,
    handlePanStart,
    handlePanMove,
    handlePanEnd,
    handleContextMenu,
  };
};

