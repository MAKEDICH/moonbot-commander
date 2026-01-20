import React from 'react';
import { FiCopy } from 'react-icons/fi';
import styles from '../../pages/StrategyCommander.module.css';

const History = ({ 
  history, 
  onCopyForward,
  onCopyRevert, 
  onCopySingle,
  onRemoveCommand 
}) => {
  return (
    <div className={styles.historyContainer}>
      <h3>История сохранённых команд</h3>
      {history.length === 0 ? (
        <div className={styles.noHistory}>История пуста</div>
      ) : (
        <div className={styles.historyBlocks}>
          {[...history].reverse().map((block, blockIndex) => {
            const actualIndex = history.length - 1 - blockIndex;
            return (
              <div key={actualIndex} className={styles.historyBlock}>
                <div className={styles.historyHeader}>
                  <h4>Сохранено: {block.savedAt}</h4>
                  <div className={styles.historyHeaderButtons}>
                    <button 
                      type="button"
                      className={styles.copyBtn} 
                      onClick={() => onCopyForward(block.changes)}
                    >
                      <FiCopy /> Copy ALL Forward
                    </button>
                    <button 
                      type="button"
                      className={styles.copyBtn} 
                      onClick={() => onCopyRevert(block.changes)}
                    >
                      <FiCopy /> Copy ALL Revert
                    </button>
                  </div>
                </div>

                <ul className={styles.historyCommandsList}>
                  {block.changes.map((ch, cmdIndex) => (
                    <li key={cmdIndex} className={styles.historyCommand}>
                      <div className={styles.forwardContainer}>
                        <div className={styles.forwardLeft}>
                          <strong>{ch.forward}</strong>
                          <button 
                            type="button"
                            className={styles.copySmallBtn} 
                            onClick={() => onCopySingle(ch.forward)}
                          >
                            Copy Forward
                          </button>
                        </div>
                        <button 
                          type="button"
                          className={styles.removeBtn} 
                          onClick={() => onRemoveCommand(actualIndex, cmdIndex)}
                        >
                          ✗
                        </button>
                      </div>
                      <div className={styles.leftActions}>
                        <span><em>Revert:</em> {ch.revert}</span>
                        <button 
                          type="button"
                          className={styles.copySmallBtn} 
                          onClick={() => onCopySingle(ch.revert)}
                        >
                          Copy Revert
                        </button>
                        <span className={styles.changeInfo}>
                          ( {ch.paramName}: "{ch.oldVal}" =&gt; "{ch.newVal}" )
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default History;



