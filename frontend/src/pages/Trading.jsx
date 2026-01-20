import React, { useEffect, useState, lazy, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiBarChart2 } from 'react-icons/fi';
import Orders from './Orders';
import SQLLogs from './SQLLogs';
import StrategyComparison from './StrategyComparison';
import api from '../api/api';
import styles from './Trading.module.css';
import commonStyles from '../styles/common.module.css';
import PageHeader from '../components/PageHeader';
import CurrencySelector from '../components/CurrencySelector';

// Lazy loading для тяжелых страниц с графиками
const TradingStats = lazy(() => import('./TradingStats'));
const ActivityHeatmap = lazy(() => import('./ActivityHeatmap'));
const TickCharts = lazy(() => import('./TickCharts'));
const Useful = lazy(() => import('./Useful'));

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
    if (path.includes('/trading/charts')) return 'charts';
    if (path.includes('/trading/useful')) return 'useful';
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
  
  // Состояние для валют с активными сделками
  const [tradingCurrencies, setTradingCurrencies] = useState([]);
  const [currencyFilter, setCurrencyFilter] = useState('all');

  // Сохраняем состояние автообновления в localStorage
  useEffect(() => {
    localStorage.setItem('trading_autoRefresh', autoRefresh.toString());
  }, [autoRefresh]);
  
  // Сохраняем состояние фильтра эмулятора в localStorage
  useEffect(() => {
    localStorage.setItem('trading_emulatorFilter', emulatorFilter);
  }, [emulatorFilter]);
  
  // Загружаем валюты с активными сделками
  const fetchTradingCurrencies = async () => {
    try {
      const response = await api.get('/api/trading/currencies');
      setTradingCurrencies(response.data.currencies || []);
    } catch (err) {
      console.error('Error fetching trading currencies:', err);
      setTradingCurrencies(['USDT']); // По умолчанию USDT
    }
  };
  
  useEffect(() => {
    fetchTradingCurrencies();
  }, []);
  
  // Автообновление валют
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      fetchTradingCurrencies();
    }, 30000); // Обновляем каждые 30 секунд
    
    return () => clearInterval(interval);
  }, [autoRefresh]);

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
          return <Orders autoRefresh={autoRefresh} setAutoRefresh={setAutoRefresh} emulatorFilter={emulatorFilter} setEmulatorFilter={setEmulatorFilter} currencyFilter={currencyFilter} />;
        case 'logs':
          return <SQLLogs autoRefresh={autoRefresh} setAutoRefresh={setAutoRefresh} emulatorFilter={emulatorFilter} setEmulatorFilter={setEmulatorFilter} currencyFilter={currencyFilter} />;
        case 'stats':
          return <TradingStats autoRefresh={autoRefresh} setAutoRefresh={setAutoRefresh} emulatorFilter={emulatorFilter} setEmulatorFilter={setEmulatorFilter} currencyFilter={currencyFilter} />;
        case 'strategies':
          return <StrategyComparison emulatorFilter={emulatorFilter} setEmulatorFilter={setEmulatorFilter} currencyFilter={currencyFilter} />;
        case 'heatmap':
          return <ActivityHeatmap emulatorFilter={emulatorFilter} setEmulatorFilter={setEmulatorFilter} currencyFilter={currencyFilter} />;
        case 'charts':
          return <TickCharts />;
        case 'useful':
          return <Useful />;
        default:
          return <Orders autoRefresh={autoRefresh} setAutoRefresh={setAutoRefresh} emulatorFilter={emulatorFilter} setEmulatorFilter={setEmulatorFilter} currencyFilter={currencyFilter} />;
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
      <PageHeader 
        icon={<FiBarChart2 />} 
        title="Торговля" 
        gradient="green"
      >
        {tradingCurrencies.length > 0 && (
          tradingCurrencies.length <= 5 ? (
            <CurrencySelector
              currencies={tradingCurrencies}
              value={currencyFilter}
              onChange={(e) => setCurrencyFilter(e.target.value)}
            />
          ) : (
              <div className={commonStyles.currencyButtons}>
                <button
                  className={`${commonStyles.currencyButton} ${currencyFilter === 'all' ? commonStyles.active : ''}`}
                  onClick={() => setCurrencyFilter('all')}
                >
                  Все
                </button>
                {tradingCurrencies.map(currency => (
                  <button
                    key={currency}
                    className={`${commonStyles.currencyButton} ${currencyFilter === currency ? commonStyles.active : ''}`}
                    onClick={() => setCurrencyFilter(currency)}
                  >
                    {currency}
                  </button>
                ))}
              </div>
          )
        )}
      </PageHeader>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'logs' ? styles.active : ''}`}
          onClick={() => handleTabChange('logs')}
        >
          <span style={{fontSize: '16px', opacity: 0.9}}>📋</span> SQL Logs
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'orders' ? styles.active : ''}`}
          onClick={() => handleTabChange('orders')}
        >
          <span style={{fontSize: '16px', opacity: 0.9}}>✅</span> Ордера
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'stats' ? styles.active : ''}`}
          onClick={() => handleTabChange('stats')}
        >
          <span style={{fontSize: '16px', opacity: 0.9}}>📊</span> Статистика
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'strategies' ? styles.active : ''}`}
          onClick={() => handleTabChange('strategies')}
        >
          <span style={{fontSize: '16px', opacity: 0.9}}>🎯</span> Стратегии
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'heatmap' ? styles.active : ''}`}
          onClick={() => handleTabChange('heatmap')}
        >
          <span style={{fontSize: '16px', opacity: 0.9}}>🔥</span> Heatmap
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'charts' ? styles.active : ''}`}
          onClick={() => handleTabChange('charts')}
        >
          <span style={{fontSize: '16px', opacity: 0.9}}>📈</span> Графики
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'useful' ? styles.active : ''}`}
          onClick={() => handleTabChange('useful')}
        >
          <span style={{fontSize: '16px', opacity: 0.9}}>🔧</span> Полезное
        </button>
      </div>

      <div className={styles.content}>
        {renderContent()}
      </div>
    </div>
  );
};

export default Trading;

