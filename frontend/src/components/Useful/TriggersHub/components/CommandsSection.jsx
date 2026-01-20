/**
 * Секция пакета команд
 */

import React from 'react';
import { 
    FiSend, FiLoader, FiCopy, FiSave, FiTrash2, 
    FiSearch, FiChevronDown, FiChevronUp 
} from 'react-icons/fi';
import styles from './CommandsSection.module.css';

/**
 * Секция команд с кнопками управления и превью
 */
const CommandsSection = ({
    commands,
    hasCommands,
    canSend,
    isSending,
    duplicateInfo,
    setDuplicateInfo,
    isOpen,
    setIsOpen,
    selectedSendServers,
    onCopy,
    onClearForward,
    onClearRevert,
    onCheckDuplicates,
    onRemoveDuplicates,
    onClearChanges,
    onSaveToHistory,
    onSendForward,
    onSendRevert
}) => {
    return (
        <div className={`${styles.card} ${styles.commandsSection}`}>
            <div className={styles.sectionHeader} onClick={() => setIsOpen(!isOpen)}>
                <h4 className={styles.cardTitle}>
                    📦 Пакет команд {hasCommands && `(${commands.forward.split('\n').filter(c => c.trim()).length} команд)`}
                </h4>
                <button className={styles.toggleBtn}>
                    {isOpen ? <FiChevronUp /> : <FiChevronDown />}
                </button>
            </div>
            
            {isOpen && (
                <>
                    <div className={styles.commandActions}>
                        <button className={styles.btn} onClick={() => onCopy(commands.forward)} disabled={!hasCommands}>
                            <FiCopy /> Копировать прямые
                        </button>
                        <button 
                            className={styles.btn} 
                            onClick={onClearForward} 
                            disabled={!hasCommands} 
                            title="Установить текущие значения как новый baseline для Forward команд"
                        >
                            <FiTrash2 /> Очистить прямые
                        </button>
                        <button className={styles.btn} onClick={() => onCopy(commands.revert)} disabled={!commands.revert?.trim()}>
                            <FiCopy /> Копировать откат
                        </button>
                        <button 
                            className={styles.btn} 
                            onClick={onClearRevert} 
                            disabled={!commands.revert?.trim()} 
                            title="Установить текущие значения как новый baseline для Revert команд"
                        >
                            <FiTrash2 /> Очистить откат
                        </button>
                    </div>
                    
                    <div className={styles.commandActions}>
                        <button className={styles.btn} onClick={onCheckDuplicates} disabled={!hasCommands}>
                            <FiSearch /> Проверить дубликаты
                        </button>
                        <button className={styles.btn} onClick={onRemoveDuplicates} disabled={!hasCommands}>
                            <FiTrash2 /> Удалить дубликаты
                        </button>
                        <span className={styles.muted}>|</span>
                        <button className={styles.btn} onClick={onClearChanges} disabled={!hasCommands}>
                            🔄 Сбросить всё
                        </button>
                        <button className={`${styles.btn} ${styles.btnSave}`} onClick={onSaveToHistory} disabled={!hasCommands}>
                            <FiSave /> Сохранить в историю
                        </button>
                    </div>
                    
                    <div className={styles.commandActions}>
                        <button 
                            className={`${styles.btn} ${styles.btnSend} ${canSend ? styles.btnActive : ''}`}
                            onClick={onSendForward} 
                            disabled={!canSend}
                            title={!hasCommands ? 'Нет команд' : selectedSendServers.length === 0 ? 'Выберите серверы' : `Отправить на ${selectedSendServers.length} сервер(ов)`}
                        >
                            {isSending ? (
                                <><FiLoader className={styles.spinIcon} /> Отправка...</>
                            ) : (
                                <><FiSend /> Отправить Forward ({selectedSendServers.length})</>
                            )}
                        </button>
                        <button 
                            className={`${styles.btn} ${styles.btnRevert} ${canSend ? styles.btnActive : ''}`}
                            onClick={onSendRevert} 
                            disabled={!canSend || !commands.revert?.trim()}
                        >
                            {isSending ? (
                                <><FiLoader className={styles.spinIcon} /> Отправка...</>
                            ) : (
                                <><FiSend /> Отправить Revert ({selectedSendServers.length})</>
                            )}
                        </button>
                    </div>
                    
                    {/* Информация о дубликатах */}
                    {duplicateInfo && (
                        <div className={`${styles.duplicateInfo} ${styles[duplicateInfo.type]}`}>
                            <div className={styles.duplicateHeader}>
                                {duplicateInfo.type === 'success' ? '✓' : '⚠️'} {duplicateInfo.message}
                                <button className={styles.closeDupBtn} onClick={() => setDuplicateInfo(null)}>✕</button>
                            </div>
                            {duplicateInfo.duplicates && duplicateInfo.duplicates.length > 0 && (
                                <div className={styles.duplicateList}>
                                    {duplicateInfo.duplicates.map((dup, idx) => (
                                        <div key={idx} className={styles.duplicateItem}>
                                            <strong className={styles.dupCount}>{dup.count}x:</strong>
                                            <span className={styles.dupCommand}>{dup.command}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    
                    <div className={styles.commandsContainer}>
                        <div className={styles.commandBox}>
                            <div className={styles.commandLabel}>Forward команды:</div>
                            <div className={styles.commands}>{commands.forward || 'Нет команд'}</div>
                        </div>
                        <div className={styles.commandBox}>
                            <div className={styles.commandLabel}>Revert команды:</div>
                            <div className={`${styles.commands} ${styles.commandsRevert}`}>
                                {commands.revert || 'Нет команд отката'}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default CommandsSection;

