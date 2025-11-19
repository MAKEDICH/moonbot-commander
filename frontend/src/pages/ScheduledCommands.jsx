import React, { useState, useEffect } from 'react';
import { FiClock, FiTrash2, FiEdit2, FiX, FiCheck, FiPlus, FiCalendar, FiServer } from 'react-icons/fi';
import { scheduledCommandsAPI, serversAPI, groupsAPI, presetsAPI } from '../api/api';
import api from '../api/api';
import styles from './ScheduledCommands.module.css';
import { useNotification } from '../context/NotificationContext';

const ScheduledCommands = () => {
  const { success, error: showError, warning, confirm } = useNotification();
  const [scheduledCommands, setScheduledCommands] = useState([]);
  const [servers, setServers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCommand, setEditingCommand] = useState(null);
  const [schedulerSettings, setSchedulerSettings] = useState(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsInterval, setSettingsInterval] = useState(5);
  const [presets, setPresets] = useState([]);  // Пресеты команд
  const [showPresetHelpModal, setShowPresetHelpModal] = useState(false);  // Модальное окно помощи
  const [schedulerEnabled, setSchedulerEnabled] = useState(() => {
    // Загружаем из localStorage или по умолчанию false
    const saved = localStorage.getItem('schedulerEnabled');
    return saved !== null ? saved === 'true' : false;
  });
  
  // Скрытая функция сброса системы
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetCode, setResetCode] = useState('');
  
  // Форма для создания/редактирования
  const [formData, setFormData] = useState({
    name: '',
    commands: '',
    scheduledDate: '',
    scheduledTime: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, // Автоматически определяем часовой пояс
    targetType: 'servers', // servers или groups
    serverIds: [],
    groupIds: [],
    useBotname: false,
    delayBetweenBots: 0,
    recurrenceType: 'once', // Новое: once, daily, weekly, monthly, weekly_days
    weekdays: [], // Новое: массив дней недели [0-6], где 0=Пн, 6=Вс
  });

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

  const loadScheduledCommands = async () => {
    try {
      const response = await scheduledCommandsAPI.getAll();
      setScheduledCommands(response.data);
    } catch (error) {
      console.error('Error loading scheduled commands:', error);
    }
  };

  const loadServers = async () => {
    try {
      const response = await serversAPI.getAll();
      setServers(response.data.filter(s => s.is_active));
    } catch (error) {
      console.error('Error loading servers:', error);
    }
  };

  const loadGroups = async () => {
    try {
      const response = await groupsAPI.getAll();
      setGroups(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error loading groups:', error);
      setGroups([]);
    }
  };

  const loadPresets = async () => {
    try {
      const response = await presetsAPI.getAll();
      setPresets(response.data);
    } catch (error) {
      console.error('Error loading presets:', error);
    }
  };

  const handleLoadPreset = (preset) => {
    setFormData({ ...formData, commands: preset.commands });
  };

  const loadSchedulerSettings = async () => {
    try {
      const response = await scheduledCommandsAPI.getSettings();
      setSchedulerSettings(response.data);
      setSettingsInterval(response.data.check_interval);
      
      // Синхронизируем с сервером, но приоритет у localStorage
      const localEnabled = localStorage.getItem('schedulerEnabled');
      if (localEnabled !== null) {
        // Если есть в localStorage - используем его и обновляем сервер
        const enabledState = localEnabled === 'true';
        setSchedulerEnabled(enabledState);
        
        // Синхронизируем с сервером если отличается
        if (response.data.enabled !== enabledState) {
          await scheduledCommandsAPI.updateSettings({ enabled: enabledState });
        }
      } else {
        // Если нет в localStorage - берем с сервера
        const serverEnabled = response.data.enabled !== false;
        setSchedulerEnabled(serverEnabled);
        localStorage.setItem('schedulerEnabled', serverEnabled.toString());
      }
    } catch (error) {
      console.error('Error loading scheduler settings:', error);
    }
  };

  const handleToggleScheduler = async () => {
    try {
      const newEnabled = !schedulerEnabled;
      await scheduledCommandsAPI.updateSettings({ enabled: newEnabled });
      setSchedulerEnabled(newEnabled);
      
      // Сохраняем в localStorage
      localStorage.setItem('schedulerEnabled', newEnabled.toString());
      
      console.log(`Scheduler ${newEnabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error toggling scheduler:', error);
      showError(error.response?.data?.detail || 'Ошибка изменения состояния планировщика');
    }
  };

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
      
      // Используем API клиент
      const response = await api.post('/api/system/reset', { code: resetCode });

      if (response.data.success) {
        success('Система успешно сброшена. Все данные удалены.\n\nВы будете перенаправлены на страницу регистрации.');
        
        // Очищаем localStorage
        localStorage.clear();
        
        // Перезагружаем страницу для выхода
        window.location.href = '/register';
      }
    } catch (error) {
      console.error('System reset error:', error);
      console.error('Error response:', error.response);
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

  const handleCreateCommand = async (e) => {
    e.preventDefault();
    
    // Валидация дней недели
    if (formData.recurrenceType === 'weekly_days' && formData.weekdays.length === 0) {
      warning('Пожалуйста, выберите хотя бы один день недели');
      return;
    }
    
    setLoading(true);

    try {
      // Простая и надежная конвертация времени
      // Пользователь вводит время для выбранного часового пояса
      
      // Шаг 1: Создаем строку даты-времени
      const dateTimeString = `${formData.scheduledDate}T${formData.scheduledTime}`;
      
      // Шаг 2: Создаем временную дату для получения timestamp
      const tempDate = new Date(dateTimeString);
      
      // Шаг 3: Получаем offset для выбранного часового пояса
      // Используем luxon-подобный подход через Intl API
      const targetDate = new Date(dateTimeString);
      
      // Форматируем в UTC
      const utcFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      
      // Форматируем в выбранном часовом поясе
      const tzFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: formData.timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      
      // Получаем offset в миллисекундах
      const getOffset = (date, timezone) => {
        const tzString = date.toLocaleString('en-US', { timeZone: timezone });
        const utcString = date.toLocaleString('en-US', { timeZone: 'UTC' });
        return new Date(tzString).getTime() - new Date(utcString).getTime();
      };
      
      const offset = getOffset(tempDate, formData.timezone);
      
      // Пользователь ввел время для конкретного часового пояса
      // Нам нужно создать UTC время, которое в выбранном часовом поясе будет показывать введенное время
      
      // Парсим компоненты даты
      const [year, month, day] = formData.scheduledDate.split('-').map(Number);
      const [hours, minutes, seconds = 0] = formData.scheduledTime.split(':').map(Number);
      
      // Создаем UTC Date с этими компонентами
      const utcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));
      
      // Корректируем на offset часового пояса
      const correctedUtcDate = new Date(utcDate.getTime() - offset);
      
      // Проверка: время не должно быть в прошлом
      const now = new Date();
      if (correctedUtcDate <= now) {
        const userTimeString = new Date(correctedUtcDate).toLocaleString('ru-RU', { 
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
      
      const scheduledDateTime = correctedUtcDate.toISOString();
      
      // Форматируем display_time в читаемый формат
      const displayDateTime = `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}, ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      
      // Отладка
      console.log('=== DEBUG ===');
      console.log('Input (user entered):', formData.scheduledDate, formData.scheduledTime, formData.timezone);
      console.log('UTC Date (naive):', utcDate.toISOString());
      console.log('Offset (ms):', offset, '(' + (offset / 3600000) + ' hours)');
      console.log('Corrected UTC:', scheduledDateTime);
      console.log('Will DISPLAY as:', displayDateTime);

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
        recurrence_type: formData.recurrenceType || 'once', // Новое: тип повторения
        weekdays: formData.recurrenceType === 'weekly_days' ? formData.weekdays : null, // Новое: дни недели
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

  const handleEdit = (command) => {
    // Парсим UTC время из БД
    const utcDate = new Date(command.scheduled_time);
    
    // Конвертируем в сохраненный часовой пояс (command.timezone)
    const targetTimezone = command.timezone || 'UTC';
    
    // Форматируем дату в целевом часовом поясе
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: targetTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    const parts = formatter.formatToParts(utcDate);
    const year = parts.find(p => p.type === 'year').value;
    const month = parts.find(p => p.type === 'month').value;
    const day = parts.find(p => p.type === 'day').value;
    const hours = parts.find(p => p.type === 'hour').value;
    const minutes = parts.find(p => p.type === 'minute').value;
    const seconds = parts.find(p => p.type === 'second').value;
    
    setFormData({
      name: command.name,
      commands: command.commands,
      scheduledDate: `${year}-${month}-${day}`,
      scheduledTime: `${hours}:${minutes}:${seconds}`,
      timezone: targetTimezone,
      targetType: command.target_type || 'servers',
      serverIds: command.server_ids || [],
      groupIds: command.group_ids || [],
      useBotname: command.use_botname,
      delayBetweenBots: command.delay_between_bots,
      recurrenceType: command.recurrence_type || 'once',
      weekdays: command.weekdays ? JSON.parse(command.weekdays) : [],
    });
    
    setEditingCommand(command);
    setShowCreateModal(true);
  };

  const handleDelete = async (id) => {
    try {
      await scheduledCommandsAPI.delete(id);
      await loadScheduledCommands();
    } catch (error) {
      console.error('Error deleting scheduled command:', error);
    }
  };

  const handleCancel = async (id) => {
    try {
      await scheduledCommandsAPI.cancel(id);
      await loadScheduledCommands();
    } catch (error) {
      console.error('Error cancelling scheduled command:', error);
    }
  };

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

  const getStatusBadge = (status) => {
    const badges = {
      pending: { label: 'Ожидает', className: styles.statusPending },
      executing: { label: 'Выполняется', className: styles.statusExecuting },
      completed: { label: 'Выполнено', className: styles.statusCompleted },
      failed: { label: 'Ошибка', className: styles.statusFailed },
      cancelled: { label: 'Отменено', className: styles.statusCancelled },
    };
    
    const badge = badges[status] || { label: status, className: '' };
    return <span className={`${styles.statusBadge} ${badge.className}`}>{badge.label}</span>;
  };

  const formatDateTime = (isoString, timezone = null) => {
    if (!timezone) {
      const date = new Date(isoString);
      return date.toLocaleString('ru-RU');
    }
    
    // Ручная конвертация с учетом timezone
    const date = new Date(isoString);
    const formatter = new Intl.DateTimeFormat('ru-RU', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    const parts = formatter.formatToParts(date);
    const year = parts.find(p => p.type === 'year').value;
    const month = parts.find(p => p.type === 'month').value;
    const day = parts.find(p => p.type === 'day').value;
    const hour = parts.find(p => p.type === 'hour').value;
    const minute = parts.find(p => p.type === 'minute').value;
    const second = parts.find(p => p.type === 'second').value;
    
    return `${day}.${month}.${year}, ${hour}:${minute}:${second}`;
  };

  const getServerNames = (serverIds) => {
    return serverIds
      .map(id => servers.find(s => s.id === id)?.name || `Server #${id}`)
      .join(', ');
  };

  const getGroupNames = (groupIds) => {
    if (!groupIds || groupIds.length === 0) return 'Нет';
    return groups
      .filter(g => groupIds.includes(g.id))
      .map(g => g.name)
      .join(', ') || 'Неизвестно';
  };

  const getTargetInfo = (command) => {
    if (command.target_type === 'groups' && command.group_ids && command.group_ids.length > 0) {
      return `Группы: ${getGroupNames(command.group_ids)}`;
    }
    return `Серверы: ${getServerNames(command.server_ids || [])}`;
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>
          <FiClock /> Отложенные команды
          {/* Скрытая кнопка сброса - выглядит как точка */}
          <span 
            className={styles.hiddenResetBtn}
            onClick={() => setShowResetModal(true)}
            title=""
          ></span>
        </h1>
        <div className={styles.headerButtons}>
          <label className={styles.schedulerToggle}>
            <input
              type="checkbox"
              checked={schedulerEnabled}
              onChange={handleToggleScheduler}
            />
            <span className={styles.toggleSlider}></span>
            <span className={styles.toggleLabel}>
              {schedulerEnabled ? '✅ Планировщик включен' : '⏸️ Планировщик выключен'}
            </span>
          </label>
          <button 
            className={styles.settingsBtn}
            onClick={() => setShowSettingsModal(true)}
            title="Справка о работе планировщика"
          >
            ⚙️ Справка
          </button>
          <button 
            className={styles.createBtn}
            onClick={() => setShowCreateModal(true)}
          >
            <FiPlus /> Создать отложенную команду
          </button>
        </div>
      </div>

      <div className={styles.commandsList}>
        {scheduledCommands.length === 0 ? (
          <div className={styles.emptyState}>
            <FiClock size={48} />
            <p>Нет отложенных команд</p>
            <button onClick={() => setShowCreateModal(true)}>
              Создать первую команду
            </button>
          </div>
        ) : (
          scheduledCommands.map(command => (
            <div key={command.id} className={styles.commandCard}>
              <div className={styles.commandHeader}>
                <h3>{command.name}</h3>
                {getStatusBadge(command.status)}
              </div>

              <div className={styles.commandDetails}>
                <div className={styles.detailRow}>
                  <FiCalendar />
                  <span>Запланировано: {command.display_time ? command.display_time : formatDateTime(command.scheduled_time, command.timezone)} ({command.timezone})</span>
                </div>

                <div className={styles.detailRow}>
                  <FiServer />
                  <span>{getTargetInfo(command)}</span>
                </div>

                <div className={styles.commandsPreview}>
                  <strong>Команды:</strong>
                  <pre>{command.commands}</pre>
                </div>

                {/* Режим выполнения */}
                {command.recurrence_type && (
                  <div className={styles.detailRow}>
                    <strong>Режим:</strong>{' '}
                    {command.recurrence_type === 'once' && 'Один раз'}
                    {command.recurrence_type === 'daily' && 'Ежедневно'}
                    {command.recurrence_type === 'weekly' && 'Еженедельно (каждые 7 дней)'}
                    {command.recurrence_type === 'monthly' && 'Ежемесячно (то же число)'}
                    {command.recurrence_type === 'weekly_days' && (() => {
                      try {
                        const weekdays = JSON.parse(command.weekdays || '[]');
                        const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
                        return `По дням недели: ${weekdays.map(d => dayNames[d]).join(', ')}`;
                      } catch {
                        return 'По дням недели';
                      }
                    })()}
                  </div>
                )}

                {command.executed_at && (
                  <div className={styles.detailRow}>
                    <span>Выполнено: {formatDateTime(command.executed_at)}</span>
                  </div>
                )}

                {command.error_message && (
                  <div className={styles.errorMessage}>
                    <strong>Ошибка:</strong> {command.error_message}
                  </div>
                )}

                <div className={styles.commandSettings}>
                  {command.use_botname && <span className={styles.settingBadge}>Префикс botname</span>}
                  {command.delay_between_bots > 0 && (
                    <span className={styles.settingBadge}>
                      Задержка: {command.delay_between_bots}с
                    </span>
                  )}
                </div>
              </div>

              <div className={styles.commandActions}>
                {command.status === 'pending' && (
                  <>
                    <button
                      onClick={() => handleEdit(command)}
                      className={styles.editBtn}
                      title="Редактировать"
                    >
                      <FiEdit2 /> Редактировать
                    </button>
                    <button
                      onClick={() => handleCancel(command.id)}
                      className={styles.cancelBtn}
                      title="Отменить"
                    >
                      <FiX /> Отменить
                    </button>
                  </>
                )}
                
                <button
                  onClick={() => handleDelete(command.id)}
                  className={styles.deleteBtn}
                  title="Удалить"
                >
                  <FiTrash2 /> Удалить
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Модальное окно создания/редактирования */}
      {showCreateModal && (
        <div 
          className={styles.modal}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              e.preventDefault();
              resetForm();
            }
          }}
        >
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2>{editingCommand ? 'Редактировать' : 'Создать'} отложенную команду</h2>
              <button onClick={resetForm} className={styles.closeBtn}>
                <FiX />
              </button>
            </div>

            <form onSubmit={handleCreateCommand} className={styles.form}>
              <div className={styles.formGroup}>
                <label>Название задачи *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Например: Утренний рестарт"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label>Команды (каждая с новой строки) *</label>
                
                {/* Пресеты команд */}
                <div className={styles.commandPresets}>
                  {presets.length > 0 ? (
                    <>
                      <div className={styles.presetsTitle}>📋 Готовые сценарии (пресеты):</div>
                      <div className={styles.presetsGrid}>
                        {presets.map(preset => (
                          <div key={preset.id} className={styles.presetWrapper}>
                            <button
                              type="button"
                              className={styles.presetBtn}
                              onClick={() => handleLoadPreset(preset)}
                              title={`${preset.name}\n\nКоманды:\n${preset.commands}`}
                            >
                              {preset.button_number}
                            </button>
                            <div className={styles.presetLabel}>{preset.name}</div>
                          </div>
                        ))}
                      </div>
                      <div className={styles.presetHint}>
                        💡 Нажмите на кнопку чтобы загрузить команды из пресета
                      </div>
                    </>
                  ) : (
                    <div className={styles.noPresetsBlock}>
                      <div className={styles.noPresetsIcon}>📋</div>
                      <div 
                        className={styles.noPresetsText}
                        onClick={() => setShowPresetHelpModal(true)}
                      >
                        Пресеты не созданы
                      </div>
                      <div className={styles.noPresetsHint}>
                        👆 Нажмите чтобы узнать как создать
                      </div>
                    </div>
                  )}
                </div>
                
                <textarea
                  value={formData.commands}
                  onChange={(e) => setFormData({ ...formData, commands: e.target.value })}
                  placeholder="list&#10;report&#10;START"
                  rows={6}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label>Режим выполнения *</label>
                <select
                  value={formData.recurrenceType}
                  onChange={(e) => {
                    const newType = e.target.value;
                    setFormData({ 
                      ...formData, 
                      recurrenceType: newType, 
                      weekdays: [],
                      // Очищаем дату для daily и weekly_days
                      scheduledDate: (newType === 'daily' || newType === 'weekly_days') ? '' : formData.scheduledDate
                    });
                  }}
                  className={styles.timezoneSelect}
                  required
                >
                  <option value="once">Один раз (в указанные дату и время)</option>
                  <option value="daily">Ежедневно (каждый день в указанное время)</option>
                  <option value="weekly">Еженедельно (раз в 7 дней)</option>
                  <option value="monthly">Ежемесячно (в тот же день каждого месяца)</option>
                  <option value="weekly_days">По дням недели (выбрать конкретные дни)</option>
                </select>
                <small>
                  {formData.recurrenceType === 'once' && 'Команда выполнится один раз и будет помечена как выполненная'}
                  {formData.recurrenceType === 'daily' && 'Команда будет выполняться каждый день в указанное время'}
                  {formData.recurrenceType === 'weekly' && 'Команда будет выполняться раз в неделю в указанное время'}
                  {formData.recurrenceType === 'monthly' && 'Команда будет выполняться каждый месяц в тот же день (или последний день месяца)'}
                  {formData.recurrenceType === 'weekly_days' && 'Выберите дни недели ниже - команда будет выполняться только в выбранные дни'}
                </small>
              </div>

              {formData.recurrenceType === 'weekly_days' && (
                <div className={styles.formGroup}>
                  <label>Выберите дни недели *</label>
                  
                  {/* Быстрые пресеты */}
                  <div className={styles.weekdayPresets}>
                    <button
                      type="button"
                      className={styles.presetButton}
                      onClick={() => setFormData({ ...formData, weekdays: [0, 1, 2, 3, 4] })}
                      title="Понедельник - Пятница"
                    >
                      Рабочие дни
                    </button>
                    <button
                      type="button"
                      className={styles.presetButton}
                      onClick={() => setFormData({ ...formData, weekdays: [5, 6] })}
                      title="Суббота - Воскресенье"
                    >
                      Выходные
                    </button>
                    <button
                      type="button"
                      className={styles.presetButton}
                      onClick={() => setFormData({ ...formData, weekdays: [] })}
                      title="Сбросить выбор"
                    >
                      Очистить
                    </button>
                  </div>

                  {/* Дни недели */}
                  <div className={styles.weekdaysSelector}>
                    {[
                      { value: 0, label: 'Пн', fullName: 'Понедельник' },
                      { value: 1, label: 'Вт', fullName: 'Вторник' },
                      { value: 2, label: 'Ср', fullName: 'Среда' },
                      { value: 3, label: 'Чт', fullName: 'Четверг' },
                      { value: 4, label: 'Пт', fullName: 'Пятница' },
                      { value: 5, label: 'Сб', fullName: 'Суббота' },
                      { value: 6, label: 'Вс', fullName: 'Воскресенье' },
                    ].map((day) => {
                      const isSelected = formData.weekdays.includes(day.value);
                      return (
                        <button
                          key={day.value}
                          type="button"
                          className={`${styles.weekdayButton} ${isSelected ? styles.weekdayButtonActive : ''}`}
                          onClick={() => {
                            if (isSelected) {
                              setFormData({ ...formData, weekdays: formData.weekdays.filter(d => d !== day.value) });
                            } else {
                              setFormData({ ...formData, weekdays: [...formData.weekdays, day.value].sort() });
                            }
                          }}
                          title={day.fullName}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                  
                  <small className={styles.weekdayHint}>
                    {formData.weekdays.length === 0 && '⚠️ Выберите хотя бы один день недели'}
                    {formData.weekdays.length > 0 && (
                      <>
                        ✓ Выбрано: {formData.weekdays.length} {
                          formData.weekdays.length === 1 ? 'день' :
                          formData.weekdays.length < 5 ? 'дня' : 'дней'
                        }
                      </>
                    )}
                  </small>
                </div>
              )}

              <div className={styles.dateTimeGroup}>
                <div className={styles.formGroup}>
                  <label>
                    Дата выполнения {(formData.recurrenceType === 'once' || formData.recurrenceType === 'weekly' || formData.recurrenceType === 'monthly') ? '*' : ''}
                    {(formData.recurrenceType === 'daily' || formData.recurrenceType === 'weekly_days') && (
                      <span className={styles.labelNote}>(не требуется)</span>
                    )}
                  </label>
                  <div className={styles.inputWrapper}>
                    <input
                      type="date"
                      value={formData.scheduledDate}
                      onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                      min={new Date().toISOString().split('T')[0]}
                      required={formData.recurrenceType === 'once' || formData.recurrenceType === 'weekly' || formData.recurrenceType === 'monthly'}
                      disabled={formData.recurrenceType === 'daily' || formData.recurrenceType === 'weekly_days'}
                      className={`${(formData.recurrenceType === 'daily' || formData.recurrenceType === 'weekly_days') ? styles.inputDisabled : ''}`}
                    />
                    {(formData.recurrenceType === 'daily' || formData.recurrenceType === 'weekly_days') && (
                      <div className={styles.disabledOverlay}>
                        <span className={styles.disabledIcon}>🔒</span>
                        <span className={styles.disabledText}>
                          {formData.recurrenceType === 'daily' && 'Выполняется каждый день'}
                          {formData.recurrenceType === 'weekly_days' && 'Выполняется в выбранные дни'}
                        </span>
                      </div>
                    )}
                  </div>
                  <small>
                    {formData.recurrenceType === 'once' && 'Команда выполнится один раз в эту дату'}
                    {formData.recurrenceType === 'daily' && '⚡ Дата не нужна - команда будет выполняться каждый день'}
                    {formData.recurrenceType === 'weekly' && 'Дата первого запуска, далее каждые 7 дней'}
                    {formData.recurrenceType === 'monthly' && 'Дата первого запуска, далее каждый месяц в это число'}
                    {formData.recurrenceType === 'weekly_days' && '⚡ Дата не нужна - команда будет выполняться в выбранные дни недели'}
                  </small>
                </div>

                <div className={styles.formGroup}>
                  <label>Время выполнения (до секунд) *</label>
                  <input
                    type="time"
                    step="1"
                    value={formData.scheduledTime}
                    onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Часовой пояс *</label>
                <select
                  value={formData.timezone}
                  onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                  className={styles.timezoneSelect}
                  required
                >
                  <option value="UTC">UTC (GMT+0)</option>
                  <option value="Europe/London">London (GMT+0)</option>
                  <option value="Europe/Paris">Paris (GMT+1)</option>
                  <option value="Europe/Moscow">Moscow (GMT+3)</option>
                  <option value="Europe/Istanbul">Istanbul (GMT+3)</option>
                  <option value="Asia/Dubai">Dubai (GMT+4)</option>
                  <option value="Asia/Tashkent">Tashkent (GMT+5)</option>
                  <option value="Asia/Almaty">Almaty (GMT+6)</option>
                  <option value="Asia/Bangkok">Bangkok (GMT+7)</option>
                  <option value="Asia/Shanghai">Shanghai (GMT+8)</option>
                  <option value="Asia/Tokyo">Tokyo (GMT+9)</option>
                  <option value="Asia/Seoul">Seoul (GMT+9)</option>
                  <option value="Australia/Sydney">Sydney (GMT+11)</option>
                  <option value="Pacific/Auckland">Auckland (GMT+13)</option>
                  <option value="America/New_York">New York (GMT-5)</option>
                  <option value="America/Chicago">Chicago (GMT-6)</option>
                  <option value="America/Denver">Denver (GMT-7)</option>
                  <option value="America/Los_Angeles">Los Angeles (GMT-8)</option>
                  <option value="America/Anchorage">Anchorage (GMT-9)</option>
                  <option value="Pacific/Honolulu">Honolulu (GMT-10)</option>
                </select>
                <small>Выберите часовой пояс, в котором хотите указать время</small>
              </div>

              <div className={styles.formGroup}>
                <label>Отправить на *</label>
                <div className={styles.targetTypeSelector}>
                  <label className={styles.radioLabel}>
                    <input
                      type="radio"
                      name="targetType"
                      value="servers"
                      checked={formData.targetType === 'servers'}
                      onChange={(e) => setFormData({ ...formData, targetType: e.target.value, serverIds: [], groupIds: [] })}
                    />
                    <span>Серверы</span>
                  </label>
                  <label className={styles.radioLabel}>
                    <input
                      type="radio"
                      name="targetType"
                      value="groups"
                      checked={formData.targetType === 'groups'}
                      onChange={(e) => setFormData({ ...formData, targetType: e.target.value, serverIds: [], groupIds: [] })}
                    />
                    <span>Группы</span>
                  </label>
                </div>
              </div>

              {formData.targetType === 'servers' ? (
                <div className={styles.formGroup}>
                  <label>Выберите серверы *</label>
                  <div className={styles.serversList}>
                    {servers.map(server => (
                      <label key={server.id} className={styles.serverCheckbox}>
                        <input
                          type="checkbox"
                          checked={formData.serverIds.includes(server.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                serverIds: [...formData.serverIds, server.id]
                              });
                            } else {
                              setFormData({
                                ...formData,
                                serverIds: formData.serverIds.filter(id => id !== server.id)
                              });
                            }
                          }}
                        />
                        <span>{server.name} ({server.botname})</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
                <div className={styles.formGroup}>
                  <label>Выберите группы *</label>
                  <div className={styles.serversList}>
                    {groups.map(group => (
                      <label key={group.id} className={styles.serverCheckbox}>
                        <input
                          type="checkbox"
                          checked={formData.groupIds.includes(group.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                groupIds: [...formData.groupIds, group.id]
                              });
                            } else {
                              setFormData({
                                ...formData,
                                groupIds: formData.groupIds.filter(id => id !== group.id)
                              });
                            }
                          }}
                        />
                        <span>{group.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className={styles.formGroup}>
                <label className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={formData.useBotname}
                    onChange={(e) => setFormData({ ...formData, useBotname: e.target.checked })}
                  />
                  <span>Префикс <code>botname:</code></span>
                </label>
              </div>

              <div className={styles.formGroup}>
                <label>Задержка между ботами (сек)</label>
                <input
                  type="number"
                  value={formData.delayBetweenBots}
                  onChange={(e) => setFormData({ ...formData, delayBetweenBots: e.target.value })}
                  min="0"
                  max="3600"
                  placeholder="0"
                />
                <small>Применяется только если выбрано больше 1 бота</small>
              </div>

              <div className={styles.modalActions}>
                <button type="submit" className={styles.saveBtn} disabled={loading}>
                  <FiCheck /> {loading ? 'Сохранение...' : 'Сохранить'}
                </button>
                <button type="button" onClick={resetForm} className={styles.cancelBtnModal}>
                  <FiX /> Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно настроек scheduler */}
      {showSettingsModal && (
        <div 
          className={styles.modalOverlay}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              e.preventDefault();
              setShowSettingsModal(false);
            }
          }}
        >
          <div className={styles.modalContent}>
            <h2>⚙️ О работе планировщика</h2>
            
            <div className={styles.settingsSection}>
              <div className={styles.settingsInfo}>
                <div className={styles.controlInfo}>
                  <h4>🎛️ Управление планировщиком:</h4>
                  <p>
                    Используйте <strong>переключатель</strong> в шапке страницы для включения/выключения планировщика.
                  </p>
                  <ul>
                    <li>✅ <strong>Включен</strong> - планировщик активен, команды выполняются по расписанию</li>
                    <li>⏸️ <strong>Выключен</strong> - планировщик приостановлен, команды не выполняются (но остаются в очереди)</li>
                  </ul>
                  <p className={styles.warningText}>
                    ⚠️ При выключении планировщика все отложенные команды остаются в базе и будут выполнены после повторного включения, если их время еще не прошло.
                  </p>
                </div>
                
                <h4>🧠 Умный режим работы:</h4>
                
                <div className={styles.smartModeInfo}>
                  <div className={styles.modeStep}>
                    <span className={styles.stepIcon}>💤</span>
                    <div>
                      <strong>Режим ожидания</strong>
                      <p>Когда нет команд, планировщик проверяет базу данных раз в 5 секунд</p>
                    </div>
                  </div>
                  
                  <div className={styles.modeStep}>
                    <span className={styles.stepIcon}>⏰</span>
                    <div>
                      <strong>Обнаружение команды</strong>
                      <p>При появлении команды планировщик переходит в активный режим мониторинга</p>
                    </div>
                  </div>
                  
                  <div className={styles.modeStep}>
                    <span className={styles.stepIcon}>⚡</span>
                    <div>
                      <strong>Точное выполнение</strong>
                      <p>Каждые 0.5 секунды проверяет наступило ли точное время выполнения. Команда отправляется секунда в секунду с назначенным временем</p>
                    </div>
                  </div>
                  
                  <div className={styles.modeStep}>
                    <span className={styles.stepIcon}>✅</span>
                    <div>
                      <strong>После выполнения</strong>
                      <p>Сразу после выполнения команды проверяет следующую в очереди. Если её нет - возвращается в режим ожидания</p>
                    </div>
                  </div>
                </div>
                
                <div className={styles.benefitsBox}>
                  <h4>💡 Преимущества:</h4>
                  <ul>
                    <li>⚡ <strong>Точность до секунды</strong> - команды выполняются ровно в назначенное время</li>
                    <li>💾 <strong>Минимальная нагрузка</strong> - проверки раз в 5 секунд когда нет команд, раз в 0.5 секунды когда есть</li>
                    <li>🔋 <strong>Экономия ресурсов</strong> - CPU и память не загружаются впустую</li>
                    <li>🎯 <strong>Автоматическая оптимизация</strong> - автоматически переключается между режимами ожидания и активного мониторинга</li>
                    <li>⏸️ <strong>Возможность паузы</strong> - можно временно приостановить выполнение команд</li>
                  </ul>
                </div>
                
                <p className={styles.infoText}>
                  📊 <strong>Пример:</strong> Если команда назначена на 15:30:00, планировщик начнет проверять время каждые 0.5 секунды. Как только наступит 15:30:00, команда выполнится мгновенно, после чего планировщик проверит следующую команду в очереди.
                </p>
              </div>
            </div>

            <div className={styles.modalActions}>
              <button 
                type="button" 
                onClick={() => setShowSettingsModal(false)}
                className={styles.saveBtnModal}
              >
                <FiCheck /> Понятно
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Скрытое модальное окно сброса системы */}
      {showResetModal && (
        <div 
          className={styles.modalOverlay}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              e.preventDefault();
              setShowResetModal(false);
              setResetCode('');
            }
          }}
        >
          <div className={styles.modalContent}>
            <h2>⚠️ Системный сброс</h2>
            
            <div className={styles.formGroup}>
              <label>Введите код доступа:</label>
              <input
                type="text"
                value={resetCode}
                onChange={(e) => setResetCode(e.target.value)}
                placeholder="Код доступа"
                autoFocus
                style={{
                  color: '#000000',
                  backgroundColor: '#ffffff',
                  border: '2px solid #00f5ff',
                  padding: '12px',
                  fontSize: '16px',
                  borderRadius: '8px'
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSystemReset();
                  }
                }}
              />
            </div>

            <div className={styles.modalActions}>
              <button 
                type="button" 
                onClick={handleSystemReset}
                className={styles.deleteBtn}
                disabled={loading}
              >
                🗑️ {loading ? 'Выполняется...' : 'Сбросить систему'}
              </button>
              <button 
                type="button" 
                onClick={() => {
                  setShowResetModal(false);
                  setResetCode('');
                }}
                className={styles.cancelBtnModal}
              >
                <FiX /> Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно помощи по пресетам */}
      {showPresetHelpModal && (
        <div className={styles.modal} onClick={() => setShowPresetHelpModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <button 
              className={styles.closeBtn}
              onClick={() => setShowPresetHelpModal(false)}
            >
              <FiX />
            </button>

            <div className={styles.modalHeader}>
              <h2>📋 Как создать пресеты команд</h2>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.helpSection}>
                <h3>🎯 Что такое пресеты?</h3>
                <p>
                  Пресеты — это сохранённые наборы команд, которые можно быстро загрузить одним кликом.
                  Например: "Утренний рестарт", "Экстренная остановка", "Отчёт по всем ботам" и т.д.
                </p>
              </div>

              <div className={styles.helpSection}>
                <h3>📝 Как создать пресет:</h3>
                <ol className={styles.instructionList}>
                  <li>
                    <strong>Перейдите во вкладку "Команды"</strong>
                    <p>В левом меню нажмите на раздел "Команды"</p>
                  </li>
                  <li>
                    <strong>Введите команды</strong>
                    <p>В поле "Команды (каждая с новой строки)" напишите нужные команды, например:</p>
                    <pre className={styles.codeExample}>list{'\n'}report{'\n'}START</pre>
                  </li>
                  <li>
                    <strong>Введите название пресета</strong>
                    <p>Внизу формы найдите поле "Название пресета" и введите понятное имя</p>
                  </li>
                  <li>
                    <strong>Сохраните</strong>
                    <p>Нажмите кнопку "💾 Сохранить как пресет"</p>
                  </li>
                  <li>
                    <strong>Готово!</strong>
                    <p>Пресет появится в виде пронумерованной кнопки (1, 2, 3...) и станет доступен здесь</p>
                  </li>
                </ol>
              </div>

              <div className={styles.helpSection}>
                <h3>💡 Полезные примеры пресетов:</h3>
                <ul className={styles.exampleList}>
                  <li><strong>Проверка статуса:</strong> list, report, status</li>
                  <li><strong>Запуск торговли:</strong> START</li>
                  <li><strong>Остановка:</strong> STOP, SELL</li>
                  <li><strong>Утренний рестарт:</strong> STOP, SELL, list, START</li>
                </ul>
              </div>
            </div>

            <div className={styles.modalActions}>
              <button 
                type="button"
                onClick={() => setShowPresetHelpModal(false)}
                className={styles.primaryBtn}
              >
                <FiCheck /> Понятно
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScheduledCommands;

