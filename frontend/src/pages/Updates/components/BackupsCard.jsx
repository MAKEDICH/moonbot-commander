/**
 * Карточка резервных копий
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiRotateCcw, FiTrash2 } from 'react-icons/fi';
import styles from '../Updates.module.css';
import { formatServerDateTime } from '../../../utils/dateUtils';

/**
 * Форматирование даты - время сервера БЕЗ конвертации
 */
const formatDate = (dateStr) => {
    return formatServerDateTime(dateStr);
};

/**
 * Компонент управления резервными копиями
 */
const BackupsCard = ({ 
    backups, 
    showBackups, 
    setShowBackups,
    rollbackUpdate,
    cleanupBackups
}) => {
    return (
        <div className={styles.card}>
            <div className={styles.cardHeader}>
                <h2><FiRotateCcw /> Резервные копии</h2>
                <div className={styles.headerActions}>
                    <button
                        className={styles.smallBtn}
                        onClick={() => setShowBackups(!showBackups)}
                    >
                        {showBackups ? 'Скрыть' : `Показать (${backups.length})`}
                    </button>
                    {backups.length > 5 && (
                        <button
                            className={styles.smallBtn + ' ' + styles.dangerBtn}
                            onClick={cleanupBackups}
                        >
                            <FiTrash2 />
                            Очистить
                        </button>
                    )}
                </div>
            </div>
            
            <AnimatePresence>
                {showBackups && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className={styles.cardBody}
                    >
                        {backups.length > 0 ? (
                            <div className={styles.backupsList}>
                                {backups.map((backup, index) => (
                                    <div key={backup.path} className={styles.backupItem}>
                                        <div className={styles.backupInfo}>
                                            <span className={styles.backupName}>
                                                {backup.from_version} → {backup.to_version}
                                            </span>
                                            <span className={styles.backupDate}>
                                                {formatDate(backup.created_at)}
                                            </span>
                                        </div>
                                        <button
                                            className={styles.smallBtn}
                                            onClick={() => rollbackUpdate(backup.path)}
                                        >
                                            <FiRotateCcw />
                                            Откатить
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className={styles.emptyMessage}>Нет доступных бэкапов</p>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default BackupsCard;

