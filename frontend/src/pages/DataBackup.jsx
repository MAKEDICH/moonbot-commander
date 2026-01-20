/**
 * Страница резервного копирования данных.
 * 
 * Позволяет:
 * - Экспортировать данные в зашифрованный файл
 * - Импортировать данные из файла
 * - Восстанавливать из локальных бэкапов
 */

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { 
  FiCheck, 
  FiAlertTriangle,
  FiDatabase,
  FiShield
} from 'react-icons/fi';
import styles from './DataBackup.module.css';
import PageHeader from '../components/PageHeader';
import { useConfirm } from '../context/ConfirmContext';
import useDataBackup from './useDataBackup';
import { 
  ExportSection, 
  ImportSection, 
  BackupsSection, 
  InfoSection 
} from './DataBackupComponents';

const DataBackup = () => {
  const { confirmDelete } = useConfirm();
  
  const {
    // Refs
    fileInputRef,
    
    // Состояния экспорта
    exportPassword,
    setExportPassword,
    exportPasswordConfirm,
    setExportPasswordConfirm,
    showExportPassword,
    setShowExportPassword,
    includeOrders,
    setIncludeOrders,
    includeCharts,
    setIncludeCharts,
    includeLogs,
    setIncludeLogs,
    exporting,
    
    // Состояния импорта
    importFile,
    importPassword,
    setImportPassword,
    showImportPassword,
    setShowImportPassword,
    importMode,
    setImportMode,
    importing,
    validationResult,
    validating,
    
    // Общие состояния
    preview,
    backups,
    loading,
    error,
    setError,
    success,
    setSuccess,
    
    // Обработчики
    handleExport,
    handleFileSelect,
    handleValidate,
    handleImport,
    handleRestore,
    
    // Утилиты
    formatSize,
    formatDate
  } = useDataBackup({ confirmDelete });

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <FiDatabase className={styles.spinner} size={32} />
          <span>Загрузка...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Заголовок */}
      <PageHeader 
        icon={<FiShield />} 
        title="Резервное копирование" 
        gradient="pink"
      />

      {/* Уведомления */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`${styles.alert} ${styles.alertError}`}
          >
            <FiAlertTriangle />
            <span>{error}</span>
            <button onClick={() => setError(null)}>×</button>
          </motion.div>
        )}
        
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`${styles.alert} ${styles.alertSuccess}`}
          >
            <FiCheck />
            <span>{success}</span>
            <button onClick={() => setSuccess(null)}>×</button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={styles.grid}>
        {/* Экспорт */}
        <ExportSection
          preview={preview}
          includeOrders={includeOrders}
          setIncludeOrders={setIncludeOrders}
          includeCharts={includeCharts}
          setIncludeCharts={setIncludeCharts}
          includeLogs={includeLogs}
          setIncludeLogs={setIncludeLogs}
          exportPassword={exportPassword}
          setExportPassword={setExportPassword}
          exportPasswordConfirm={exportPasswordConfirm}
          setExportPasswordConfirm={setExportPasswordConfirm}
          showExportPassword={showExportPassword}
          setShowExportPassword={setShowExportPassword}
          exporting={exporting}
          handleExport={handleExport}
        />

        {/* Импорт */}
        <ImportSection
          fileInputRef={fileInputRef}
          importFile={importFile}
          importPassword={importPassword}
          setImportPassword={setImportPassword}
          showImportPassword={showImportPassword}
          setShowImportPassword={setShowImportPassword}
          importMode={importMode}
          setImportMode={setImportMode}
          importing={importing}
          validationResult={validationResult}
          validating={validating}
          handleFileSelect={handleFileSelect}
          handleValidate={handleValidate}
          handleImport={handleImport}
          formatSize={formatSize}
        />
      </div>

      {/* Локальные бэкапы */}
      <BackupsSection
        backups={backups}
        handleRestore={handleRestore}
        formatSize={formatSize}
        formatDate={formatDate}
      />

      {/* Информация */}
      <InfoSection />
    </div>
  );
};

export default DataBackup;
