/**
 * Карточка истории версий
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiClock } from 'react-icons/fi';
import styles from '../Updates.module.css';
import { formatServerDateTime } from '../../../utils/dateUtils';

/**
 * Форматирование даты - время сервера БЕЗ конвертации
 */
const formatDate = (dateStr) => {
    return formatServerDateTime(dateStr);
};

/**
 * Компонент истории версий
 */
const VersionsCard = ({ 
    versions, 
    showVersions, 
    preparing,
    fetchVersions, 
    prepareUpdate,
    setSelectedVersion
}) => {
    return (
        <div className={styles.card}>
            <div className={styles.cardHeader}>
                <h2><FiClock /> История версий</h2>
                <button
                    className={styles.smallBtn}
                    onClick={fetchVersions}
                >
                    {showVersions ? 'Скрыть' : 'Показать все версии'}
                </button>
            </div>
            
            <AnimatePresence>
                {showVersions && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className={styles.cardBody}
                    >
                        <div className={styles.versionsList}>
                            {versions.map((ver, index) => (
                                <div 
                                    key={`${ver.version}-${index}`} 
                                    className={`${styles.versionItem} ${ver.is_current ? styles.current : ''}`}
                                >
                                    <div className={styles.versionMeta}>
                                        <span className={styles.versionNumber}>
                                            v{ver.version}
                                            {ver.is_current && <span className={styles.currentBadge}>текущая</span>}
                                            {ver.prerelease && <span className={styles.prereleaseBadge}>beta</span>}
                                        </span>
                                        <span className={styles.versionName}>{ver.name}</span>
                                        <span className={styles.versionDate}>{formatDate(ver.published_at)}</span>
                                    </div>
                                    
                                    {ver.is_newer && !ver.is_current && (
                                        <button
                                            className={styles.smallBtn}
                                            onClick={() => {
                                                setSelectedVersion(ver);
                                                prepareUpdate(ver.version, ver.download_url);
                                            }}
                                            disabled={preparing}
                                        >
                                            Обновить
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default VersionsCard;

