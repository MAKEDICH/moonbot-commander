/**
 * Хук для работы с историей команд
 */

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'triggersHub_history';

/**
 * Хук управления историей команд
 * @param {Object} commands - Объект с командами
 * @returns {Object} История и методы управления
 */
const useCommandHistory = (commands) => {
    const [commandHistory, setCommandHistory] = useState([]);

    // Загрузка истории из localStorage
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                setCommandHistory(JSON.parse(saved));
            }
        } catch (e) {
            console.error('Error loading history:', e);
        }
    }, []);

    /**
     * Сохранение в историю
     * @returns {Object} Результат сохранения
     */
    const saveToHistory = useCallback(() => {
        if (!commands || commands.changes.length === 0) {
            return { success: false, message: 'Нет изменений для сохранения!' };
        }

        const now = new Date();
        const newBlock = {
            savedAt: now.toLocaleString('ru-RU', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit'
            }),
            changes: commands.changes
        };

        const newHistory = [...commandHistory, newBlock];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));
        setCommandHistory(newHistory);

        return { success: true, message: 'Сохранено в историю!' };
    }, [commands, commandHistory]);

    /**
     * Удаление блока из истории
     * @param {number} blockIndex - Индекс блока
     */
    const removeHistoryBlock = useCallback((blockIndex) => {
        const newHistory = [...commandHistory];
        newHistory.splice(blockIndex, 1);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));
        setCommandHistory(newHistory);
    }, [commandHistory]);

    /**
     * Очистка истории
     */
    const clearHistory = useCallback(() => {
        localStorage.removeItem(STORAGE_KEY);
        setCommandHistory([]);
    }, []);

    return {
        commandHistory,
        saveToHistory,
        removeHistoryBlock,
        clearHistory
    };
};

export default useCommandHistory;

