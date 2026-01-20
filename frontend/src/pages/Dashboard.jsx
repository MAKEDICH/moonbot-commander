import React from 'react';
import styles from './Dashboard.module.css';
import { countServersByStatus } from '../components/Dashboard/dashboardUtils';
import {
  DashboardHeader,
  StatsGrid,
  SettingsModal,
  CleanupModal,
  TradingOverview,
  CommandsChart,
  RecentOrders,
  ProfitChart,
  MonthlyProfitTable,
  useDashboard
} from '../components/Dashboard';

/**
 * Страница дашборда
 * Секция "Статус серверов" перенесена на страницу Серверы
 */
const Dashboard = () => {
  const {
    stats,
    serversWithStatus,
    commandsDaily,
    tradingStats,
    recentOrders,
    profitData,
    loading,
    tradingLoading,
    showSettings,
    setShowSettings,
    toast,
    showCleanupModal,
    setShowCleanupModal,
    tradingPeriod,
    setTradingPeriod,
    handleProfitPeriodChange
  } = useDashboard();

  if (loading || !stats) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Загрузка дашборда...</p>
      </div>
    );
  }

  const { online, offline } = countServersByStatus(serversWithStatus);

  return (
    <div className={styles.dashboard}>
      <DashboardHeader
        onShowSettings={() => setShowSettings(true)}
        onShowCleanup={() => setShowCleanupModal(true)}
      />

      <StatsGrid
        stats={stats}
        onlineServers={online}
        offlineServers={offline}
      />

      <div className={styles.dashboardGrid}>
        <div className={styles.dashboardColumn}>
          <TradingOverview 
            tradingStats={tradingStats} 
            loading={tradingLoading}
            period={tradingPeriod}
            onPeriodChange={setTradingPeriod}
          />
          <CommandsChart 
            commandsDaily={commandsDaily} 
            loading={loading} 
          />
        </div>
        <div className={styles.dashboardColumn}>
          <ProfitChart 
            profitData={profitData} 
            loading={tradingLoading}
            onPeriodChange={handleProfitPeriodChange}
          />
          <RecentOrders 
            orders={recentOrders} 
            loading={tradingLoading} 
          />
        </div>
      </div>

      {/* Таблица прибыли по дням за месяц */}
      <MonthlyProfitTable />

      <SettingsModal
        show={showSettings}
        onClose={() => setShowSettings(false)}
      />

      <CleanupModal
        show={showCleanupModal}
        onClose={() => setShowCleanupModal(false)}
      />

      {toast && (
        <div className={`${styles.toast} ${styles[toast.type]}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
