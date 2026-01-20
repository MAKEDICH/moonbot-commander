import React from 'react';
import { FiTrash2, FiDatabase, FiClock, FiHardDrive, FiAlertTriangle } from 'react-icons/fi';
import styles from '../../pages/Cleanup.module.css';

/**
 * Секция ручной очистки с гибкими параметрами
 */
const ManualCleanup = ({
  logsDays,
  setLogsDays,
  historyDays,
  setHistoryDays,
  backendLogsSizeMB,
  setBackendLogsSizeMB,
  onCleanupLogs,
  onCleanupHistory,
  onCleanupBackendLogs,
  onVacuumDatabase,
  onFullCleanup,
  loading
}) => {
  return (
    <div className={styles.section}>
      <h2><FiDatabase /> Ручная очистка (гибкие настройки)</h2>
      
      <div className={styles.card}>
        <h3><FiDatabase /> SQL Логи</h3>
        <p className={styles.help}>SQL логи содержат информацию о полученных данных от Moonbot. Это временные данные.</p>
        
        <div className={styles.flexRow}>
          <div className={styles.inputGroup}>
            <label>Удалить логи старше:</label>
            <input
              type="number"
              min="0"
              max="365"
              value={logsDays}
              onChange={(e) => setLogsDays(parseInt(e.target.value) || 0)}
              className={styles.inputField}
              placeholder="0 = ВСЕ"
            />
            <span>дней (0 = удалить ВСЕ)</span>
          </div>
          <button
            className={`${styles.actionButton} ${logsDays === 0 ? styles.danger : styles.safe}`}
            onClick={onCleanupLogs}
            disabled={loading}
          >
            <FiTrash2 /> {logsDays === 0 ? 'Удалить ВСЕ логи' : `Удалить логи > ${logsDays} дней`}
          </button>
        </div>
      </div>

      <div className={styles.card}>
        <h3><FiClock /> История команд</h3>
        <p className={styles.help}>История выполненных команд. Это временные данные для отладки.</p>
        
        <div className={styles.flexRow}>
          <div className={styles.inputGroup}>
            <label>Удалить историю старше:</label>
            <input
              type="number"
              min="0"
              max="365"
              value={historyDays}
              onChange={(e) => setHistoryDays(parseInt(e.target.value) || 0)}
              className={styles.inputField}
              placeholder="0 = ВСЁ"
            />
            <span>дней (0 = удалить ВСЁ)</span>
          </div>
          <button
            className={`${styles.actionButton} ${historyDays === 0 ? styles.danger : styles.safe}`}
            onClick={onCleanupHistory}
            disabled={loading}
          >
            <FiTrash2 /> {historyDays === 0 ? 'Удалить ВСЮ историю' : `Удалить историю > ${historyDays} дней`}
          </button>
        </div>
      </div>

      <div className={styles.card}>
        <h3><FiDatabase /> Логи Backend (ротированные)</h3>
        <p className={styles.help}>
          Старые ротированные логи (.log.1, .log.2, и т.д.). Активные .log файлы НЕ затрагиваются.
          <br />
          💡 Очистка удаляет ТОЛЬКО старые ротированные файлы, не влияя на текущую работу приложения.
        </p>
        
        <div className={styles.flexRow}>
          <div className={styles.inputGroup}>
            <label>Размер после очистки:</label>
            <input
              type="number"
              min="0"
              max="100"
              value={backendLogsSizeMB}
              onChange={(e) => setBackendLogsSizeMB(parseInt(e.target.value) || 0)}
              className={styles.inputField}
              placeholder="0 = удалить"
            />
            <span>МБ (0 = удалить все ротированные)</span>
          </div>
          <button
            className={`${styles.actionButton} ${backendLogsSizeMB === 0 ? styles.danger : styles.safe}`}
            onClick={onCleanupBackendLogs}
            disabled={loading}
          >
            <FiTrash2 /> {backendLogsSizeMB === 0 ? 'Удалить ротированные' : `Очистить до ${backendLogsSizeMB} МБ`}
          </button>
        </div>
      </div>

      <div className={styles.card}>
        <h3><FiHardDrive /> Оптимизация БД</h3>
        <p className={styles.help}>Команда VACUUM освобождает место после удаления записей.</p>
        
        <button
          className={`${styles.actionButton} ${styles.safe}`}
          onClick={onVacuumDatabase}
          disabled={loading}
        >
          <FiHardDrive /> Оптимизировать БД
        </button>
      </div>

      <div className={styles.card} style={{border: '2px solid #ff4d4d'}}>
        <h3><FiAlertTriangle /> ОПАСНО: Полная очистка</h3>
        <p className={styles.help}>
          <strong>Удалит:</strong> ВСЕ логи, ВСЮ историю команд<br/>
          <strong>Не тронет:</strong> Аккаунты, серверы, ордера, настройки, группы
        </p>
        
        <button
          className={`${styles.actionButton} ${styles.danger}`}
          onClick={onFullCleanup}
          disabled={loading}
        >
          <FiAlertTriangle /> ПОЛНАЯ ОЧИСТКА
        </button>
      </div>
    </div>
  );
};

export default ManualCleanup;



