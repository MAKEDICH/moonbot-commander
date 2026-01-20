/**
 * Страница обновлений
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiRefreshCw, FiCheck, FiAlertTriangle, FiPackage } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import styles from './Updates.module.css';
import PageHeader from '../../components/PageHeader';
import api from '../../api/api';
import {
    CurrentVersionCard,
    UpdateCard,
    VersionsCard,
    BackupsCard,
    UpdateStatusCard
} from './components';

const Updates = () => {
    const { token } = useAuth(); // eslint-disable-line no-unused-vars
    const { confirmDelete, confirmWarning } = useConfirm();

    // Состояния
    const [updateInfo, setUpdateInfo] = useState(null);
    const [versions, setVersions] = useState([]);
    const [backups, setBackups] = useState([]);
    const [systemInfo, setSystemInfo] = useState(null);
    const [updateStatus, setUpdateStatus] = useState(null);

    const [loading, setLoading] = useState(true);
    const [checking, setChecking] = useState(false);
    const [preparing, setPreparing] = useState(false);
    const [executing, setExecuting] = useState(false);

    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    const [showVersions, setShowVersions] = useState(false);
    const [showBackups, setShowBackups] = useState(false);
    const [selectedVersion, setSelectedVersion] = useState(null);

    const [confirmUpdate, setConfirmUpdate] = useState(false);

    // Загрузка данных
    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const fetchWithFallback = async (url, fallback = null) => {
                try {
                    const res = await api.get(url);
                    return res.data;
                } catch (e) {
                    console.warn(`API ${url} failed:`, e.message);
                    return fallback;
                }
            };

            const [updateData, statusData, backupsData, systemData] = await Promise.all([
                fetchWithFallback('/api/updates/check', { update_available: false }),
                fetchWithFallback('/api/updates/status', {}),
                fetchWithFallback('/api/updates/backups', { backups: [] }),
                fetchWithFallback('/api/updates/system-info', {}),
            ]);

            if (updateData) setUpdateInfo(updateData);
            if (statusData) setUpdateStatus(statusData);
            if (backupsData) setBackups(backupsData.backups || []);
            if (systemData) setSystemInfo(systemData);

        } catch (err) {
            console.error('Error fetching updates data:', err);
            setError('Ошибка загрузки данных: ' + err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Проверка обновлений
    const checkForUpdates = async () => {
        try {
            setChecking(true);
            setError(null);

            const response = await api.get('/api/updates/check?force=true');
            const data = response.data;
            setUpdateInfo(data);

            if (data.update_available) {
                setSuccess(`Доступна новая версия: ${data.latest_version}`);
            } else {
                setSuccess('У вас установлена последняя версия');
            }

        } catch (err) {
            setError('Ошибка проверки обновлений: ' + (err.response?.data?.detail || err.message));
        } finally {
            setChecking(false);
        }
    };

    // Получить список версий
    const fetchVersions = async () => {
        try {
            const response = await api.get('/api/updates/versions');
            const data = response.data;
            setVersions(data.versions || []);
            setShowVersions(true);

        } catch (err) {
            console.error('fetchVersions error:', err);
            setError('Ошибка получения версий: ' + (err.response?.data?.detail || err.message));
        }
    };

    // Подготовка обновления
    const prepareUpdate = async (version, downloadUrl) => {
        try {
            setPreparing(true);
            setError(null);
            setSuccess(null);

            const response = await api.post('/api/updates/prepare', {
                target_version: version,
                download_url: downloadUrl
            });

            const data = response.data;
            setUpdateStatus(data.status);
            setSuccess(data.message);
            setConfirmUpdate(true);

        } catch (err) {
            setError('Ошибка подготовки: ' + (err.response?.data?.detail || err.message));
        } finally {
            setPreparing(false);
        }
    };

    // Выполнение обновления
    const executeUpdate = async () => {
        try {
            setExecuting(true);
            setError(null);

            await api.post('/api/updates/execute');

            setSuccess('Обновление запущено! Приложение будет перезапущено...');

            setTimeout(() => {
                setSuccess('Приложение перезапускается. Страница обновится автоматически...');
            }, 2000);

            setTimeout(() => {
                window.location.reload();
            }, 30000);

        } catch (err) {
            setError('Ошибка выполнения обновления: ' + (err.response?.data?.detail || err.message));
            setExecuting(false);
        }
    };

    // Откат обновления
    const rollbackUpdate = async (backupPath) => {
        const confirmed = await confirmWarning(
            'Вы уверены, что хотите откатить обновление? Это восстановит предыдущую версию БД.',
            { title: 'Откат обновления', confirmText: 'Откатить' }
        );
        if (!confirmed) return;

        try {
            setError(null);

            const response = await api.post('/api/updates/rollback', { backup_path: backupPath });
            const data = response.data;

            setSuccess(data.message + '. Перезапустите приложение.');
            fetchData();

        } catch (err) {
            setError('Ошибка отката: ' + (err.response?.data?.detail || err.message));
        }
    };

    // Очистка старых бэкапов
    const cleanupBackups = async () => {
        const confirmed = await confirmDelete(
            'Удалить старые бэкапы? Будут оставлены только последние 5.',
            { title: 'Очистка бэкапов', confirmText: 'Удалить' }
        );
        if (!confirmed) return;

        try {
            await api.delete('/api/updates/cleanup-backups?keep_count=5');

            setSuccess('Старые бэкапы удалены');
            fetchData();

        } catch (err) {
            setError('Ошибка очистки бэкапов: ' + (err.response?.data?.detail || err.message));
        }
    };

    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.loading}>
                    <FiRefreshCw className={styles.spinner} />
                    <span>Загрузка...</span>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <PageHeader
                icon={<FiPackage />}
                title="Обновления"
                gradient="gold"
            />

            {/* Уведомления */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className={styles.alert + ' ' + styles.alertError}
                    >
                        <FiAlertTriangle />
                        <span>{error}</span>
                        <button onClick={() => setError(null)}>×</button>
                    </motion.div>
                )}

                {success && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className={styles.alert + ' ' + styles.alertSuccess}
                    >
                        <FiCheck />
                        <span>{success}</span>
                        <button onClick={() => setSuccess(null)}>×</button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Текущая версия */}
            <CurrentVersionCard
                updateInfo={updateInfo}
                systemInfo={systemInfo}
                updateStatus={updateStatus}
                loading={loading}
            />

            {/* Проверка обновлений */}
            <UpdateCard
                updateInfo={updateInfo}
                checking={checking}
                preparing={preparing}
                executing={executing}
                confirmUpdate={confirmUpdate}
                setConfirmUpdate={setConfirmUpdate}
                checkForUpdates={checkForUpdates}
                prepareUpdate={prepareUpdate}
                executeUpdate={executeUpdate}
            />

            {/* Выбор версии */}
            <VersionsCard
                versions={versions}
                showVersions={showVersions}
                preparing={preparing}
                fetchVersions={fetchVersions}
                prepareUpdate={prepareUpdate}
                setSelectedVersion={setSelectedVersion}
            />

            {/* Бэкапы и откат */}
            <BackupsCard
                backups={backups}
                showBackups={showBackups}
                setShowBackups={setShowBackups}
                rollbackUpdate={rollbackUpdate}
                cleanupBackups={cleanupBackups}
            />

            {/* Статус обновления */}
            <UpdateStatusCard updateStatus={updateStatus} />
        </div>
    );
};

export default Updates;

