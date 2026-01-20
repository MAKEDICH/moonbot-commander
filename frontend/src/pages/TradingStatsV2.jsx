import React from 'react';
import styles from './TradingStats.module.css';
import { sortData } from '../components/TradingStatsV2/statsUtils';
import {
  StatsHeader,
  StatsFilters,
  HotIndicators,
  MainMetrics,
  ExtendedMetrics,
  StrategyPieChart,
  StrategiesTable,
  ServersTable,
  SymbolsTable,
  TopDealsTable,
  useTradingStatsV2
} from '../components/TradingStatsV2';

/**
 * Страница статистики торговли V2
 */
const TradingStatsV2 = ({ 
  autoRefresh, 
  setAutoRefresh, 
  emulatorFilter, 
  setEmulatorFilter 
}) => {
  const [timePeriod, setTimePeriod] = React.useState('all');

  const {
    stats,
    loading,
    error,
    selectedServers,
    selectedStrategies,
    availableServers,
    availableStrategies,
    dropdownStates,
    sortConfig,
    loadStats,
    handleServerToggle,
    handleStrategyToggle,
    handleSort,
    setDropdownStates
  } = useTradingStatsV2(autoRefresh, emulatorFilter, timePeriod);

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
  const byStrategy = Array.isArray(stats.by_strategy) 
    ? sortData(stats.by_strategy, sortConfig.table === 'strategy' ? sortConfig : { key: null }) 
    : [];
  const byServer = Array.isArray(stats.by_server) 
    ? sortData(stats.by_server, sortConfig.table === 'server' ? sortConfig : { key: null }) 
    : [];
  const bySymbol = Array.isArray(stats.by_symbol) 
    ? sortData(stats.by_symbol, sortConfig.table === 'symbol' ? sortConfig : { key: null }) 
    : [];
  const topProfitable = Array.isArray(stats.top_profitable) ? stats.top_profitable : [];
  const topLosing = Array.isArray(stats.top_losing) ? stats.top_losing : [];

  return (
    <div className={styles.container}>
      <StatsHeader
        onRefresh={loadStats}
        loading={loading}
        autoRefresh={autoRefresh}
        setAutoRefresh={setAutoRefresh}
      />

      <StatsFilters
        emulatorFilter={emulatorFilter}
        setEmulatorFilter={setEmulatorFilter}
        timePeriod={timePeriod}
        setTimePeriod={setTimePeriod}
        selectedServers={selectedServers}
        selectedStrategies={selectedStrategies}
        availableServers={availableServers}
        availableStrategies={availableStrategies}
        onServerToggle={handleServerToggle}
        onStrategyToggle={handleStrategyToggle}
        dropdownStates={dropdownStates}
        setDropdownStates={setDropdownStates}
      />

      <HotIndicators
        byStrategy={byStrategy}
        bySymbol={bySymbol}
        byServer={byServer}
      />

      <MainMetrics overall={overall} />

      <ExtendedMetrics overall={overall} />

      <StrategyPieChart byStrategy={byStrategy} />

      <StrategiesTable
        byStrategy={byStrategy}
        sortConfig={sortConfig}
        onSort={handleSort}
      />

      <ServersTable
        byServer={byServer}
        sortConfig={sortConfig}
        onSort={handleSort}
      />

      <SymbolsTable
        bySymbol={bySymbol}
        sortConfig={sortConfig}
        onSort={handleSort}
      />

      <TopDealsTable
        topProfitable={topProfitable}
        topLosing={topLosing}
      />
    </div>
  );
};

export default TradingStatsV2;
