/**
 * Хук для управления отложенными командами
 */

import { useState, useEffect } from 'react';
import { scheduledCommandsAPI, serversAPI, groupsAPI, presetsAPI } from '../../api/api';
import api from '../../api/api';
import { useNotification } from '../../context/NotificationContext';
import { convertToUTC, convertFromUTC } from './scheduledUtils';

export default function useScheduledCommands() {
  const { success, error: showError, warning, confirm } = useNotification();
  
  // Состояние
  const [scheduledCommands, setScheduledCommands] = useState([]);
  const [servers, setServers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [schedulerSettings, setSchedulerSettings] = useState(null);
  
  // Модальные окна
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showPresetHelpModal, setShowPresetHelpModal] = useState(false);
  
  // Редактирование
  const [editingCommand, setEditingCommand] = useState(null);
  
  // Настройки
  const [settingsInterval, setSettingsInterval] = useState(5);
  const [resetCode, setResetCode] = useState('');
  const [schedulerEnabled, setSchedulerEnabled] = useState(() => {
    const saved = localStorage.getItem('schedulerEnabled');
    return saved !== null ? saved === 'true' : false;
  });
  
  // Форма
  const [formData, setFormData] = useState({
    name: '',
    commands: '',
    scheduledDate: '',
    scheduledTime: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    targetType: 'servers',
    serverIds: [],
    groupIds: [],
    useBotname: false,
    delayBetweenBots: 0,
    recurrenceType: 'once',
    weekdays: [],
  });

  // Загрузка данных при монтировании
  useEffect(() => {
    loadScheduledCommands();
    loadServers();
    loadGroups();
    loadSchedulerSettings();
    loadPresets();
    
    // Обновляем список каждые 30 секунд
    const interval = setInterval(loadScheduledCommands, 30000);
    return () => clearInterval(interval);
  }, []);

  // Загрузка отложенных команд
  const loadScheduledCommands = async () => {
    try {
      const response = await scheduledCommandsAPI.getAll();
      setScheduledCommands(response.data);
    } catch (error) {
      console.error('Error loading scheduled commands:', error);
    }
  };

  // Загрузка серверов
  const loadServers = async () => {
    try {
      const response = await serversAPI.getAll();
      setServers(response.data.filter(s => s.is_active));
    } catch (error) {
      console.error('Error loading servers:', error);
    }
  };

  // Загрузка групп
  const loadGroups = async () => {
    try {
      const response = await groupsAPI.getAll();
      // API возвращает {groups: ["name1", "name2"]}, конвертируем в массив объектов
      const groupNames = response.data.groups || [];
      const groupObjects = groupNames.map(name => ({ id: name, name: name }));
      setGroups(groupObjects);
    } catch (error) {
      console.error('Error loading groups:', error);
      setGroups([]);
    }
  };

  // Загрузка пресетов
  const loadPresets = async () => {
    try {
      const response = await presetsAPI.getAll();
      setPresets(response.data);
    } catch (error) {
      console.error('Error loading presets:', error);
    }
  };

  // Загрузка настроек планировщика
  const loadSchedulerSettings = async () => {
    try {
      const response = await scheduledCommandsAPI.getSettings();
      setSchedulerSettings(response.data);
      setSettingsInterval(response.data.check_interval);
      
      const localEnabled = localStorage.getItem('schedulerEnabled');
      if (localEnabled !== null) {
        const enabledState = localEnabled === 'true';
        setSchedulerEnabled(enabledState);
        
        if (response.data.enabled !== enabledState) {
          await scheduledCommandsAPI.updateSettings({ enabled: enabledState });
        }
      } else {
        const serverEnabled = response.data.enabled !== false;
        setSchedulerEnabled(serverEnabled);
        localStorage.setItem('schedulerEnabled', serverEnabled.toString());
      }
    } catch (error) {
      console.error('Error loading scheduler settings:', error);
    }
  };

  // Переключение планировщика
  const handleToggleScheduler = async () => {
    try {
      const newEnabled = !schedulerEnabled;
      await scheduledCommandsAPI.updateSettings({ enabled: newEnabled });
      setSchedulerEnabled(newEnabled);
      localStorage.setItem('schedulerEnabled', newEnabled.toString());
    } catch (error) {
      console.error('Error toggling scheduler:', error);
      showError(error.response?.data?.detail || 'Ошибка изменения состояния планировщика');
    }
  };

  // Сохранение настроек
  const handleSaveSettings = async () => {
    try {
      setLoading(true);
      await scheduledCommandsAPI.updateSettings({ check_interval: settingsInterval });
      await loadSchedulerSettings();
      setShowSettingsModal(false);
      success('Настройки сохранены! Изменения применятся автоматически в течение нескольких секунд.');
    } catch (error) {
      console.error('Error saving settings:', error);
      showError(error.response?.data?.detail || 'Ошибка сохранения настроек');
    } finally {
      setLoading(false);
    }
  };

  // Создание/редактирование команды
  const handleCreateCommand = async (e) => {
    e.preventDefault();
    
    if (formData.recurrenceType === 'weekly_days' && formData.weekdays.length === 0) {
      warning('Пожалуйста, выберите хотя бы один день недели');
      return;
    }
    
    setLoading(true);

    try {
      // Для повторяющихся команд (daily, weekly_days) используем упрощенную логику
      // Дата не важна - используется только время
      if (formData.recurrenceType === 'daily' || formData.recurrenceType === 'weekly_days') {
        const [hours, minutes, seconds = 0] = formData.scheduledTime.split(':').map(Number);
        
        // Используем сегодняшнюю дату как базу
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();
        const day = today.getDate();
        
        // Создаем UTC Date с этими компонентами
        const utcDate = new Date(Date.UTC(year, month, day, hours, minutes, seconds));
        
        // Получаем offset для выбранного часового пояса
        const getOffset = (date, timezone) => {
          const tzString = date.toLocaleString('en-US', { timeZone: timezone });
          const utcString = date.toLocaleString('en-US', { timeZone: 'UTC' });
          return new Date(tzString).getTime() - new Date(utcString).getTime();
        };
        
        const offset = getOffset(utcDate, formData.timezone);
        const correctedUtcDate = new Date(utcDate.getTime() - offset);
        
        const scheduledDateTime = correctedUtcDate.toISOString();
        const displayDateTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        
        const data = {
          name: formData.name,
          commands: formData.commands,
          scheduled_time: scheduledDateTime,
          display_time: displayDateTime,
          timezone: formData.timezone,
          target_type: formData.targetType,
          server_ids: formData.targetType === 'servers' ? formData.serverIds : [],
          group_ids: formData.targetType === 'groups' ? formData.groupIds : [],
          use_botname: formData.useBotname,
          delay_between_bots: parseInt(formData.delayBetweenBots) || 0,
          recurrence_type: formData.recurrenceType || 'once',
          weekdays: formData.recurrenceType === 'weekly_days' ? formData.weekdays : null,
        };

        if (editingCommand) {
          await scheduledCommandsAPI.update(editingCommand.id, data);
        } else {
          await scheduledCommandsAPI.create(data);
        }

        await loadScheduledCommands();
        resetForm();
        success('Команда успешно сохранена');
        return;
      }
      
      // Для остальных типов (once, weekly, monthly) - полная логика с датой
      const { isoString, displayTime, utcDate } = convertToUTC(
        formData.scheduledDate, 
        formData.scheduledTime, 
        formData.timezone
      );
      
      // Проверка: время не должно быть в прошлом
      const now = new Date();
      if (utcDate <= now) {
        const userTimeString = utcDate.toLocaleString('ru-RU', { 
          timeZone: formData.timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
        showError(`Ошибка: Выбранное время (${userTimeString} ${formData.timezone}) уже прошло. Выберите будущее время.`);
        setLoading(false);
        return;
      }

      const data = {
        name: formData.name,
        commands: formData.commands,
        scheduled_time: isoString,
        display_time: displayTime,
        timezone: formData.timezone,
        target_type: formData.targetType,
        server_ids: formData.targetType === 'servers' ? formData.serverIds : [],
        group_ids: formData.targetType === 'groups' ? formData.groupIds : [],
        use_botname: formData.useBotname,
        delay_between_bots: parseInt(formData.delayBetweenBots) || 0,
        recurrence_type: formData.recurrenceType || 'once',
        weekdays: formData.recurrenceType === 'weekly_days' ? formData.weekdays : null,
      };

      if (editingCommand) {
        await scheduledCommandsAPI.update(editingCommand.id, data);
      } else {
        await scheduledCommandsAPI.create(data);
      }

      await loadScheduledCommands();
      resetForm();
      success('Команда успешно сохранена');
    } catch (error) {
      console.error('Error saving scheduled command:', error);
      showError(error.response?.data?.detail || 'Ошибка сохранения');
    } finally {
      setLoading(false);
    }
  };

  // Редактирование команды
  const handleEdit = (command) => {
    const { date, time } = convertFromUTC(command.scheduled_time, command.timezone);
    
    setFormData({
      name: command.name,
      commands: command.commands,
      scheduledDate: date,
      scheduledTime: time,
      timezone: command.timezone || 'UTC',
      targetType: command.target_type || 'servers',
      serverIds: command.server_ids || [],
      groupIds: command.group_ids || [],
      useBotname: command.use_botname,
      delayBetweenBots: command.delay_between_bots,
      recurrenceType: command.recurrence_type || 'once',
      // Безопасный парсинг weekdays (может быть строка или массив)
      weekdays: (() => {
        if (!command.weekdays) return [];
        if (Array.isArray(command.weekdays)) return command.weekdays;
        try {
          return JSON.parse(command.weekdays);
        } catch {
          return [];
        }
      })(),
    });
    
    setEditingCommand(command);
    setShowCreateModal(true);
  };

  // Удаление команды
  const handleDelete = async (id) => {
    try {
      await scheduledCommandsAPI.delete(id);
      await loadScheduledCommands();
    } catch (error) {
      console.error('Error deleting scheduled command:', error);
    }
  };

  // Отмена команды
  const handleCancel = async (id) => {
    try {
      await scheduledCommandsAPI.cancel(id);
      await loadScheduledCommands();
    } catch (error) {
      console.error('Error cancelling scheduled command:', error);
    }
  };

  // Сброс системы
  const handleSystemReset = async () => {
    if (resetCode.toLowerCase() !== 'aezakmi') {
      showError('Неверный код доступа');
      return;
    }

    const finalConfirm = await confirm({
      title: 'СБРОС СИСТЕМЫ',
      message: 'Это действие:\n' +
        '• Удалит ВСЕ аккаунты пользователей\n' +
        '• Удалит ВСЕ данные о серверах\n' +
        '• Удалит ВСЕ команды и историю\n' +
        '• Удалит ВСЕ отложенные команды\n' +
        '• Удалит ВСЕ группы\n' +
        '• Очистит всю базу данных\n\n' +
        'Это действие НЕОБРАТИМО!\n\n' +
        'Продолжить?',
      type: 'danger',
      confirmText: 'Сбросить систему',
      cancelText: 'Отмена',
    });

    if (!finalConfirm) {
      setShowResetModal(false);
      setResetCode('');
      return;
    }

    try {
      setLoading(true);
      const response = await api.post('/api/system/reset', { code: resetCode });

      if (response.data.success) {
        success('Система успешно сброшена. Все данные удалены.\n\nВы будете перенаправлены на страницу регистрации.');
        localStorage.clear();
        window.location.href = '/register';
      }
    } catch (error) {
      console.error('System reset error:', error);
      if (error.response?.status === 403) {
        showError('Ошибка: Неверный код доступа');
      } else {
        showError('Ошибка при сбросе системы: ' + (error.response?.data?.detail || error.message));
      }
    } finally {
      setLoading(false);
      setShowResetModal(false);
      setResetCode('');
    }
  };

  // Загрузка пресета
  const handleLoadPreset = (preset) => {
    setFormData({ ...formData, commands: preset.commands });
  };

  // Сброс формы
  const resetForm = () => {
    setFormData({
      name: '',
      commands: '',
      scheduledDate: '',
      scheduledTime: '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      targetType: 'servers',
      serverIds: [],
      groupIds: [],
      useBotname: false,
      delayBetweenBots: 0,
      recurrenceType: 'once',
      weekdays: [],
    });
    setEditingCommand(null);
    setShowCreateModal(false);
  };

  return {
    // Данные
    scheduledCommands,
    servers,
    groups,
    presets,
    loading,
    schedulerSettings,
    schedulerEnabled,
    settingsInterval,
    resetCode,
    formData,
    editingCommand,
    
    // Модальные окна
    showCreateModal,
    showSettingsModal,
    showResetModal,
    showPresetHelpModal,
    setShowCreateModal,
    setShowSettingsModal,
    setShowResetModal,
    setShowPresetHelpModal,
    
    // Обработчики
    handleToggleScheduler,
    handleSaveSettings,
    handleCreateCommand,
    handleEdit,
    handleDelete,
    handleCancel,
    handleSystemReset,
    handleLoadPreset,
    resetForm,
    setFormData,
    setSettingsInterval,
    setResetCode,
  };
}



