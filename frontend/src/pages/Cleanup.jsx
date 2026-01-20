import React from 'react';
import styles from './Cleanup.module.css';
import {
  CleanupHeader,
  AutoCleanupSettings,
  ManualCleanup,
  CleanupStats,
  useCleanup
} from '../components/Cleanup';

/**
 * Страница очистки данных
 */
const Cleanup = () => {
  const {
    settings,
    setSettings,
    stats,
    loading,
    message,
    logsDays,
    setLogsDays,
    historyDays,
    setHistoryDays,
    backendLogsSizeMB,
    setBackendLogsSizeMB,
    saveSettings,
    cleanupLogs,
    cleanupHistory,
    vacuumDatabase,
    cleanupBackendLogs,
    fullCleanup
  } = useCleanup();

  return (
    <div className={styles.cleanup}>
      <CleanupHeader />

      {message.text && (
        <div className={`${styles.message} ${styles[message.type]}`}>
          {message.text}
        </div>
      )}

      <AutoCleanupSettings
        settings={settings}
        setSettings={setSettings}
        onSave={saveSettings}
        loading={loading}
      />

      <ManualCleanup
        logsDays={logsDays}
        setLogsDays={setLogsDays}
        historyDays={historyDays}
        setHistoryDays={setHistoryDays}
        backendLogsSizeMB={backendLogsSizeMB}
        setBackendLogsSizeMB={setBackendLogsSizeMB}
        onCleanupLogs={cleanupLogs}
        onCleanupHistory={cleanupHistory}
        onCleanupBackendLogs={cleanupBackendLogs}
        onVacuumDatabase={vacuumDatabase}
        onFullCleanup={fullCleanup}
        loading={loading}
      />

      <CleanupStats stats={stats} />
    </div>
  );
};

export default Cleanup;
