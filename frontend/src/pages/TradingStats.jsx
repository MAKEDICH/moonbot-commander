import React from 'react';
import { FiTrendingUp } from 'react-icons/fi';
import styles from './TradingStats.module.css';
import PageHeader from '../components/PageHeader';
import {
  StatsFilters,
  HotIndicators,
  MainMetrics,
  ExtendedMetrics,
  AIInsights,
  ProfitTimelineChart,
  WinrateTimelineChart,
  StrategyDistributionPieChart,
  ServersComparisonBarChart,
  StrategiesTable,
  ServersTable,
  SymbolsTable,
  TopDealsTable,
  StatsModal,
  useTradingStats
} from '../components/TradingStats';

/**
 * Главный компонент статистики торговли
 */
const TradingStats = ({ autoRefresh, setAutoRefresh, emulatorFilter, setEmulatorFilter, currencyFilter }) => {
  const {
    stats,
    loading,
    error,
    selectedServers,
    selectedStrategies,
    availableServers,
    availableStrategies,
    timePeriod,
    setTimePeriod,
    customDateFrom,
    setCustomDateFrom,
    customDateTo,
    setCustomDateTo,
    serverDropdownOpen,
    setServerDropdownOpen,
    strategyDropdownOpen,
    setStrategyDropdownOpen,
    emulatorDropdownOpen,
    setEmulatorDropdownOpen,
    timeDropdownOpen,
    setTimeDropdownOpen,
    sortConfig,
    handleSort,
    modalOpen,
    modalData,
    modalType,
    modalDetails,
    modalDetailsLoading,
    setModalOpen,
    openModal,
    loadStats,
    handleServerToggle,
    handleStrategyToggle,
  } = useTradingStats(autoRefresh, emulatorFilter, currencyFilter);
  
  if (loading && !stats) {
    return <div className={styles.loading}>Загрузка статистики...</div>;
  }
  
  if (error) {
    return <div className={styles.error}>Ошибка: {error}</div>;
  }
  
  if (!stats) {
    return null;
  }
  
  const overall = stats.overall || {};
  const by_strategy = Array.isArray(stats.by_strategy) ? stats.by_strategy : [];
  const by_server = Array.isArray(stats.by_server) ? stats.by_server : [];
  const by_symbol = Array.isArray(stats.by_symbol) ? stats.by_symbol : [];
  const top_profitable = Array.isArray(stats.top_profitable) ? stats.top_profitable : [];
  const top_losing = Array.isArray(stats.top_losing) ? stats.top_losing : [];
  const profitTimeline = Array.isArray(stats.profit_timeline) ? stats.profit_timeline : [];
  const winrateTimeline = Array.isArray(stats.winrate_timeline) ? stats.winrate_timeline : [];
  const previousPeriod = stats.previous_period || null;
  
  const sparklineData = profitTimeline.slice(-10).map(item => item.daily_profit);
  
  const winrateGrowth = winrateTimeline.length >= 14 ? (() => {
    const recent7 = winrateTimeline.slice(-7);
    const previous7 = winrateTimeline.slice(-14, -7);
    const recentAvg = recent7.reduce((sum, item) => sum + item.winrate, 0) / 7;
    const previousAvg = previous7.reduce((sum, item) => sum + item.winrate, 0) / 7;
    const change = recentAvg - previousAvg;
    return { recentAvg, previousAvg, change };
  })() : null;
  
  return (
    <div className={styles.container}>
      {/* Шапка */}
      <PageHeader 
        icon={<FiTrendingUp />} 
        title="Статистика торговли" 
        gradient="green"
      >
        <button onClick={loadStats} className={styles.refreshBtn} disabled={loading}>
          🔄 {loading ? 'Загрузка...' : 'Обновить'}
        </button>
        <label className={styles.autoRefreshLabel}>
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
          />
          Автообновление
        </label>
      </PageHeader>
      
      {/* Фильтры */}
      <StatsFilters
        emulatorFilter={emulatorFilter}
        setEmulatorFilter={setEmulatorFilter}
        timePeriod={timePeriod}
        setTimePeriod={setTimePeriod}
        customDateFrom={customDateFrom}
        setCustomDateFrom={setCustomDateFrom}
        customDateTo={customDateTo}
        setCustomDateTo={setCustomDateTo}
        selectedServers={selectedServers}
        selectedStrategies={selectedStrategies}
        availableServers={availableServers}
        availableStrategies={availableStrategies}
        handleServerToggle={handleServerToggle}
        handleStrategyToggle={handleStrategyToggle}
        onApplyCustomDates={loadStats}
        emulatorDropdownOpen={emulatorDropdownOpen}
        setEmulatorDropdownOpen={setEmulatorDropdownOpen}
        timeDropdownOpen={timeDropdownOpen}
        setTimeDropdownOpen={setTimeDropdownOpen}
        serverDropdownOpen={serverDropdownOpen}
        setServerDropdownOpen={setServerDropdownOpen}
        strategyDropdownOpen={strategyDropdownOpen}
        setStrategyDropdownOpen={setStrategyDropdownOpen}
      />
      
      {/* Горячие индикаторы */}
      <HotIndicators
        by_strategy={by_strategy}
        by_symbol={by_symbol}
        by_server={by_server}
        winrateGrowth={winrateGrowth}
      />
      
      {/* Основные метрики */}
      <MainMetrics overall={overall} sparklineData={sparklineData} />
      
      {/* Графики в две колонки */}
      <div className={styles.chartsGrid}>
        <ProfitTimelineChart
          profitTimeline={profitTimeline}
          previousPeriod={previousPeriod}
          timePeriod={timePeriod}
          overall={overall}
        />
        <WinrateTimelineChart winrateTimeline={winrateTimeline} />
      </div>
      
      {/* Расширенные метрики */}
      <ExtendedMetrics overall={overall} />
      
      {/* AI инсайты */}
      <AIInsights
        overall={overall}
        by_strategy={by_strategy}
        by_symbol={by_symbol}
        by_server={by_server}
      />
      
      {/* Диаграммы в две колонки */}
      <div className={styles.chartsGrid}>
        <StrategyDistributionPieChart by_strategy={by_strategy} />
        <ServersComparisonBarChart by_server={by_server} />
      </div>
      
      {/* Таблицы в три колонки */}
      <div className={styles.tablesGrid}>
        <StrategiesTable
          by_strategy={by_strategy}
          sortConfig={sortConfig}
          onSort={handleSort}
          onRowClick={openModal}
        />
        <ServersTable
          by_server={by_server}
          sortConfig={sortConfig}
          onSort={handleSort}
          onRowClick={openModal}
        />
        <SymbolsTable
          by_symbol={by_symbol}
          sortConfig={sortConfig}
          onSort={handleSort}
          onRowClick={openModal}
        />
      </div>
      
      {/* Топ сделок */}
      <TopDealsTable top_profitable={top_profitable} top_losing={top_losing} />
      
      {/* Модальное окно */}
      <StatsModal
        modalOpen={modalOpen}
        modalData={modalData}
        modalType={modalType}
        modalDetails={modalDetails}
        modalDetailsLoading={modalDetailsLoading}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
};

export default TradingStats;
