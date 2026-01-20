/**
 * Хук для управления страницей резервного копирования данных.
 * 
 * Содержит всю логику:
 * - Состояния экспорта/импорта
 * - Обработчики событий
 * - API-вызовы
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/api';

const useDataBackup = ({ confirmDelete } = {}) => {
  const fileInputRef = useRef(null);
  
  // Состояния для экспорта
  const [exportPassword, setExportPassword] = useState('');
  const [exportPasswordConfirm, setExportPasswordConfirm] = useState('');
  const [showExportPassword, setShowExportPassword] = useState(false);
  const [includeOrders, setIncludeOrders] = useState(true);
  const [includeCharts, setIncludeCharts] = useState(false);
  const [includeLogs, setIncludeLogs] = useState(false);
  const [exporting, setExporting] = useState(false);
  
  // Состояния для импорта
  const [importFile, setImportFile] = useState(null);
  const [importPassword, setImportPassword] = useState('');
  const [showImportPassword, setShowImportPassword] = useState(false);
  const [importMode, setImportMode] = useState('merge');
  const [importing, setImporting] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [validating, setValidating] = useState(false);
  
  // Общие состояния
  const [preview, setPreview] = useState(null);
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Загрузка данных
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [previewRes, backupsRes] = await Promise.all([
        api.get('/api/data/preview').catch(() => ({ data: {} })),
        api.get('/api/data/backups').catch(() => ({ data: { backups: [] } }))
      ]);
      
      setPreview(previewRes.data);
      setBackups(backupsRes.data.backups || []);
      
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Экспорт данных
  const handleExport = async () => {
    if (!exportPassword) {
      setError('Введите пароль для шифрования');
      return;
    }
    
    if (exportPassword.length < 4) {
      setError('Пароль должен быть не менее 4 символов');
      return;
    }
    
    if (exportPassword !== exportPasswordConfirm) {
      setError('Пароли не совпадают');
      return;
    }
    
    try {
      setExporting(true);
      setError(null);
      
      const response = await api.post('/api/data/export', {
        password: exportPassword,
        include_orders: includeOrders,
        include_charts: includeCharts,
        include_logs: includeLogs
      }, {
        responseType: 'blob'
      });
      
      // Получаем имя файла из заголовка
      const contentDisposition = response.headers['content-disposition'];
      let filename = 'moonbot_export.mbc';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) filename = match[1];
      }
      
      // Скачиваем файл
      const blob = new Blob([response.data], { type: 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setSuccess('Данные успешно экспортированы!');
      setExportPassword('');
      setExportPasswordConfirm('');
      
    } catch (err) {
      console.error('Export error:', err);
      setError(err.response?.data?.detail || 'Ошибка экспорта данных');
    } finally {
      setExporting(false);
    }
  };

  // Выбор файла для импорта
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImportFile(file);
      setValidationResult(null);
      setError(null);
    }
  };

  // Валидация файла
  const handleValidate = async () => {
    if (!importFile) {
      setError('Выберите файл для импорта');
      return;
    }
    
    if (!importPassword) {
      setError('Введите пароль');
      return;
    }
    
    try {
      setValidating(true);
      setError(null);
      
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('password', importPassword);
      
      const response = await api.post('/api/data/validate', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setValidationResult(response.data);
      setSuccess('Файл успешно проверен');
      
    } catch (err) {
      console.error('Validation error:', err);
      setError(err.response?.data?.detail || 'Ошибка валидации файла');
      setValidationResult(null);
    } finally {
      setValidating(false);
    }
  };

  // Импорт данных
  const handleImport = async () => {
    if (!importFile || !validationResult) {
      setError('Сначала проверьте файл');
      return;
    }
    
    try {
      setImporting(true);
      setError(null);
      
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('password', importPassword);
      formData.append('mode', importMode);
      
      const response = await api.post('/api/data/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const result = response.data;
      
      let message = 'Данные успешно импортированы!\n';
      if (result.imported) {
        const tables = Object.entries(result.imported)
          .filter(([, count]) => count > 0)
          .map(([table, count]) => `${table}: ${count}`)
          .join(', ');
        if (tables) message += `Импортировано: ${tables}`;
      }
      
      setSuccess(message);
      setImportFile(null);
      setImportPassword('');
      setValidationResult(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      
      // Обновляем список бэкапов
      fetchData();
      
    } catch (err) {
      console.error('Import error:', err);
      setError(err.response?.data?.detail || 'Ошибка импорта данных');
    } finally {
      setImporting(false);
    }
  };

  // Восстановление из бэкапа
  const handleRestore = async (backupPath) => {
    if (confirmDelete) {
      const confirmed = await confirmDelete(
        'Вы уверены? Текущие данные будут заменены данными из бэкапа!',
        { title: 'Восстановление из бэкапа', confirmText: 'Восстановить' }
      );
      if (!confirmed) return;
    }
    
    try {
      setError(null);
      
      await api.post('/api/data/restore', { backup_path: backupPath });
      
      setSuccess('База данных восстановлена из бэкапа');
      fetchData();
      
    } catch (err) {
      console.error('Restore error:', err);
      setError(err.response?.data?.detail || 'Ошибка восстановления');
    }
  };

  // Форматирование размера файла
  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Форматирование даты
  const formatDate = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleString('ru-RU');
  };

  return {
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
  };
};

export default useDataBackup;


