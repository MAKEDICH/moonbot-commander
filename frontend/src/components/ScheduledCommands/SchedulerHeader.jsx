/**
 * Шапка страницы отложенных команд
 */

import React from 'react';
import { FiClock, FiPlus } from 'react-icons/fi';
import styles from '../../pages/ScheduledCommands.module.css';
import PageHeader from '../PageHeader';

export default function SchedulerHeader({
  schedulerEnabled,
  onToggleScheduler,
  onShowSettings,
  onShowCreate,
  onShowReset
}) {
  return (
    <PageHeader 
      icon={<FiClock />} 
      title="Отложенные команды" 
      gradient="blue"
    >
      {/* Скрытая кнопка сброса */}
      <span 
        className={styles.hiddenResetBtn}
        onClick={onShowReset}
        title=""
      ></span>
      <label className={styles.schedulerToggle}>
        <input
          type="checkbox"
          checked={schedulerEnabled}
          onChange={onToggleScheduler}
        />
        <span className={styles.toggleSlider}></span>
        <span className={styles.toggleLabel}>
          {schedulerEnabled ? '✅ Планировщик включен' : '⏸️ Планировщик выключен'}
        </span>
      </label>
      <button 
        className={styles.settingsBtn}
        onClick={onShowSettings}
        title="Справка о работе планировщика"
      >
        ⚙️ Справка
      </button>
      <button 
        className={styles.createBtn}
        onClick={onShowCreate}
      >
        <FiPlus /> Создать отложенную команду
      </button>
    </PageHeader>
  );
}



