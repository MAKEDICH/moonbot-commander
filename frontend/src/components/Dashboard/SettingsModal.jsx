import React, { useState, useEffect, useCallback } from 'react';
import { FiSettings, FiSave, FiActivity, FiAlertTriangle } from 'react-icons/fi';
import styles from '../../pages/Dashboard.module.css';

/**
 * Уровни логирования Backend
 */
const LOG_LEVELS = [
  { value: 1, label: 'Только критические', description: 'WARNING, ERROR, CRITICAL' },
  { value: 2, label: 'Стандартное', description: 'INFO, WARNING, ERROR, CRITICAL' },
  { value: 3, label: 'Полное', description: 'DEBUG, INFO, WARNING, ERROR, CRITICAL' }
];

/**
 * Модальное окно настроек дашборда
 */
const SettingsModal = ({ show, onClose }) => {
  const [logLevel, setLogLevel] = useState(2);
  const [initialLogLevel, setInitialLogLevel] = useState(2);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [showRestartWarning, setShowRestartWarning] = useState(false);

  // Динамический импорт API для избежания проблем с hot reload
  const getAPI = useCallback(async () => {
    const { userSettingsAPI } = await import('../../api/api');
    return userSettingsAPI;
  }, []);

  // Загрузка текущих настроек
  useEffect(() => {
    if (show) {
      loadSettings();
    }
  }, [show]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setShowRestartWarning(false);
      const api = await getAPI();
      const response = await api.get();
      const level = response.data.backend_log_level || 2;
      setLogLevel(level);
      setInitialLogLevel(level);
    } catch (error) {
      console.error('Ошибка загрузки настроек:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);
      
      const api = await getAPI();
      await api.update({ backend_log_level: logLevel });
      
      // Показываем предупреждение о перезапуске если уровень изменился
      if (logLevel !== initialLogLevel) {
        setShowRestartWarning(true);
        setMessage({ type: 'success', text: 'Настройки сохранены' });
      } else {
        setMessage({ type: 'success', text: 'Настройки сохранены' });
        setTimeout(() => setMessage(null), 2000);
      }
      
      setInitialLogLevel(logLevel);
    } catch (error) {
      setMessage({ type: 'error', text: 'Ошибка сохранения настроек' });
      console.error('Ошибка сохранения:', error);
    } finally {
      setSaving(false);
    }
  };

  if (!show) return null;

  return (
    <div 
      className={styles.modal}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
          onClose();
        }
      }}
    >
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2><FiSettings /> Настройки дашборда</h2>
          <button onClick={onClose} className={styles.closeBtn}>×</button>
        </div>
        
        <div className={styles.modalBody}>
          {loading ? (
            <div className={styles.loadingSettings}>
              <div className={styles.spinner}></div>
              <p>Загрузка настроек...</p>
            </div>
          ) : (
            <div className={styles.settingsSection}>
              <div className={styles.settingGroup}>
                <div className={styles.settingHeader}>
                  <FiActivity />
                  <h3>Уровень логирования Backend</h3>
                </div>
                <p className={styles.settingDescription}>
                  Выберите уровень детализации логов сервера
                </p>
                
                <div className={styles.logLevelOptions}>
                  {LOG_LEVELS.map((level) => (
                    <label 
                      key={level.value} 
                      className={`${styles.logLevelOption} ${logLevel === level.value ? styles.selected : ''}`}
                    >
                      <input
                        type="radio"
                        name="logLevel"
                        value={level.value}
                        checked={logLevel === level.value}
                        onChange={() => setLogLevel(level.value)}
                      />
                      <div className={styles.logLevelContent}>
                        <span className={styles.logLevelLabel}>
                          <span className={styles.logLevelNumber}>{level.value}</span>
                          {level.label}
                        </span>
                        <span className={styles.logLevelDesc}>{level.description}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              
              {message && (
                <div className={`${styles.settingsMessage} ${styles[message.type]}`}>
                  {message.text}
                </div>
              )}
              
              {showRestartWarning && (
                <div className={styles.restartWarning}>
                  <FiAlertTriangle />
                  <div>
                    <strong>Требуется перезапуск</strong>
                    <p>Для применения нового уровня логирования необходимо перезапустить Backend сервер</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className={styles.modalFooter}>
          <button onClick={onClose} className={styles.cancelBtn}>
            Закрыть
          </button>
          <button 
            onClick={handleSave} 
            className={styles.saveBtn}
            disabled={saving || loading}
          >
            <FiSave />
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
