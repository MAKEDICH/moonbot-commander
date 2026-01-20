/**
 * Карточка текущей версии
 */

import React from 'react';
import { FiInfo, FiArrowRight, FiMonitor, FiServer } from 'react-icons/fi';
import styles from '../Updates.module.css';

/**
 * Компонент отображения текущей версии
 */
const CurrentVersionCard = ({ updateInfo, systemInfo, updateStatus, loading }) => {
    const currentVersion = updateInfo?.current_version || 
        systemInfo?.current_version || 
        updateStatus?.current_version || 
        (loading ? 'загрузка...' : '—');

    return (
        <div className={styles.card}>
            <div className={styles.cardHeader}>
                <h2><FiInfo /> Текущая версия</h2>
            </div>
            <div className={styles.cardBody}>
                <div className={styles.versionInfo}>
                    <div className={styles.versionBadge}>
                        v{currentVersion}
                    </div>
                    
                    {updateInfo?.update_available && (
                        <div className={styles.updateAvailable}>
                            <FiArrowRight />
                            <div className={styles.versionBadge + ' ' + styles.newVersion}>
                                v{updateInfo.latest_version}
                            </div>
                            <span className={styles.updateLabel}>доступно обновление</span>
                        </div>
                    )}
                </div>
                
                {systemInfo && (
                    <div className={styles.systemInfo}>
                        <div className={styles.infoItem}>
                            <FiMonitor />
                            <span>{systemInfo.os} {systemInfo.os_version?.split('.').slice(0, 2).join('.')}</span>
                        </div>
                        <div className={styles.infoItem}>
                            <FiServer />
                            <span>Python {systemInfo.python_version?.split(' ')[0]}</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CurrentVersionCard;

