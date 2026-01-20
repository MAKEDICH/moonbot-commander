/**
 * Карточка отложенной команды
 */

import React from 'react';
import { FiCalendar, FiServer, FiEdit2, FiX, FiTrash2 } from 'react-icons/fi';
import styles from '../../pages/ScheduledCommands.module.css';
import { formatDateTime, getTargetInfo, getRecurrenceLabel } from './scheduledUtils';

// Бейдж статуса команды
const StatusBadge = ({ status }) => {
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

export default function CommandCard({ 
  command, 
  servers, 
  groups, 
  onEdit, 
  onCancel, 
  onDelete 
}) {
  return (
    <div className={styles.commandCard}>
      <div className={styles.commandHeader}>
        <h3>{command.name}</h3>
        <StatusBadge status={command.status} />
      </div>

      <div className={styles.commandDetails}>
        <div className={styles.detailRow}>
          <FiCalendar />
          <span>
            Запланировано: {command.display_time ? command.display_time : formatDateTime(command.scheduled_time, command.timezone)} ({command.timezone})
          </span>
        </div>

        <div className={styles.detailRow}>
          <FiServer />
          <span>{getTargetInfo(command, servers, groups)}</span>
        </div>

        <div className={styles.commandsPreview}>
          <strong>Команды:</strong>
          <pre>{command.commands}</pre>
        </div>

        {/* Режим выполнения */}
        {command.recurrence_type && (
          <div className={styles.detailRow}>
            <strong>Режим:</strong> {getRecurrenceLabel(command)}
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
              onClick={() => onEdit(command)}
              className={styles.editBtn}
              title="Редактировать"
            >
              <FiEdit2 /> Редактировать
            </button>
            <button
              onClick={() => onCancel(command.id)}
              className={styles.cancelBtn}
              title="Отменить"
            >
              <FiX /> Отменить
            </button>
          </>
        )}
        
        <button
          onClick={() => onDelete(command.id)}
          className={styles.deleteBtn}
          title="Удалить"
        >
          <FiTrash2 /> Удалить
        </button>
      </div>
    </div>
  );
}

