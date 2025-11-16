import React, { useState, useEffect } from 'react';
import { FiTrash2, FiDatabase, FiHardDrive, FiAlertTriangle, FiCheckCircle, FiSettings, FiClock } from 'react-icons/fi';
import styles from './Cleanup.module.css';
import api from '../api/api';

const Cleanup = () => {
  const [settings, setSettings] = useState({
    enabled: false,
    trigger_type: 'time',
    days_to_keep: 30,
    disk_threshold_percent: 80,
    auto_cleanup_sql_logs: true,
    auto_cleanup_command_history: true,
    auto_cleanup_backend_logs: false,
    backend_logs_max_size_mb: 10
  });
  
  const [isLoaded, setIsLoaded] = useState(false);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  
  // Состояния для гибких настроек очистки
  const [logsDays, setLogsDays] = useState(30);
  const [historyDays, setHistoryDays] = useState(30);
  const [backendLogsSizeMB, setBackendLogsSizeMB] = useState(0);

  useEffect(() => {
    loadSettings();
    loadStats();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await api.get('/api/cleanup/settings');
      if (response.data) {
        setSettings({
          enabled: response.data.enabled ?? false,
          trigger_type: response.data.trigger_type || 'time',
          days_to_keep: response.data.days_to_keep ?? 30,
          disk_threshold_percent: response.data.disk_threshold_percent ?? 80,
          auto_cleanup_sql_logs: response.data.auto_cleanup_sql_logs ?? true,
          auto_cleanup_command_history: response.data.auto_cleanup_command_history ?? true,
          auto_cleanup_backend_logs: response.data.auto_cleanup_backend_logs ?? false,
          backend_logs_max_size_mb: response.data.backend_logs_max_size_mb ?? 10
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setIsLoaded(true);
    }
  };

  const loadStats = async () => {
    try {
      const response = await api.get('/api/cleanup/stats');
      setStats(response.data);
    } catch (error) {
      showMessage('Ошибка загрузки статистики', 'error');
    }
  };

  const saveSettings = async () => {
    setLoading(true);
    try {
      await api.post('/api/cleanup/settings', settings);
      showMessage('Настройки сохранены', 'success');
    } catch (error) {
      showMessage('Ошибка сохранения настроек', 'error');
    } finally {
      setLoading(false);
    }
  };

  const cleanupLogs = async () => {
    const days = logsDays;
    const confirmText = days === 0 
      ? 'Удалить ВСЕ SQL логи? Это действие необратимо!' 
      : `Удалить SQL логи старше ${days} дней?`;
    
    if (!confirm(confirmText)) return;
    
    setLoading(true);
    try {
      const response = await api.post('/api/cleanup/logs', { days });
      showMessage(`Удалено записей: ${response.data.deleted_count}`, 'success');
      loadStats();
    } catch (error) {
      showMessage('Ошибка очистки логов', 'error');
    } finally {
      setLoading(false);
    }
  };

  const cleanupHistory = async () => {
    const days = historyDays;
    const confirmText = days === 0
      ? 'Удалить ВСЮ историю команд? Это действие необратимо!'
      : `Удалить историю команд старше ${days} дней?`;
    
    if (!confirm(confirmText)) return;
    
    setLoading(true);
    try {
      const response = await api.post('/api/cleanup/history', { days });
      showMessage(`Удалено записей: ${response.data.deleted_count}`, 'success');
      loadStats();
    } catch (error) {
      showMessage('Ошибка очистки истории', 'error');
    } finally {
      setLoading(false);
    }
  };

  const vacuumDatabase = async () => {
    if (!confirm('Оптимизировать базу данных? Это может занять время.')) return;
    setLoading(true);
    try {
      const response = await api.post('/api/cleanup/vacuum');
      showMessage(`База оптимизирована. ${response.data.freed_space}`, 'success');
      loadStats();
    } catch (error) {
      showMessage('Ошибка оптимизации БД', 'error');
    } finally {
      setLoading(false);
    }
  };

  const cleanupBackendLogs = async () => {
    const maxSize = backendLogsSizeMB;
    const confirmText = maxSize === 0
      ? 'Удалить ВСЕ файлы логов backend (.log)? Это действие необратимо!'
      : `Обрезать файлы логов до ${maxSize} МБ?`;
    
    if (!confirm(confirmText)) return;
    
    setLoading(true);
    try {
      const response = await api.post('/api/cleanup/backend-logs', { max_size_mb: maxSize });
      const freedMB = (response.data.freed_bytes / (1024 * 1024)).toFixed(2);
      showMessage(`Обработано файлов: ${response.data.deleted_count}, освобождено: ${freedMB} МБ`, 'success');
      loadStats();
    } catch (error) {
      showMessage('Ошибка очистки логов backend', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fullCleanup = async () => {
    const confirmed = confirm(
      '⚠️ ПОЛНАЯ ОЧИСТКА ВРЕМЕННЫХ ДАННЫХ\n\n' +
      'Будет удалено:\n' +
      '• ВСЕ SQL логи\n' +
      '• ВСЯ история команд\n\n' +
      'НЕ будет затронуто (защищённые данные):\n' +
      '✓ Аккаунты пользователей\n' +
      '✓ Добавленные серверы\n' +
      '✓ Ордера\n' +
      '✓ Настройки\n' +
      '✓ Группы серверов\n\n' +
      'Продолжить?'
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      const response = await api.post('/api/cleanup/full');
      showMessage(
        `Полная очистка выполнена:\n` +
        `- Удалено логов: ${response.data.logs_deleted}\n` +
        `- Удалено команд: ${response.data.history_deleted}`,
        'success'
      );
      loadStats();
    } catch (error) {
      showMessage('Ошибка полной очистки', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 5000);
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  return (
    <div className={styles.cleanup}>
      <div className={styles.header}>
        <h1>
          <FiTrash2 /> Очистка данных
        </h1>
        <p>Гибкое управление базой данных и логами</p>
      </div>

      {message.text && (
        <div className={`${styles.message} ${styles[message.type]}`}>
          {message.text}
        </div>
      )}

      {/* Секция 1: Настройки автоочистки */}
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
                <span>Логи Backend (.log файлы)</span>
              </label>

              {settings.auto_cleanup_backend_logs && (
                <div className={styles.inputGroup} style={{marginLeft: '2rem'}}>
                  <label>Обрезать лог-файлы до:</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={settings.backend_logs_max_size_mb || ''}
                    onChange={(e) => setSettings({ ...settings, backend_logs_max_size_mb: parseInt(e.target.value) || 0 })}
                    className={styles.inputField}
                  />
                  <span>МБ (0 = удалить полностью)</span>
                </div>
              )}
            </div>
          )}

          <button
            className={styles.saveButton}
            onClick={saveSettings}
            disabled={loading}
          >
            {loading ? 'Сохранение...' : 'Сохранить настройки'}
          </button>
        </div>
      </div>

      {/* Секция 2: Ручная очистка с гибкими параметрами */}
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
              onClick={cleanupLogs}
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
              onClick={cleanupHistory}
              disabled={loading}
            >
              <FiTrash2 /> {historyDays === 0 ? 'Удалить ВСЮ историю' : `Удалить историю > ${historyDays} дней`}
            </button>
          </div>
        </div>

        <div className={styles.card}>
          <h3><FiDatabase /> Логи Backend</h3>
          <p className={styles.help}>Файлы логов приложения (.log). Могут занимать много места при длительной работе.</p>
          
          <div className={styles.flexRow}>
            <div className={styles.inputGroup}>
              <label>Размер после обрезки:</label>
              <input
                type="number"
                min="0"
                max="100"
                value={backendLogsSizeMB}
                onChange={(e) => setBackendLogsSizeMB(parseInt(e.target.value) || 0)}
                className={styles.inputField}
                placeholder="0 = удалить"
              />
              <span>МБ (0 = удалить полностью)</span>
            </div>
            <button
              className={`${styles.actionButton} ${backendLogsSizeMB === 0 ? styles.danger : styles.safe}`}
              onClick={cleanupBackendLogs}
              disabled={loading}
            >
              <FiTrash2 /> {backendLogsSizeMB === 0 ? 'Удалить логи' : `Обрезать до ${backendLogsSizeMB} МБ`}
            </button>
          </div>
        </div>

        <div className={styles.card}>
          <h3><FiHardDrive /> Оптимизация БД</h3>
          <p className={styles.help}>Команда VACUUM освобождает место после удаления записей.</p>
          
          <button
            className={`${styles.actionButton} ${styles.safe}`}
            onClick={vacuumDatabase}
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
            onClick={fullCleanup}
            disabled={loading}
          >
            <FiAlertTriangle /> ПОЛНАЯ ОЧИСТКА
          </button>
        </div>
      </div>

      {/* Секция 3: Статистика */}
      <div className={styles.section}>
        <h2><FiDatabase /> Статистика</h2>
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <h3>Записи в таблицах</h3>
            {stats && stats.tables && (
              <>
                <p>SQL логи: <strong>{stats.tables.sql_logs || 0}</strong></p>
                <p>История команд: <strong>{stats.tables.command_history || 0}</strong></p>
                <p>Ордера: <strong className={styles.protected}>{stats.tables.orders || 0}</strong> (защищены)</p>
              </>
            )}
          </div>

          <div className={styles.statCard}>
            <h3>Размер файлов</h3>
            {stats && stats.files && (
              <>
                <p>moonbot.db: <strong>{formatBytes(stats.files.moonbot_db)}</strong></p>
                <p>moonbot_commander.db: <strong>{formatBytes(stats.files.commander_db)}</strong></p>
                <p>Логи: <strong>{formatBytes(stats.files.logs)}</strong></p>
              </>
            )}
          </div>

          <div className={styles.statCard}>
            <h3>Диск</h3>
            {stats && stats.disk && (
              <>
                <p>Всего: <strong>{formatBytes(stats.disk.total)}</strong></p>
                <p>Использовано: <strong>{formatBytes(stats.disk.used)}</strong></p>
                <p>Свободно: <strong>{formatBytes(stats.disk.free)}</strong></p>
                <p>Заполнение: <strong className={stats.disk.percent > 80 ? styles.warning : ''}>{stats.disk.percent?.toFixed(1)}%</strong></p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cleanup;
