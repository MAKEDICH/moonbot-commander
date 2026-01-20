/**
 * Хук для загрузки стратегий с сервера
 */

import { useState, useEffect, useCallback } from 'react';
import { serversAPI, commandsAPI } from '../../../../api/api';
import api from '../../../../api/api';

/**
 * Хук управления загрузкой стратегий с сервера
 * @param {Function} setManualText - Установка текста стратегий
 * @param {Function} setNeedsParsing - Установка флага необходимости парсинга
 * @param {Function} setError - Установка ошибки
 * @returns {Object} Состояние и методы
 */
const useServerLoader = (setManualText, setNeedsParsing, setError) => {
    const [servers, setServers] = useState([]);
    const [selectedServer, setSelectedServer] = useState(null);
    const [loadingStrategies, setLoadingStrategies] = useState(false);
    const [loadingProgress, setLoadingProgress] = useState({ current: 0, max: 0, message: '' });

    // Загрузка серверов при монтировании
    useEffect(() => {
        loadServers();
    }, []);

    /**
     * Загрузка списка серверов
     */
    const loadServers = async () => {
        try {
            const response = await serversAPI.getAll();
            setServers(response.data.filter(s => s.is_active));
        } catch (err) {
            console.error('Ошибка загрузки серверов:', err);
        }
    };

    /**
     * Загрузка стратегий с сервера
     * @param {string} command - Команда для загрузки
     */
    const loadStrategiesFromServer = useCallback(async (command) => {
        if (!selectedServer) {
            setError('Выберите сервер!');
            return;
        }

        setLoadingStrategies(true);
        setLoadingProgress({ current: 0, max: 30, message: 'Подготовка...' });
        setError(null);

        try {
            // Очистка кэша
            setLoadingProgress({ current: 1, max: 30, message: 'Очистка старого кэша...' });
            try {
                await api.delete(`/api/strategies/cache/${selectedServer}`);
            } catch (e) {
                console.warn('Не удалось очистить кэш:', e);
            }

            // Отправка команды
            setLoadingProgress({ current: 2, max: 30, message: 'Отправка команды на MoonBot...' });
            await commandsAPI.send({
                server_id: selectedServer,
                command: command,
                timeout: 30
            });

            setLoadingProgress({ current: 3, max: 30, message: 'Ожидание ответа от MoonBot...' });

            // Ожидание стратегий
            let attempts = 0;
            const maxAttempts = 45;
            const delayMs = 1000;
            let lastPackCount = 0;
            let stableCount = 0;
            const stableThreshold = 3;
            let loaded = false;

            while (attempts < maxAttempts) {
                attempts++;

                setLoadingProgress({
                    current: 3 + attempts,
                    max: 30 + maxAttempts,
                    message: `Проверка данных... (попытка ${attempts}/${maxAttempts})`
                });

                await new Promise(r => setTimeout(r, delayMs));

                try {
                    const response = await api.get(`/api/strategies/cache/${selectedServer}`);
                    const cacheData = response.data;
                    const packs = cacheData.packs || [];
                    const currentPackCount = packs.length;

                    if (currentPackCount > 0) {
                        if (currentPackCount === lastPackCount) {
                            stableCount++;
                            setLoadingProgress({
                                current: 3 + attempts,
                                max: 30 + maxAttempts,
                                message: `Получено ${currentPackCount} пакет(ов), проверка завершённости... (${stableCount}/${stableThreshold})`
                            });
                        } else {
                            stableCount = 0;
                            lastPackCount = currentPackCount;
                            setLoadingProgress({
                                current: 3 + attempts,
                                max: 30 + maxAttempts,
                                message: `Получено ${currentPackCount} пакет(ов), ожидаем ещё...`
                            });
                        }

                        if (stableCount >= stableThreshold) {
                            setLoadingProgress({
                                current: 30 + maxAttempts,
                                max: 30 + maxAttempts,
                                message: `Обработка ${currentPackCount} пакет(ов)...`
                            });

                            const fullText = packs
                                .sort((a, b) => a.pack_number - b.pack_number)
                                .map(pack => pack.data)
                                .join('\n');

                            if (fullText.trim()) {
                                setManualText(fullText);
                                setLoadingProgress({ current: 30, max: 30, message: `Стратегии загружены! (${currentPackCount} пакет(ов))` });
                                setNeedsParsing(true);
                                loaded = true;
                            }
                            break;
                        }
                    }
                } catch (e) {
                    console.warn('Ошибка получения кэша:', e);
                }
            }

            // Финальная загрузка после таймаута
            if (lastPackCount > 0 && !loaded) {
                try {
                    const response = await api.get(`/api/strategies/cache/${selectedServer}`);
                    const cacheData = response.data;
                    if (cacheData.packs && cacheData.packs.length > 0) {
                        const fullText = cacheData.packs
                            .sort((a, b) => a.pack_number - b.pack_number)
                            .map(pack => pack.data)
                            .join('\n');

                        if (fullText.trim()) {
                            setManualText(fullText);
                            setLoadingProgress({ current: 30, max: 30, message: `Загружено ${cacheData.packs.length} пакет(ов). Возможно не все стратегии.` });
                            setNeedsParsing(true);
                        }
                    }
                } catch (e) {
                    console.error('Финальная ошибка загрузки:', e);
                }
            }

            if (attempts >= maxAttempts && lastPackCount === 0) {
                setError('Стратегии не получены. Проверьте связь с MoonBot.');
            }
        } catch (err) {
            setError(`Ошибка: ${err.message}`);
        } finally {
            setLoadingStrategies(false);
        }
    }, [selectedServer, setManualText, setNeedsParsing, setError]);

    return {
        servers,
        selectedServer,
        setSelectedServer,
        loadingStrategies,
        loadingProgress,
        loadStrategiesFromServer
    };
};

export default useServerLoader;

