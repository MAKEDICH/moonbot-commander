/**
 * Хук для отправки команд на серверы
 */

import { useState, useCallback } from 'react';
import { commandsAPI } from '../../../../api/api';

/**
 * Хук отправки команд
 * @param {Array} servers - Список серверов
 * @returns {Object} Состояние и методы отправки
 */
const useSendCommands = (servers) => {
    const [selectedSendServers, setSelectedSendServers] = useState([]);
    const [isSending, setIsSending] = useState(false);
    const [sendResult, setSendResult] = useState(null);

    /**
     * Отправка команд на серверы
     * @param {string} commandText - Текст команд
     * @returns {Promise<Object>} Результат отправки
     */
    const sendCommands = useCallback(async (commandText) => {
        if (!commandText || selectedSendServers.length === 0) {
            return { success: false, message: 'Выберите серверы и убедитесь, что есть команды' };
        }

        setIsSending(true);
        setSendResult(null);

        try {
            const commandList = commandText.split('\n')
                .map(cmd => cmd.trim())
                .filter(cmd => cmd.length > 0);

            if (commandList.length === 0) {
                throw new Error('Нет команд для отправки');
            }

            const selectedServersData = servers.filter(s => selectedSendServers.includes(s.id));

            let totalSuccess = 0;
            let totalFailed = 0;
            const allResults = [];

            for (const server of selectedServersData) {
                for (const cmd of commandList) {
                    try {
                        const result = await commandsAPI.send({
                            server_id: server.id,
                            command: cmd,
                            timeout: 10
                        });

                        allResults.push({
                            server_name: server.name,
                            command: cmd,
                            status: 'success',
                            response: result.data.response
                        });
                        totalSuccess++;
                    } catch (err) {
                        allResults.push({
                            server_name: server.name,
                            command: cmd,
                            status: 'error',
                            response: err.response?.data?.detail || 'Ошибка отправки'
                        });
                        totalFailed++;
                    }
                }
            }

            const result = {
                status: totalFailed === 0 ? 'success' : 'partial',
                results: allResults,
                summary: {
                    successful: totalSuccess,
                    failed: totalFailed,
                    total: allResults.length,
                    servers: selectedServersData.length,
                    commands: commandList.length
                },
                time: new Date().toLocaleString('ru-RU')
            };

            setSendResult(result);
            return { success: true, result };

        } catch (err) {
            const result = {
                status: 'error',
                message: err.message || 'Неизвестная ошибка'
            };
            setSendResult(result);
            return { success: false, message: err.message };
        } finally {
            setIsSending(false);
        }
    }, [selectedSendServers, servers]);

    return {
        selectedSendServers,
        setSelectedSendServers,
        isSending,
        sendResult,
        setSendResult,
        sendCommands
    };
};

export default useSendCommands;

