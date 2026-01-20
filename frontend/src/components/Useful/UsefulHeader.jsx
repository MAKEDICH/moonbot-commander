/**
 * Компонент заголовка для секции UPBIT
 */

import React from 'react';
import styles from '../../pages/Useful.module.css';

/**
 * Заголовок секции с прогрессом и статусом
 */
const UsefulHeader = ({
    status,
    progress,
    error,
    loading,
    onRefresh
}) => {
    return (
        <div className={styles.headerSection}>
            <div className={styles.headerTop}>
                <h2 className={styles.title}>Upbit Market Data & Exchange Comparisons</h2>
                <div className={styles.headerControls}>
                    <span className={styles.statusBadge}>{status}</span>
                    <button
                        className={styles.refreshButton}
                        onClick={onRefresh}
                        disabled={loading}
                    >
                        {loading ? '⏳ Загрузка...' : '🔄 Обновить'}
                    </button>
                </div>
            </div>
            
            {loading && (
                <div className={styles.progressCard}>
                    <div className={styles.progressWrapper}>
                        <progress
                            className={styles.progressBar}
                            max="100"
                            value={progress.value}
                        />
                        <span className={styles.progressText}>{progress.text}</span>
                    </div>
                </div>
            )}
            
            {error && (
                <div className={styles.warningCard}>
                    <details className={styles.warningDetails}>
                        <summary className={styles.warningSummary}>
                            ⚠️ Предупреждения при загрузке (нажмите для подробностей)
                        </summary>
                        <div className={styles.warningMessage}>
                            {error}
                        </div>
                    </details>
                </div>
            )}
        </div>
    );
};

export default UsefulHeader;
