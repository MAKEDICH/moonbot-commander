/**
 * Секция истории команд
 */
import React from 'react';
import { FiClock, FiChevronDown, FiChevronUp, FiCopy, FiTrash2 } from 'react-icons/fi';
import styles from './HistorySection.module.css';

const HistorySection = ({ 
    history, 
    onRemoveBlock, 
    onClear,
    onCopyText,
    isOpen,
    setIsOpen
}) => {
    return (
        <div className={styles.historySection}>
            <div className={styles.sectionHeader} onClick={() => setIsOpen(!isOpen)}>
                <div className={styles.sectionTitle}>
                    <FiClock />
                    <span>История сохранённых команд</span>
                </div>
                <button className={styles.toggleBtn}>
                    {isOpen ? <FiChevronUp /> : <FiChevronDown />}
                </button>
            </div>

            {isOpen && (
                <div className={styles.historyBody}>
                    {history.length === 0 ? (
                        <div className={styles.noHistory}>История пуста</div>
                    ) : (
                        <>
                            {[...history].reverse().map((block, idx) => {
                                const actualIndex = history.length - 1 - idx;
                                return (
                                    <div key={actualIndex} className={styles.historyBlock}>
                                        <div className={styles.historyBlockHeader}>
                                            <span className={styles.historyDate}>
                                                Сохранено: {block.savedAt}
                                            </span>
                                            <div className={styles.historyActions}>
                                                <button 
                                                    className={styles.copyForwardBtn}
                                                    onClick={() => onCopyText(block.changes.map(c => c.forward).join('\n'))}
                                                >
                                                    <FiCopy /> Forward All
                                                </button>
                                                <button 
                                                    className={styles.copyRevertBtn}
                                                    onClick={() => onCopyText(block.changes.map(c => c.revert).join('\n'))}
                                                >
                                                    <FiCopy /> Revert All
                                                </button>
                                            </div>
                                        </div>
                                        <div className={styles.historyChanges}>
                                            {block.changes.map((change, cmdIdx) => (
                                                <div key={cmdIdx} className={styles.historyChangeItem}>
                                                    <div className={styles.historyChangeRow}>
                                                        <span className={styles.forwardCmd}>{change.forward}</span>
                                                        <button 
                                                            className={styles.deleteBtn}
                                                            onClick={() => onRemoveBlock(actualIndex)}
                                                            title="Удалить блок"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                    <button 
                                                        className={styles.copySmallBtn}
                                                        onClick={() => onCopyText(change.forward)}
                                                    >
                                                        Copy Forward
                                                    </button>
                                                    <div className={styles.revertRow}>
                                                        <span className={styles.revertLabel}>Revert:</span>
                                                        <span className={styles.revertCmd}>{change.revert}</span>
                                                    </div>
                                                    <button 
                                                        className={`${styles.copySmallBtn} ${styles.copyRevert}`}
                                                        onClick={() => onCopyText(change.revert)}
                                                    >
                                                        Copy Revert
                                                    </button>
                                                    <div className={styles.changeInfo}>
                                                        ( {change.paramName}: "{change.oldVal}" → "{change.newVal}" )
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                            <button className={styles.clearHistoryBtn} onClick={onClear}>
                                <FiTrash2 /> Очистить историю
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default HistorySection;

