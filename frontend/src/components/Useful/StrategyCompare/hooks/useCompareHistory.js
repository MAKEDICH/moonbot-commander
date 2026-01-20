/**
 * Хук для работы с историей команд сравнения стратегий
 */

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'strategyCompare_history';

/**
 * Хук управления историей команд
 * @param {Object} comparisonResult - Результат сравнения
 * @param {Object} initialValues - Начальные значения параметров
 * @param {Function} setError - Установка ошибки
 * @returns {Object} История и методы управления
 */
const useCompareHistory = (comparisonResult, initialValues, setError) => {
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
     * Сохранение команд в историю с парами Forward/Revert
     */
    const saveToHistory = useCallback(() => {
        if (!comparisonResult || Object.keys(initialValues).length === 0) {
            setError('Нет изменений для сохранения!');
            return;
        }
        
        const changes = [];
        const { strategies, rows, indexes } = comparisonResult;
        
        strategies.forEach((strategy, stratIdx) => {
            const strategyIndex = indexes[stratIdx];
            
            rows.forEach(row => {
                const currentValue = row.values[stratIdx]?.value;
                const key = `${strategyIndex}_${row.param}`;
                const originalValue = initialValues[key];
                
                if (currentValue !== undefined && originalValue !== undefined && 
                    String(currentValue) !== String(originalValue)) {
                    changes.push({
                        forward: `SetParam "${strategy.strategyName}" ${row.param} ${currentValue}`,
                        revert: `SetParam "${strategy.strategyName}" ${row.param} ${originalValue}`,
                        oldVal: originalValue,
                        newVal: currentValue,
                        paramName: row.param,
                        target: strategy.strategyName
                    });
                }
            });
        });
        
        if (changes.length === 0) {
            setError('Нет изменений для сохранения!');
            return;
        }
        
        const now = new Date();
        const newBlock = {
            savedAt: now.toLocaleString('ru-RU', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit'
            }),
            changes: changes
        };
        
        const newHistory = [...commandHistory, newBlock];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));
        setCommandHistory(newHistory);
        setError(null);
    }, [comparisonResult, initialValues, commandHistory, setError]);

    /**
     * Удаление блока из истории
     */
    const removeHistoryBlock = useCallback((blockIndex) => {
        const newHistory = [...commandHistory];
        newHistory.splice(blockIndex, 1);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));
        setCommandHistory(newHistory);
    }, [commandHistory]);

    /**
     * Очистка всей истории
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

export default useCompareHistory;

