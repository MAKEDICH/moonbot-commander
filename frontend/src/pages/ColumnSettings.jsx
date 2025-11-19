import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './ColumnSettings.module.css';

const ColumnSettings = () => {
  const navigate = useNavigate();
  
  // Определения колонок - синхронизированы с Orders.jsx
  const columnDefinitions = [
    { key: 'id', label: 'ID', alwaysVisible: true },
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
    { key: 'strategy', label: 'Стратегия / Task ID', alwaysVisible: false },
    { key: 'openedAt', label: 'Открыт', alwaysVisible: false },
    { key: 'closedAt', label: 'Закрыт', alwaysVisible: false }
  ];
  
  // Получение сохраненных настроек из localStorage
  const getSavedColumns = () => {
    const saved = localStorage.getItem('orders_visible_columns');
    if (saved) {
      return JSON.parse(saved);
    }
    // По умолчанию показываем основные колонки
    const defaultColumns = {};
    columnDefinitions.forEach(col => {
      defaultColumns[col.key] = col.alwaysVisible || ['id', 'type', 'status', 'symbol', 'buyPrice', 'sellPrice', 'quantity', 'profitUSDT', 'profitPercent', 'delta1h', 'delta24h', 'strategy', 'openedAt', 'closedAt'].includes(col.key);
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
      newColumns[col.key] = col.alwaysVisible || false;
    });
    setVisibleColumns(newColumns);
  };
  
  const goBack = () => {
    navigate(-1);
  };
  
  const activeCount = Object.values(visibleColumns).filter(v => v).length;
  
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
                {/* Превью колонки */}
                <div className={styles.previewContent}>
                  {col.key === 'id' && '#12345'}
                  {col.key === 'type' && '💰 REAL'}
                  {col.key === 'status' && '✅ Closed'}
                  {col.key === 'symbol' && 'BTC/USDT'}
                  {col.key === 'buyPrice' && '45230.50000000'}
                  {col.key === 'sellPrice' && '46120.75000000'}
                  {col.key === 'quantity' && '0.0015'}
                  {col.key === 'profitUSDT' && '+125.50'}
                  {col.key === 'profitPercent' && '+2.45%'}
                  {col.key === 'delta1h' && '+1.23%'}
                  {col.key === 'delta24h' && '-0.56%'}
                  {col.key === 'strategy' && 'STRAT_1'}
                  {col.key === 'openedAt' && '19.11 14:30'}
                  {col.key === 'closedAt' && '19.11 15:45'}
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
