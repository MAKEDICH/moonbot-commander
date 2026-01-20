/**
 * Хук для сравнения стратегий MoonBot
 * Объединяет все под-хуки в единый интерфейс
 */

import { useState, useEffect, useCallback } from 'react';
import {
    useServerLoader,
    useStrategySelection,
    useCommandSender,
    useCompareHistory
} from './hooks';

export default function useStrategyCompare() {
    // Цвета (по умолчанию: мягкий бирюзовый для совпадений, тёплый янтарный для отличий)
    const [trueColor, setTrueColor] = useState('#06b6d4');
    const [falseColor, setFalseColor] = useState('#fbbf24');
    
    // UI
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [error, setError] = useState(null);
    
    // Загрузка цветов из localStorage
    useEffect(() => {
        const savedTrue = localStorage.getItem('strategyCompare_trueColor');
        const savedFalse = localStorage.getItem('strategyCompare_falseColor');
        if (savedTrue) setTrueColor(savedTrue);
        if (savedFalse) setFalseColor(savedFalse);
    }, []);
    
    // Сохранение цветов
    useEffect(() => {
        localStorage.setItem('strategyCompare_trueColor', trueColor);
    }, [trueColor]);
    
    useEffect(() => {
        localStorage.setItem('strategyCompare_falseColor', falseColor);
    }, [falseColor]);

    // Хук выбора и сравнения стратегий
    const selectionHook = useStrategySelection(setError);

    // Хук загрузки с сервера
    const serverHook = useServerLoader(
        selectionHook.setManualText,
        selectionHook.setNeedsParsing,
        setError
    );

    // Хук отправки команд
    const senderHook = useCommandSender(serverHook.servers, setError);

    // Хук истории
    const historyHook = useCompareHistory(
        selectionHook.comparisonResult,
        selectionHook.initialValues,
        setError
    );

    /**
     * Генерация команд SetParam из изменённых параметров
     */
    const generateCommandPack = useCallback(() => {
        if (!selectionHook.comparisonResult || Object.keys(selectionHook.initialValues).length === 0) return '';
        
        const commands = [];
        const { strategies, rows, indexes } = selectionHook.comparisonResult;
        
        strategies.forEach((strategy, stratIdx) => {
            const strategyIndex = indexes[stratIdx];
            
            rows.forEach(row => {
                const currentValue = row.values[stratIdx]?.value;
                const key = `${strategyIndex}_${row.param}`;
                const initialValue = selectionHook.initialValues[key];
                
                if (currentValue !== undefined && initialValue !== undefined && 
                    String(currentValue) !== String(initialValue)) {
                    const cmd = `SetParam "${strategy.strategyName}" ${row.param} ${currentValue}`;
                    commands.push(cmd);
                }
            });
        });
        
        return commands.join('\n');
    }, [selectionHook.comparisonResult, selectionHook.initialValues]);

    // Автоматическое формирование команд при изменении параметров
    useEffect(() => {
        if (!selectionHook.comparisonResult || Object.keys(selectionHook.initialValues).length === 0) return;
        
        const timer = setTimeout(() => {
            const commands = generateCommandPack();
            senderHook.setCommandPack(commands);
        }, 500);
        
        return () => clearTimeout(timer);
    }, [selectionHook.comparisonResult, selectionHook.initialValues, generateCommandPack, senderHook]);

    /**
     * Отправка команд
     */
    const sendCommands = useCallback(async () => {
        const commands = senderHook.commandPack || generateCommandPack();
        await senderHook.sendCommands(commands);
    }, [senderHook, generateCommandPack]);
    
    return {
        // Файлы и текст
        uploadedFiles: selectionHook.uploadedFiles,
        addFiles: selectionHook.addFiles,
        removeFile: selectionHook.removeFile,
        manualText: selectionHook.manualText,
        setManualText: selectionHook.setManualText,
        
        // Парсинг
        parseAll: selectionHook.parseAll,
        clearAll: selectionHook.clearAll,
        allStrategies: selectionHook.allStrategies,
        parsedData: selectionHook.parsedData,
        needsParsing: selectionHook.needsParsing,
        
        // Выбор
        selectedIndexes: selectionHook.selectedIndexes,
        toggleStrategySelection: selectionHook.toggleStrategySelection,
        
        // Сравнение
        baselineIndex: selectionHook.baselineIndex,
        setBaselineIndex: selectionHook.setBaselineIndex,
        baselineFromSelected: selectionHook.baselineFromSelected,
        setBaselineFromSelected: selectionHook.setBaselineFromSelected,
        showOnlyDiff: selectionHook.showOnlyDiff,
        setShowOnlyDiff: selectionHook.setShowOnlyDiff,
        compare: selectionHook.compare,
        comparisonResult: selectionHook.comparisonResult,
        updateParamValue: selectionHook.updateParamValue,
        getBaselineOptions: selectionHook.getBaselineOptions,
        copyStrategies: selectionHook.copyStrategies,
        
        // Цвета
        trueColor,
        setTrueColor,
        falseColor,
        setFalseColor,
        
        // Серверы
        servers: serverHook.servers,
        selectedServer: serverHook.selectedServer,
        setSelectedServer: serverHook.setSelectedServer,
        loadingStrategies: serverHook.loadingStrategies,
        loadingProgress: serverHook.loadingProgress,
        loadStrategiesFromServer: serverHook.loadStrategiesFromServer,
        
        // UI
        sidebarOpen,
        setSidebarOpen,
        error,
        setError,
        
        // Отправка команд
        selectedSendServers: senderHook.selectedSendServers,
        setSelectedSendServers: senderHook.setSelectedSendServers,
        isSending: senderHook.isSending,
        sendResult: senderHook.sendResult,
        setSendResult: senderHook.setSendResult,
        commandPack: senderHook.commandPack,
        setCommandPack: senderHook.setCommandPack,
        generateCommandPack,
        sendCommands,
        
        // История
        saveToHistory: historyHook.saveToHistory,
        commandHistory: historyHook.commandHistory,
        removeHistoryBlock: historyHook.removeHistoryBlock,
        clearHistory: historyHook.clearHistory
    };
}
