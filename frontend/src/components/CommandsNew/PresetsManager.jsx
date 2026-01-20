import React from 'react';
import { FiInfo, FiEdit2, FiSave, FiTrash2, FiX } from 'react-icons/fi';
import styles from '../../pages/CommandsNew.module.css';

/**
 * Компонент управления пресетами команд
 */
const PresetsManager = ({
  presets,
  newPresetName,
  setNewPresetName,
  commands,
  handleSavePreset,
  handleLoadPresetToEditor,
  handleUpdatePreset,
  handleDeletePreset,
  loading,
  showPresetHint,
  setShowPresetHint,
  showPresetManager,
  setShowPresetManager,
  editingPreset,
  setEditingPreset,
  presetValidationError,
  setPresetValidationError
}) => {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h3>🎯 Пресеты команд</h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            onClick={() => setShowPresetHint(!showPresetHint)}
            className={styles.addBtn}
            title={showPresetHint ? "Скрыть подсказку" : "Показать подсказку"}
          >
            <FiInfo />
          </button>
          <button 
            onClick={() => setShowPresetManager(!showPresetManager)}
            className={styles.addBtn}
            title="Управление пресетами"
          >
            <FiEdit2 />
          </button>
        </div>
      </div>

      {showPresetHint && (
        <div className={styles.presetHint}>
          <strong>Как использовать:</strong><br/>
          1. Наберите команды в редакторе команд<br/>
          2. Введите название и нажмите "Сохранить"<br/>
          3. Нажмите на кнопку пресета чтобы загрузить команды<br/>
          4. Выберите серверы и отправьте
        </div>
      )}

      <div className={styles.savePresetForm}>
        <input
          type="text"
          placeholder="Название пресета"
          value={newPresetName}
          onChange={(e) => setNewPresetName(e.target.value)}
          className={styles.input}
        />
        <button 
          onClick={handleSavePreset}
          className={styles.savePresetBtn}
          disabled={!commands.trim() || !newPresetName.trim()}
        >
          <FiSave /> Сохранить как пресет
        </button>
      </div>

      <div className={styles.presetButtons}>
        {presets.map(preset => (
          <div key={preset.id} className={styles.presetWrapper}>
            <button
              onClick={() => handleLoadPresetToEditor(preset)}
              className={styles.presetBtn}
              disabled={loading}
              title={`${preset.name}\n\nНажмите чтобы загрузить команды:\n${preset.commands}`}
            >
              {preset.button_number}
            </button>
            <div className={styles.presetLabel}>{preset.name}</div>
          </div>
        ))}
      </div>

      {showPresetManager && (
        <div className={styles.presetManager}>
          <h4>Управление пресетами</h4>
          {presets.map(preset => (
            <div key={preset.id} className={styles.presetManagerItem}>
              <div className={styles.presetInfo}>
                <strong>{preset.button_number}. {preset.name}</strong>
                <pre className={styles.presetCommands}>{preset.commands}</pre>
              </div>
              <div className={styles.presetActions}>
                <button 
                  onClick={() => handleLoadPresetToEditor(preset)}
                  className={styles.loadBtn}
                  title="Загрузить в редактор"
                >
                  Загрузить
                </button>
                <button 
                  onClick={() => {
                    setEditingPreset(preset);
                    setPresetValidationError('');
                  }}
                  className={styles.editBtn}
                  title="Редактировать"
                >
                  <FiEdit2 />
                </button>
                <button 
                  onClick={() => handleDeletePreset(preset.id)}
                  className={styles.deleteBtn}
                  title="Удалить"
                >
                  <FiTrash2 />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Модальное окно редактирования пресета */}
      {editingPreset && (
        <div 
          className={styles.modal}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              e.preventDefault();
              setEditingPreset(null);
            }
          }}
        >
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2>✏️ Редактировать пресет</h2>
              <button onClick={() => {
                setEditingPreset(null);
                setPresetValidationError('');
              }} className={styles.closeBtn}>
                <FiX />
              </button>
            </div>
            
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label>Название пресета</label>
                <input
                  type="text"
                  value={editingPreset.name}
                  onChange={(e) => setEditingPreset({...editingPreset, name: e.target.value})}
                  className={styles.input}
                  placeholder="Название"
                />
              </div>

              <div className={styles.formGroup}>
                <label>Редактор команд (каждая с новой строки)</label>
                <textarea
                  value={editingPreset.commands}
                  onChange={(e) => setEditingPreset({...editingPreset, commands: e.target.value})}
                  className={styles.textarea}
                  placeholder="START&#10;list&#10;report"
                  rows={8}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Номер кнопки *</label>
                <input
                  type="number"
                  value={editingPreset.button_number || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '') {
                      setEditingPreset({...editingPreset, button_number: ''});
                    } else {
                      const num = parseInt(value);
                      if (num > 0 && num <= 50) {
                        setEditingPreset({...editingPreset, button_number: num});
                        setPresetValidationError('');
                      }
                    }
                  }}
                  className={styles.input}
                  placeholder="От 1 до 50"
                  min="1"
                  max="50"
                  required
                />
                <small style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Обязательное поле. Введите число от 1 до 50
                </small>
              </div>

              {presetValidationError && (
                <div style={{ 
                  padding: '12px', 
                  background: 'rgba(255, 68, 68, 0.1)', 
                  border: '1px solid rgba(255, 68, 68, 0.3)',
                  borderRadius: '8px',
                  color: '#ff4444',
                  marginBottom: '15px'
                }}>
                  ⚠️ {presetValidationError}
                </div>
              )}

              <div className={styles.modalActions}>
                <button 
                  onClick={() => {
                    if (!editingPreset.name.trim()) {
                      setPresetValidationError('Название пресета не может быть пустым');
                      return;
                    }
                    if (!editingPreset.commands.trim()) {
                      setPresetValidationError('Редактор команд не может быть пустым');
                      return;
                    }
                    const buttonNum = parseInt(editingPreset.button_number);
                    if (!editingPreset.button_number || isNaN(buttonNum) || buttonNum < 1 || buttonNum > 50) {
                      setPresetValidationError('Номер кнопки должен быть числом от 1 до 50');
                      return;
                    }
                    setPresetValidationError('');
                    handleUpdatePreset(editingPreset.id, {
                      name: editingPreset.name,
                      commands: editingPreset.commands,
                      button_number: buttonNum
                    });
                  }}
                  className={styles.saveBtn}
                >
                  <FiSave /> Сохранить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PresetsManager;





