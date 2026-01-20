import { useState, useEffect } from 'react';
import api from '../../api/api';
import { useNotification } from '../../context/NotificationContext';

/**
 * Хук для управления очисткой данных
 */
const useCleanup = () => {
  const { success, error: showError, warning, confirm } = useNotification();
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
    
    if (!(await confirm({ message: confirmText, type: 'danger', confirmText: 'Удалить' }))) return;
    
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
    
    if (!(await confirm({ message: confirmText, type: 'danger', confirmText: 'Удалить' }))) return;
    
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
    if (!(await confirm({ 
      message: 'Оптимизировать базу данных? Это может занять время.', 
      type: 'warning' 
    }))) return;
    
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
    
    if (!(await confirm({ message: confirmText, type: 'danger', confirmText: 'Удалить' }))) return;
    
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
    const confirmed = await confirm({
      title: 'ПОЛНАЯ ОЧИСТКА',
      message: 'Будет удалено:\n' +
        '• ВСЕ SQL логи\n' +
        '• ВСЯ история команд\n\n' +
        'НЕ будет затронуто (защищённые данные):\n' +
        '• Пользователи\n' +
        '• Серверы\n' +
        '• Отложенные команды\n' +
        '• Группы\n\n' +
        'Продолжить?',
      type: 'danger',
      confirmText: 'Очистить',
      cancelText: 'Отмена',
    });
    
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

  return {
    settings,
    setSettings,
    isLoaded,
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
  };
};

export default useCleanup;



