import React from 'react';
import { FiX } from 'react-icons/fi';
import styles from '../../pages/CommandsNew.module.css';

/**
 * Справочник команд MoonBot с фильтрацией
 */
const CommandsReference = ({
  showCommandsReference,
  closeCommandsReference,
  botCommands,
  commandsFilter,
  setCommandsFilter,
  selectedCategory,
  setSelectedCategory,
  selectedCommandsFromReference,
  setSelectedCommandsFromReference
}) => {
  if (!showCommandsReference) return null;

  const filteredBotCommands = botCommands.filter(cmd => {
    const matchesFilter = 
      cmd.command.toLowerCase().includes(commandsFilter.toLowerCase()) ||
      cmd.description.toLowerCase().includes(commandsFilter.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || cmd.category === selectedCategory;
    
    return matchesFilter && matchesCategory;
  });

  const categories = ['all', ...new Set(botCommands.map(cmd => cmd.category))];

  return (
    <div 
      className={styles.modal}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
          closeCommandsReference();
        }
      }}
    >
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2>
            📚 Справочник команд MoonBot
            {selectedCommandsFromReference.length > 0 && (
              <span style={{ 
                marginLeft: '10px', 
                fontSize: '0.9rem', 
                color: '#00ff88',
                fontWeight: 'normal'
              }}>
                (Выбрано: {selectedCommandsFromReference.length})
              </span>
            )}
          </h2>
          <button onClick={closeCommandsReference} className={styles.closeBtn}>
            <FiX />
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.referenceFilters}>
            <input
              type="text"
              placeholder="Поиск..."
              value={commandsFilter}
              onChange={(e) => setCommandsFilter(e.target.value)}
              className={styles.input}
            />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className={styles.select}
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat === 'all' ? 'Все категории' : cat}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.commandsReference}>
            {filteredBotCommands.length === 0 ? (
              <div className={styles.emptyState}>Команды не найдены</div>
            ) : (
              filteredBotCommands.map((cmd, index) => (
                <div key={index} className={styles.referenceItem}>
                  <div className={styles.referenceHeader}>
                    <code className={styles.referenceCommand}>{cmd.command}</code>
                    <span 
                      className={styles.referenceCategory}
                      data-category={cmd.category}
                    >
                      {cmd.category}
                    </span>
                  </div>
                  <div className={styles.referenceDescription}>{cmd.description}</div>
                  {cmd.example && (
                    <div className={styles.referenceExample}>
                      Пример: <code>{cmd.example}</code>
                    </div>
                  )}
                  <div className={styles.referenceActions}>
                    <button
                      onClick={() => {
                        const commandToUse = cmd.example || cmd.command;
                        if (selectedCommandsFromReference.includes(commandToUse)) {
                          setSelectedCommandsFromReference(
                            selectedCommandsFromReference.filter(c => c !== commandToUse)
                          );
                        } else {
                          setSelectedCommandsFromReference([...selectedCommandsFromReference, commandToUse]);
                        }
                      }}
                      className={`${styles.useExampleBtn} ${
                        selectedCommandsFromReference.includes(cmd.example || cmd.command) 
                          ? styles.useExampleBtnSelected 
                          : ''
                      }`}
                    >
                      {selectedCommandsFromReference.includes(cmd.example || cmd.command) 
                        ? '✓ Выбрана' 
                        : 'Использовать'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommandsReference;





