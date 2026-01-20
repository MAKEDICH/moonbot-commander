import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './ColumnSettings.module.css';

const ColumnSettings = () => {
  const navigate = useNavigate();
  
  // Определения колонок - синхронизированы с Orders.jsx
  const columnDefinitions = [
    { key: 'id', label: 'ID', alwaysVisible: true },
    { key: 'taskId', label: 'Task ID', alwaysVisible: false },
    { key: 'botName', label: 'Название бота', alwaysVisible: false },
    { key: 'type', label: 'Тип', alwaysVisible: true },
    { key: 'status', label: 'Статус', alwaysVisible: true },
    { key: 'symbol', label: 'Символ', alwaysVisible: true },
    { key: 'buyPrice', label: 'Цена покупки', alwaysVisible: false },
    { key: 'sellPrice', label: 'Цена продажи', alwaysVisible: false },
    { key: 'quantity', label: 'Количество', alwaysVisible: false },
    { key: 'profitUSDT', label: 'Прибыль USDT', alwaysVisible: false },
    { key: 'profitPercent', label: 'Прибыль %', alwaysVisible: false },
    { key: 'delta1h', label: 'Δ 1h %', alwaysVisible: false },
    { key: 'delta24h', label: 'Δ 24h %', alwaysVisible: false },
    // Новые колонки из Moonbot
    { key: 'delta3h', label: 'Δ 3h %', alwaysVisible: false },
    { key: 'delta5m', label: 'Δ 5m %', alwaysVisible: false },
    { key: 'delta15m', label: 'Δ 15m %', alwaysVisible: false },
    { key: 'delta1m', label: 'Δ 1m %', alwaysVisible: false },
    { key: 'pump1h', label: 'Pump 1h %', alwaysVisible: false },
    { key: 'dump1h', label: 'Dump 1h %', alwaysVisible: false },
    { key: 'leverage', label: 'Плечо', alwaysVisible: false },
    { key: 'bvsvRatio', label: 'BV/SV', alwaysVisible: false },
    { key: 'isShort', label: 'Short', alwaysVisible: false },
    { key: 'hvol', label: 'hVol', alwaysVisible: false },
    { key: 'hvolf', label: 'hVolF', alwaysVisible: false },
    { key: 'dvol', label: 'dVol', alwaysVisible: false },
    { key: 'signalType', label: 'Сигнал', alwaysVisible: false },
    { key: 'sellReason', label: 'Причина продажи', alwaysVisible: false },
    { key: 'strategy', label: 'Стратегия / Task ID', alwaysVisible: false },
    { key: 'openedAt', label: 'Открыт', alwaysVisible: false },
    { key: 'closedAt', label: 'Закрыт', alwaysVisible: false }
  ];
  
  // Дефолтные колонки (включены по умолчанию)
  const defaultVisibleKeys = [
    'id', 'taskId', 'botName', 'type', 'status', 'symbol', 
    'buyPrice', 'sellPrice', 'quantity', 
    'profitUSDT', 'profitPercent', 
    'delta1h', 'delta24h', 
    'strategy', 'openedAt', 'closedAt'
  ];
  
  // Получение сохраненных настроек из localStorage
  const getSavedColumns = () => {
    const saved = localStorage.getItem('orders_visible_columns');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Объединяем с дефолтными настройками для новых колонок
        const defaultColumns = {};
        columnDefinitions.forEach(col => {
          defaultColumns[col.key] = defaultVisibleKeys.includes(col.key);
        });
        return { ...defaultColumns, ...parsed };
      } catch (e) {
        console.error('Error parsing saved columns:', e);
      }
    }
    // По умолчанию показываем основные колонки
    const defaultColumns = {};
    columnDefinitions.forEach(col => {
      defaultColumns[col.key] = defaultVisibleKeys.includes(col.key);
    });
    return defaultColumns;
  };
  
  const [visibleColumns, setVisibleColumns] = useState(getSavedColumns);
  
  // Сохранение в localStorage при изменении
  useEffect(() => {
    localStorage.setItem('orders_visible_columns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);
  
  const toggleColumn = (key) => {
    const column = columnDefinitions.find(col => col.key === key);
    if (column?.alwaysVisible) return; // Не позволяем отключать обязательные колонки
    
    setVisibleColumns(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };
  
  const selectAll = () => {
    const newColumns = {};
    columnDefinitions.forEach(col => {
      newColumns[col.key] = true;
    });
    setVisibleColumns(newColumns);
  };
  
  const resetToDefault = () => {
    const newColumns = {};
    columnDefinitions.forEach(col => {
      newColumns[col.key] = defaultVisibleKeys.includes(col.key);
    });
    setVisibleColumns(newColumns);
  };
  
  const goBack = () => {
    navigate(-1);
  };
  
  const activeCount = Object.values(visibleColumns).filter(v => v).length;
  
  // Функция для получения примера значения колонки
  const getPreviewValue = (key) => {
    const previews = {
      id: '#12345',
      taskId: '#42',
      botName: 'MyBot_1',
      type: '💰 REAL',
      status: '✅ Closed',
      symbol: 'BTC/USDT',
      buyPrice: '45230.50000000',
      sellPrice: '46120.75000000',
      quantity: '0.0015',
      profitUSDT: '+125.50',
      profitPercent: '+2.45%',
      delta1h: '+1.23%',
      delta24h: '-0.56%',
      delta3h: '+0.85%',
      delta5m: '+0.12%',
      delta15m: '+0.34%',
      delta1m: '+0.05%',
      pump1h: '+3.50%',
      dump1h: '-2.10%',
      leverage: 'x10',
      bvsvRatio: '1.25',
      isShort: 'Нет',
      hvol: '125.5',
      hvolf: '98.2',
      dvol: '45.3',
      signalType: 'PUMP',
      sellReason: 'TP',
      strategy: 'STRAT_1',
      openedAt: '19.11 14:30',
      closedAt: '19.11 15:45'
    };
    return previews[key] || '-';
  };
  
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <button onClick={goBack} className={styles.backButton}>
            ← Назад
          </button>
          <h1 className={styles.title}>
            <span className={styles.titleIcon}>⚙️</span>
            Настройка колонок
          </h1>
        </div>
        
        <div className={styles.headerStats}>
          <div className={styles.activeCount}>
            <span className={styles.countNumber}>{activeCount}</span>
            <span className={styles.countLabel}>из {columnDefinitions.length} активно</span>
          </div>
          
          <div className={styles.headerActions}>
            <button onClick={selectAll} className={styles.actionBtn}>
              Выбрать все
            </button>
            <button onClick={resetToDefault} className={styles.actionBtn}>
              Сбросить
            </button>
          </div>
        </div>
      </div>
      
      <div className={styles.content}>
        <div className={styles.columnGrid}>
          {columnDefinitions.map(col => (
            <div 
              key={col.key} 
              className={`${styles.columnItem} ${visibleColumns[col.key] ? styles.active : ''}`}
              onClick={() => toggleColumn(col.key)}
            >
              <div className={styles.columnCheckbox}>
                <input
                  type="checkbox"
                  checked={visibleColumns[col.key]}
                  onChange={() => toggleColumn(col.key)}
                  disabled={col.alwaysVisible}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              
              <div className={styles.columnInfo}>
                <div className={styles.columnLabel}>
                  {col.label}
                </div>
                {col.alwaysVisible && (
                  <div className={styles.requiredBadge}>
                    Обязательная
                  </div>
                )}
              </div>
              
              <div className={styles.columnPreview}>
                <div className={styles.previewContent}>
                  {getPreviewValue(col.key)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ColumnSettings;
