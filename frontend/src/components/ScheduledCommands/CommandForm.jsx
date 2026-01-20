/**
 * Форма создания/редактирования отложенной команды
 */

import React from 'react';
import { FiX, FiCheck } from 'react-icons/fi';
import styles from '../../pages/ScheduledCommands.module.css';

export default function CommandForm({
  show,
  formData,
  editingCommand,
  loading,
  servers,
  groups,
  presets,
  onSubmit,
  onChange,
  onClose,
  onLoadPreset,
  onShowPresetHelp
}) {
  if (!show) return null;

  const handleWeekdayToggle = (dayValue) => {
    const isSelected = formData.weekdays.includes(dayValue);
    if (isSelected) {
      onChange({ ...formData, weekdays: formData.weekdays.filter(d => d !== dayValue) });
    } else {
      onChange({ ...formData, weekdays: [...formData.weekdays, dayValue].sort() });
    }
  };

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
          <h2>{editingCommand ? 'Редактировать' : 'Создать'} отложенную команду</h2>
          <button onClick={onClose} className={styles.closeBtn}>
            <FiX />
          </button>
        </div>

        <form onSubmit={onSubmit} className={styles.form}>
          {/* Название */}
          <div className={styles.formGroup}>
            <label>Название задачи *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => onChange({ ...formData, name: e.target.value })}
              placeholder="Например: Утренний рестарт"
              required
            />
          </div>

          {/* Команды с пресетами */}
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
                          onClick={() => onLoadPreset(preset)}
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
                    onClick={onShowPresetHelp}
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
              onChange={(e) => onChange({ ...formData, commands: e.target.value })}
              placeholder="list&#10;report&#10;START"
              rows={6}
              required
            />
          </div>

          {/* Режим выполнения */}
          <div className={styles.formGroup}>
            <label>Режим выполнения *</label>
            <select
              value={formData.recurrenceType}
              onChange={(e) => {
                const newType = e.target.value;
                onChange({ 
                  ...formData, 
                  recurrenceType: newType, 
                  weekdays: [],
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

          {/* Выбор дней недели */}
          {formData.recurrenceType === 'weekly_days' && (
            <div className={styles.formGroup}>
              <label>Выберите дни недели *</label>
              
              {/* Быстрые пресеты */}
              <div className={styles.weekdayPresets}>
                <button
                  type="button"
                  className={styles.presetButton}
                  onClick={() => onChange({ ...formData, weekdays: [0, 1, 2, 3, 4] })}
                  title="Понедельник - Пятница"
                >
                  Рабочие дни
                </button>
                <button
                  type="button"
                  className={styles.presetButton}
                  onClick={() => onChange({ ...formData, weekdays: [5, 6] })}
                  title="Суббота - Воскресенье"
                >
                  Выходные
                </button>
                <button
                  type="button"
                  className={styles.presetButton}
                  onClick={() => onChange({ ...formData, weekdays: [] })}
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
                      onClick={() => handleWeekdayToggle(day.value)}
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

          {/* Дата и время */}
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
                  onChange={(e) => onChange({ ...formData, scheduledDate: e.target.value })}
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
                onChange={(e) => onChange({ ...formData, scheduledTime: e.target.value })}
                required
              />
            </div>
          </div>

          {/* Часовой пояс */}
          <div className={styles.formGroup}>
            <label>Часовой пояс *</label>
            <select
              value={formData.timezone}
              onChange={(e) => onChange({ ...formData, timezone: e.target.value })}
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

          {/* Цель отправки */}
          <div className={styles.formGroup}>
            <label>Отправить на *</label>
            <div className={styles.targetTypeSelector}>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="targetType"
                  value="servers"
                  checked={formData.targetType === 'servers'}
                  onChange={(e) => onChange({ ...formData, targetType: e.target.value, serverIds: [], groupIds: [] })}
                />
                <span>Серверы</span>
              </label>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="targetType"
                  value="groups"
                  checked={formData.targetType === 'groups'}
                  onChange={(e) => onChange({ ...formData, targetType: e.target.value, serverIds: [], groupIds: [] })}
                />
                <span>Группы</span>
              </label>
            </div>
          </div>

          {/* Выбор серверов или групп */}
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
                          onChange({
                            ...formData,
                            serverIds: [...formData.serverIds, server.id]
                          });
                        } else {
                          onChange({
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
                  <label key={group.name} className={styles.serverCheckbox}>
                    <input
                      type="checkbox"
                      checked={formData.groupIds.includes(group.name)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          onChange({
                            ...formData,
                            groupIds: [...formData.groupIds, group.name]
                          });
                        } else {
                          onChange({
                            ...formData,
                            groupIds: formData.groupIds.filter(name => name !== group.name)
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

          {/* Задержка */}
          <div className={styles.formGroup}>
            <label>Задержка между ботами (сек)</label>
            <input
              type="number"
              value={formData.delayBetweenBots}
              onChange={(e) => onChange({ ...formData, delayBetweenBots: e.target.value })}
              min="0"
              max="3600"
              placeholder="0"
            />
            <small>Применяется только если выбрано больше 1 бота</small>
          </div>

          {/* Кнопки действий */}
          <div className={styles.modalActions}>
            <button type="submit" className={styles.saveBtn} disabled={loading}>
              <FiCheck /> {loading ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button type="button" onClick={onClose} className={styles.cancelBtnModal}>
              <FiX /> Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}



