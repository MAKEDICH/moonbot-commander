/**
 * Карточка обновления
 */

import React from 'react';
import { FiDownload, FiRefreshCw, FiCheck, FiAlertTriangle, FiClock, FiDatabase } from 'react-icons/fi';
import styles from '../Updates.module.css';

/**
 * Компонент управления обновлениями
 */
const UpdateCard = ({ 
    updateInfo, 
    checking, 
    preparing, 
    executing,
    confirmUpdate,
    setConfirmUpdate,
    checkForUpdates,
    prepareUpdate,
    executeUpdate
}) => {
    return (
        <div className={styles.card}>
            <div className={styles.cardHeader}>
                <h2><FiDownload /> Обновление</h2>
            </div>
            <div className={styles.cardBody}>
                {updateInfo?.update_available ? (
                    <>
                        <div className={styles.updateDetails}>
                            <h3>{updateInfo.release_name || `Версия ${updateInfo.latest_version}`}</h3>
                            
                            {updateInfo.versions_behind > 0 && (
                                <p className={styles.versionsBehind}>
                                    <FiClock />
                                    Вы отстаёте на {updateInfo.versions_behind} версий
                                </p>
                            )}
                            
                            {updateInfo.requires_migration && (
                                <p className={styles.migrationWarning}>
                                    <FiDatabase />
                                    Обновление включает миграции базы данных
                                </p>
                            )}
                            
                            {updateInfo.release_notes && (
                                <div className={styles.releaseNotes}>
                                    <h4>Что нового:</h4>
                                    <div className={styles.notesContent}>
                                        {updateInfo.release_notes.split('\n').slice(0, 10).map((line, i) => (
                                            <p key={i}>{line}</p>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        <div className={styles.actions}>
                            {!confirmUpdate ? (
                                <button
                                    className={styles.primaryBtn}
                                    onClick={() => prepareUpdate(updateInfo.latest_version, updateInfo.download_url)}
                                    disabled={preparing}
                                >
                                    {preparing ? (
                                        <>
                                            <FiRefreshCw className={styles.spinner} />
                                            Подготовка...
                                        </>
                                    ) : (
                                        <>
                                            <FiDownload />
                                            Обновить до v{updateInfo.latest_version}
                                        </>
                                    )}
                                </button>
                            ) : (
                                <div className={styles.confirmSection}>
                                    <p className={styles.confirmText}>
                                        <FiAlertTriangle />
                                        Обновление готово. Приложение будет перезапущено.
                                    </p>
                                    <div className={styles.confirmButtons}>
                                        <button
                                            className={styles.primaryBtn}
                                            onClick={executeUpdate}
                                            disabled={executing}
                                        >
                                            {executing ? (
                                                <>
                                                    <FiRefreshCw className={styles.spinner} />
                                                    Обновление...
                                                </>
                                            ) : (
                                                <>
                                                    <FiCheck />
                                                    Подтвердить и обновить
                                                </>
                                            )}
                                        </button>
                                        <button
                                            className={styles.secondaryBtn}
                                            onClick={() => setConfirmUpdate(false)}
                                            disabled={executing}
                                        >
                                            Отмена
                                        </button>
                                    </div>
                                </div>
                            )}
                            
                            <button
                                className={styles.secondaryBtn}
                                onClick={checkForUpdates}
                                disabled={checking}
                            >
                                {checking ? (
                                    <FiRefreshCw className={styles.spinner} />
                                ) : (
                                    <FiRefreshCw />
                                )}
                                Проверить снова
                            </button>
                        </div>
                    </>
                ) : (
                    <div className={styles.noUpdates}>
                        <FiCheck className={styles.checkIcon} />
                        <p>У вас установлена последняя версия</p>
                        <button
                            className={styles.secondaryBtn}
                            onClick={checkForUpdates}
                            disabled={checking}
                        >
                            {checking ? (
                                <FiRefreshCw className={styles.spinner} />
                            ) : (
                                <FiRefreshCw />
                            )}
                            Проверить обновления
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UpdateCard;

