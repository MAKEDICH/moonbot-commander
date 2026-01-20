import React from 'react';
import { FiSettings } from 'react-icons/fi';
import styles from '../../pages/Cleanup.module.css';

/**
 * Секция автоматической очистки с настройками
 */
const AutoCleanupSettings = ({ settings, setSettings, onSave, loading }) => {
  return (
    <div className={styles.section}>
      <h2><FiSettings /> Автоматическая очистка</h2>
      <div className={styles.card}>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
          />
          <span>Включить автоматическую очистку</span>
        </label>

        {settings.enabled && (
          <div className={styles.triggerSettings}>
            <h3>Правила срабатывания:</h3>
            
            <div className={styles.radioGroup}>
              <label>
                <input
                  type="radio"
                  value="time"
                  checked={settings.trigger_type === 'time'}
                  onChange={(e) => setSettings({ ...settings, trigger_type: e.target.value })}
                />
                <span>По времени</span>
              </label>
              {settings.trigger_type === 'time' && (
                <div className={styles.inputGroup}>
                  <label>Удалять данные старше:</label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={settings.days_to_keep || ''}
                    onChange={(e) => setSettings({ ...settings, days_to_keep: parseInt(e.target.value) || 1 })}
                    className={styles.inputField}
                  />
                  <span>дней</span>
                </div>
              )}
            </div>

            <div className={styles.radioGroup}>
              <label>
                <input
                  type="radio"
                  value="disk"
                  checked={settings.trigger_type === 'disk'}
                  onChange={(e) => setSettings({ ...settings, trigger_type: e.target.value })}
                />
                <span>При заполнении диска</span>
              </label>
              {settings.trigger_type === 'disk' && (
                <div className={styles.inputGroup}>
                  <label>Срабатывать при заполнении:</label>
                  <input
                    type="number"
                    min="50"
                    max="95"
                    value={settings.disk_threshold_percent || ''}
                    onChange={(e) => setSettings({ ...settings, disk_threshold_percent: parseInt(e.target.value) || 80 })}
                    className={styles.inputField}
                  />
                  <span>%</span>
                </div>
              )}
            </div>

            <div className={styles.radioGroup}>
              <label>
                <input
                  type="radio"
                  value="combined"
                  checked={settings.trigger_type === 'combined'}
                  onChange={(e) => setSettings({ ...settings, trigger_type: e.target.value })}
                />
                <span>Комбинированный (время ИЛИ диск)</span>
              </label>
              {settings.trigger_type === 'combined' && (
                <div className={styles.combinedInputs}>
                  <div className={styles.inputGroup}>
                    <label>Дней:</label>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={settings.days_to_keep || ''}
                      onChange={(e) => setSettings({ ...settings, days_to_keep: parseInt(e.target.value) || 1 })}
                      className={styles.inputField}
                    />
                  </div>
                  <div className={styles.inputGroup}>
                    <label>Диск:</label>
                    <input
                      type="number"
                      min="50"
                      max="95"
                      value={settings.disk_threshold_percent || ''}
                      onChange={(e) => setSettings({ ...settings, disk_threshold_percent: parseInt(e.target.value) || 80 })}
                      className={styles.inputField}
                    />
                    <span>%</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {settings.enabled && (
          <div className={styles.cleanupTargets}>
            <h3>Что очищать автоматически:</h3>
            
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={settings.auto_cleanup_sql_logs}
                onChange={(e) => setSettings({ ...settings, auto_cleanup_sql_logs: e.target.checked })}
              />
              <span>SQL логи (данные от Moonbot)</span>
            </label>

            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={settings.auto_cleanup_command_history}
                onChange={(e) => setSettings({ ...settings, auto_cleanup_command_history: e.target.checked })}
              />
              <span>История команд</span>
            </label>

            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={settings.auto_cleanup_backend_logs}
                onChange={(e) => setSettings({ ...settings, auto_cleanup_backend_logs: e.target.checked })}
              />
              <span>Ротированные логи Backend (.log.1, .log.2, и т.д.)</span>
            </label>

            {settings.auto_cleanup_backend_logs && (
              <div className={styles.inputGroup} style={{marginLeft: '2rem'}}>
                <label>Очистить ротированные логи до:</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={settings.backend_logs_max_size_mb || ''}
                  onChange={(e) => setSettings({ ...settings, backend_logs_max_size_mb: parseInt(e.target.value) || 0 })}
                  className={styles.inputField}
                />
                <span>МБ (0 = удалить все ротированные)</span>
              </div>
            )}
          </div>
        )}

        <button
          className={styles.saveButton}
          onClick={onSave}
          disabled={loading}
        >
          {loading ? 'Сохранение...' : 'Сохранить настройки'}
        </button>
      </div>
    </div>
  );
};

export default AutoCleanupSettings;



