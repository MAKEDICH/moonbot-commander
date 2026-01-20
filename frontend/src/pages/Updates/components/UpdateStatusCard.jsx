/**
 * Карточка статуса обновления
 */

import React from 'react';
import { FiRefreshCw } from 'react-icons/fi';
import styles from '../Updates.module.css';

/**
 * Компонент отображения статуса обновления
 */
const UpdateStatusCard = ({ updateStatus }) => {
    if (!updateStatus || updateStatus.status === 'idle') {
        return null;
    }

    return (
        <div className={styles.card}>
            <div className={styles.cardHeader}>
                <h2><FiRefreshCw /> Статус обновления</h2>
            </div>
            <div className={styles.cardBody}>
                <div className={styles.statusInfo}>
                    <div className={styles.statusBadge} data-status={updateStatus.status}>
                        {updateStatus.status}
                    </div>
                    <div className={styles.progressBar}>
                        <div 
                            className={styles.progressFill}
                            style={{ width: `${updateStatus.progress}%` }}
                        />
                    </div>
                    <span className={styles.progressText}>{updateStatus.progress}%</span>
                </div>
                {updateStatus.message && (
                    <p className={styles.statusMessage}>{updateStatus.message}</p>
                )}
            </div>
        </div>
    );
};

export default UpdateStatusCard;

