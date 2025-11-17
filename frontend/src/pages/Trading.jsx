import React, { useEffect, useState, lazy, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Orders from './Orders';
import SQLLogs from './SQLLogs';
import StrategyComparison from './StrategyComparison';
import styles from './Trading.module.css';

// Lazy loading для тяжелых страниц с графиками
const TradingStats = lazy(() => import('./TradingStats'));
const ActivityHeatmap = lazy(() => import('./ActivityHeatmap'));

const Trading = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Определяем активную вкладку из URL
  const getActiveTab = () => {
    const path = location.pathname;
    if (path.includes('/trading/orders')) return 'orders';
    if (path.includes('/trading/stats')) return 'stats';
    if (path.includes('/trading/strategies')) return 'strategies';
    if (path.includes('/trading/heatmap')) return 'heatmap';
    return 'logs'; // По умолчанию SQL Logs
  };

  const [activeTab, setActiveTab] = useState(getActiveTab());
  
  // ОБЩЕЕ состояние автообновления для всех подвкладок Торговли
  const [autoRefresh, setAutoRefresh] = useState(() => {
    const saved = localStorage.getItem('trading_autoRefresh');
    return saved !== null ? saved === 'true' : false;
  });
  
  // ОБЩЕЕ состояние фильтра эмулятора для всех подвкладок Торговли
  const [emulatorFilter, setEmulatorFilter] = useState(() => {
    const saved = localStorage.getItem('trading_emulatorFilter');
    return saved || 'all'; // 'all', 'real', 'emulator'
  });

  // Сохраняем состояние автообновления в localStorage
  useEffect(() => {
    localStorage.setItem('trading_autoRefresh', autoRefresh.toString());
  }, [autoRefresh]);
  
  // Сохраняем состояние фильтра эмулятора в localStorage
  useEffect(() => {
    localStorage.setItem('trading_emulatorFilter', emulatorFilter);
  }, [emulatorFilter]);

  // Обновляем вкладку при изменении URL
  useEffect(() => {
    setActiveTab(getActiveTab());
  }, [location.pathname]);

  // При первом заходе перенаправляем на logs если путь просто /trading
  useEffect(() => {
    if (location.pathname === '/trading' || location.pathname === '/trading/') {
      navigate('/trading/logs', { replace: true });
    }
  }, [location.pathname, navigate]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    navigate(`/trading/${tab}`);
  };

  const renderContent = () => {
    const content = (() => {
      switch (activeTab) {
        case 'orders':
          return <Orders autoRefresh={autoRefresh} setAutoRefresh={setAutoRefresh} emulatorFilter={emulatorFilter} setEmulatorFilter={setEmulatorFilter} />;
        case 'logs':
          return <SQLLogs autoRefresh={autoRefresh} setAutoRefresh={setAutoRefresh} emulatorFilter={emulatorFilter} setEmulatorFilter={setEmulatorFilter} />;
        case 'stats':
          return <TradingStats autoRefresh={autoRefresh} setAutoRefresh={setAutoRefresh} emulatorFilter={emulatorFilter} setEmulatorFilter={setEmulatorFilter} />;
        case 'strategies':
          return <StrategyComparison emulatorFilter={emulatorFilter} setEmulatorFilter={setEmulatorFilter} />;
        case 'heatmap':
          return <ActivityHeatmap emulatorFilter={emulatorFilter} setEmulatorFilter={setEmulatorFilter} />;
        default:
          return <Orders autoRefresh={autoRefresh} setAutoRefresh={setAutoRefresh} emulatorFilter={emulatorFilter} setEmulatorFilter={setEmulatorFilter} />;
      }
    })();

    return (
      <Suspense fallback={
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', marginBottom: '10px' }}>⏳</div>
            <div>Загрузка...</div>
          </div>
        </div>
      }>
        {content}
      </Suspense>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>📊 Торговля</h1>
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'logs' ? styles.active : ''}`}
          onClick={() => handleTabChange('logs')}
        >
          📋 SQL Logs
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'orders' ? styles.active : ''}`}
          onClick={() => handleTabChange('orders')}
        >
          📈 Ордера
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'stats' ? styles.active : ''}`}
          onClick={() => handleTabChange('stats')}
        >
          📊 Статистика
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'strategies' ? styles.active : ''}`}
          onClick={() => handleTabChange('strategies')}
        >
          🎯 Стратегии
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'heatmap' ? styles.active : ''}`}
          onClick={() => handleTabChange('heatmap')}
        >
          🔥 Heatmap
        </button>
      </div>

      <div className={styles.content}>
        {renderContent()}
      </div>
    </div>
  );
};

export default Trading;

