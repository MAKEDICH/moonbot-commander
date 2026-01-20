/**
 * Хук для отправки команд на серверы
 */

import { useState, useCallback } from 'react';
import { commandsAPI } from '../../../../api/api';

/**
 * Хук отправки команд
 * @param {Array} servers - Список серверов
 * @param {Function} setError - Установка ошибки
 * @returns {Object} Состояние и методы
 */
const useCommandSender = (servers, setError) => {
    const [selectedSendServers, setSelectedSendServers] = useState([]);
    const [isSending, setIsSending] = useState(false);
    const [sendResult, setSendResult] = useState(null);
    const [commandPack, setCommandPack] = useState('');

    /**
     * Отправка команд на выбранные серверы
     * @param {string} commands - Текст команд (опционально, по умолчанию commandPack)
     */
    const sendCommands = useCallback(async (commands = null) => {
        const commandsToSend = commands || commandPack;
        
        if (!commandsToSend || selectedSendServers.length === 0) {
            setError('Выберите серверы и убедитесь, что есть команды для отправки');
            return;
        }

        setIsSending(true);
        setSendResult(null);

        try {
            const commandList = commandsToSend.split('\n')
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

            setSendResult({
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
            });

        } catch (err) {
            setSendResult({
                status: 'error',
                message: err.message || 'Неизвестная ошибка'
            });
            setError('Ошибка: ' + err.message);
        } finally {
            setIsSending(false);
        }
    }, [commandPack, selectedSendServers, servers, setError]);

    return {
        selectedSendServers,
        setSelectedSendServers,
        isSending,
        sendResult,
        setSendResult,
        commandPack,
        setCommandPack,
        sendCommands
    };
};

export default useCommandSender;

