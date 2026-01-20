import React from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiSave, FiX } from 'react-icons/fi';
import styles from '../../pages/CommandsNew.module.css';

/**
 * Компонент быстрых команд с CRUD функционалом
 */
const QuickCommands = ({
  quickCommands,
  showAddQuickCmd,
  setShowAddQuickCmd,
  newQuickCmd,
  setNewQuickCmd,
  editingQuickCmd,
  setEditingQuickCmd,
  handleAddQuickCommand,
  handleUpdateQuickCommand,
  handleDeleteQuickCommand,
  handleQuickSend,
  handleCommandInput,
  handleCommandKeyDown,
  showCommandSuggestions,
  activeSuggestionField,
  commandSuggestions,
  selectedSuggestionIndex,
  setSelectedSuggestionIndex,
  selectCommandSuggestion
}) => {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h3>⚡ Быстрые команды</h3>
        <button
          onClick={() => setShowAddQuickCmd(!showAddQuickCmd)}
          className={styles.addBtn}
          title="Добавить команду"
        >
          <FiPlus />
        </button>
      </div>

      {showAddQuickCmd && (
        <div className={styles.addForm}>
          <input
            type="text"
            placeholder="Название (START, REPORT...)"
            value={newQuickCmd.label}
            onChange={(e) => setNewQuickCmd({...newQuickCmd, label: e.target.value})}
            className={styles.input}
          />
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Команда"
              value={newQuickCmd.command}
              onChange={(e) => handleCommandInput(e.target.value, 'new')}
              onKeyDown={(e) => handleCommandKeyDown(e, 'new')}
              className={styles.input}
              autoComplete="off"
            />
            {showCommandSuggestions && activeSuggestionField === 'new' && commandSuggestions.length > 0 && (
              <div className={styles.suggestionsDropdown}>
                {commandSuggestions.map((cmd, index) => (
                  <div
                    key={index}
                    className={`${styles.suggestionItem} ${index === selectedSuggestionIndex ? styles.suggestionItemActive : ''}`}
                    onClick={() => selectCommandSuggestion(cmd.command)}
                    onMouseEnter={() => setSelectedSuggestionIndex(index)}
                  >
                    <strong>{cmd.command}</strong>
                    <small>{cmd.description}</small>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className={styles.formButtons}>
            <button onClick={handleAddQuickCommand} className={styles.saveBtn}>
              <FiSave /> Сохранить
            </button>
            <button onClick={() => {
              setShowAddQuickCmd(false);
              setNewQuickCmd({ label: '', command: '' });
            }} className={styles.cancelBtn}>
              <FiX /> Отмена
            </button>
          </div>
        </div>
      )}

      <div className={styles.quickCommandsList}>
        {quickCommands.length === 0 ? (
          <div className={styles.emptyState}>Нет сохраненных команд</div>
        ) : (
          quickCommands.map(qc => (
            <div key={qc.id} className={styles.quickCommandItem}>
              {editingQuickCmd?.id === qc.id ? (
                <div className={styles.editForm}>
                  <input
                    type="text"
                    value={editingQuickCmd.label}
                    onChange={(e) => setEditingQuickCmd({...editingQuickCmd, label: e.target.value})}
                    className={styles.input}
                  />
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      value={editingQuickCmd.command}
                      onChange={(e) => handleCommandInput(e.target.value, 'edit')}
                      onKeyDown={(e) => handleCommandKeyDown(e, 'edit')}
                      className={styles.input}
                      autoComplete="off"
                    />
                    {showCommandSuggestions && activeSuggestionField === 'edit' && commandSuggestions.length > 0 && (
                      <div className={styles.suggestionsDropdown}>
                        {commandSuggestions.map((cmd, index) => (
                          <div
                            key={index}
                            className={`${styles.suggestionItem} ${index === selectedSuggestionIndex ? styles.suggestionItemActive : ''}`}
                            onClick={() => selectCommandSuggestion(cmd.command)}
                            onMouseEnter={() => setSelectedSuggestionIndex(index)}
                          >
                            <strong>{cmd.command}</strong>
                            <small>{cmd.description}</small>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className={styles.formButtons}>
                    <button onClick={handleUpdateQuickCommand} className={styles.saveBtn}>
                      <FiSave />
                    </button>
                    <button onClick={() => setEditingQuickCmd(null)} className={styles.cancelBtn}>
                      <FiX />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => handleQuickSend(qc.command)}
                    className={styles.quickCmdBtn}
                    title={qc.command}
                  >
                    {qc.label}
                  </button>
                  <div className={styles.quickCmdActions}>
                    <button onClick={() => setEditingQuickCmd(qc)} className={styles.iconBtn}>
                      <FiEdit2 />
                    </button>
                    <button onClick={() => handleDeleteQuickCommand(qc.id)} className={styles.iconBtn}>
                      <FiTrash2 />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default QuickCommands;





