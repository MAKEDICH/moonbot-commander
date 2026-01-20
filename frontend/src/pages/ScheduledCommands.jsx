/**
 * Страница управления отложенными командами
 */

import React from 'react';
import { FiClock } from 'react-icons/fi';
import styles from './ScheduledCommands.module.css';
import {
  SchedulerHeader,
  CommandCard,
  CommandForm,
  SettingsModal,
  ResetModal,
  PresetHelpModal,
  useScheduledCommands
} from '../components/ScheduledCommands';

const ScheduledCommands = () => {
  const {
    // Данные
    scheduledCommands,
    servers,
    groups,
    presets,
    loading,
    schedulerEnabled,
    formData,
    editingCommand,
    resetCode,
    
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
    handleCreateCommand,
    handleEdit,
    handleDelete,
    handleCancel,
    handleSystemReset,
    handleLoadPreset,
    resetForm,
    setFormData,
    setResetCode,
  } = useScheduledCommands();

  return (
    <div className={styles.container}>
      {/* Шапка */}
      <SchedulerHeader
        schedulerEnabled={schedulerEnabled}
        onToggleScheduler={handleToggleScheduler}
        onShowSettings={() => setShowSettingsModal(true)}
        onShowCreate={() => setShowCreateModal(true)}
        onShowReset={() => setShowResetModal(true)}
      />

      {/* Список команд */}
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
            <CommandCard
              key={command.id}
              command={command}
              servers={servers}
              groups={groups}
              onEdit={handleEdit}
              onCancel={handleCancel}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>

      {/* Модальное окно создания/редактирования */}
      <CommandForm
        show={showCreateModal}
        formData={formData}
        editingCommand={editingCommand}
        loading={loading}
        servers={servers}
        groups={groups}
        presets={presets}
        onSubmit={handleCreateCommand}
        onChange={setFormData}
        onClose={resetForm}
        onLoadPreset={handleLoadPreset}
        onShowPresetHelp={() => setShowPresetHelpModal(true)}
      />

      {/* Модальное окно настроек/справки */}
      <SettingsModal
        show={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />

      {/* Модальное окно сброса системы */}
      <ResetModal
        show={showResetModal}
        loading={loading}
        resetCode={resetCode}
        onCodeChange={setResetCode}
        onReset={handleSystemReset}
        onClose={() => {
                  setShowResetModal(false);
                  setResetCode('');
                }}
      />

      {/* Модальное окно помощи по пресетам */}
      <PresetHelpModal
        show={showPresetHelpModal}
        onClose={() => setShowPresetHelpModal(false)}
      />
    </div>
  );
};

export default ScheduledCommands;
