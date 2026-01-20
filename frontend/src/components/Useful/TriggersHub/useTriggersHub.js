/**
 * Основной хук для управления состоянием Хаба триггеров
 * Объединяет все под-хуки в единый интерфейс
 */

import { useState, useCallback, useMemo } from 'react';
import { 
    countStrategies,
    parseStrategiesText,
    computeIndex,
    useServers,
    useCommands,
    useCommandHistory,
    useSendCommands,
    useParamModifiers
} from './hooks';

// Реэкспорт утилит для обратной совместимости
export {
    parseRangeList,
    extractNumsList,
    extractSingle,
    typeOfParam,
    valToMap,
    mapToText,
    buildSetParamCommand,
    countStrategies
} from './hooks/utils';

export { computeIndex } from './hooks/parser';

/**
 * Хук управления Хабом триггеров
 * @returns {Object} Состояние и методы
 */
const useTriggersHub = () => {
    // Основное состояние
    const [parsedItems, setParsedItems] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressMsg, setProgressMsg] = useState('');
    const [selectedRef, setSelectedRef] = useState(null);
    const [dupOnly, setDupOnly] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(-1); // -1 = Все
    const [activeChips, setActiveChips] = useState(new Set());
    const [soloChip, setSoloChip] = useState(null);
    const [inputText, setInputText] = useState('');

    // Серверы
    const serversHook = useServers(setInputText);

    // Команды
    const commandsHook = useCommands(parsedItems);

    // История
    const historyHook = useCommandHistory(commandsHook.commands);

    // Отправка команд
    const sendHook = useSendCommands(serversHook.servers);

    /**
     * Вычисленный индекс
     */
    const cachedIndex = useMemo(() => {
        return computeIndex(parsedItems);
    }, [parsedItems]);

    /**
     * Фильтрованные строки
     */
    const filteredRows = useMemo(() => {
        const { rows, idx } = cachedIndex;
        const dupKeys = Object.keys(idx).map(x => parseInt(x, 10)).filter(n => idx[n].count > 1);

        return rows.filter(r => {
            // Всегда показывать изменённые строки
            if (r.stg.params[r.param] !== (r.stg.originalParams?.[r.param] ?? r.value)) {
                return true;
            }

            // Фильтр дубликатов
            if (dupOnly) {
                const hasDup = r.nums.some(n => dupKeys.includes(n));
                if (!hasDup) return false;
            }

            // Solo фильтр
            if (soloChip !== null) {
                return r.nums.includes(soloChip);
            }

            return true;
        });
    }, [cachedIndex, dupOnly, soloChip]);

    // Модификаторы параметров
    const modifiersHook = useParamModifiers(
        parsedItems, 
        setParsedItems, 
        filteredRows, 
        commandsHook.getStrategyCommands
    );

    /**
     * Парсинг текста стратегий
     */
    const parse = useCallback(async () => {
        const text = inputText.trim();
        if (!text) {
            return { success: false, message: 'Вставьте текст стратегий' };
        }

        setIsProcessing(true);
        setProgressMsg('Парсинг данных...');
        setProgress(10);

        await new Promise(resolve => setTimeout(resolve, 50));

        try {
            const items = await parseStrategiesText(text, setProgress);
            
            setProgress(85);
            setParsedItems(items);

            // Инициализация активных чипов
            const index = computeIndex(items);
            const allKeys = Object.keys(index.idx).map(x => parseInt(x, 10));
            setActiveChips(new Set(allKeys));

            setProgress(100);
            setCurrentPage(1);

            return { success: true, count: countStrategies(items) };
        } finally {
            setIsProcessing(false);
        }
    }, [inputText]);

    /**
     * Данные для текущей страницы
     */
    const pageData = useMemo(() => {
        const totalRows = filteredRows.length;
        const totalPages = pageSize === -1 ? 1 : Math.max(1, Math.ceil(totalRows / pageSize));

        let startIdx = 0;
        let endIdx = totalRows;

        if (pageSize !== -1) {
            startIdx = (currentPage - 1) * pageSize;
            endIdx = Math.min(startIdx + pageSize, totalRows);
        }

        return {
            rows: filteredRows.slice(startIdx, endIdx),
            totalRows,
            totalPages,
            currentPage
        };
    }, [filteredRows, currentPage, pageSize]);

    /**
     * Метаинформация
     */
    const meta = useMemo(() => {
        const stgCount = countStrategies(parsedItems);
        const keysCount = Object.keys(cachedIndex.idx).length;
        return { strategies: stgCount, keys: keysCount };
    }, [parsedItems, cachedIndex]);

    /**
     * Переключение чипа
     */
    const toggleChip = useCallback((num, solo = false) => {
        if (solo) {
            setSoloChip(prev => prev === num ? null : num);
        } else {
            setActiveChips(prev => {
                const next = new Set(prev);
                if (next.has(num)) next.delete(num);
                else next.add(num);
                return next;
            });
        }
    }, []);

    return {
        // Состояние
        parsedItems,
        inputText,
        setInputText,
        isProcessing,
        progress,
        progressMsg,
        selectedRef,
        setSelectedRef,
        dupOnly,
        setDupOnly,
        currentPage,
        setCurrentPage,
        pageSize,
        setPageSize,
        activeChips,
        soloChip,

        // Серверы
        servers: serversHook.servers,
        selectedServer: serversHook.selectedServer,
        setSelectedServer: serversHook.setSelectedServer,
        loadingStrategies: serversHook.loadingStrategies,
        loadingProgress: serversHook.loadingProgress,
        loadStrategiesFromServer: serversHook.loadStrategiesFromServer,

        // Вычисленные данные
        cachedIndex,
        commands: commandsHook.commands,
        filteredRows,
        pageData,
        meta,

        // Методы
        parse,
        updateParamValue: modifiersHook.updateParamValue,
        addNumberToParam: modifiersHook.addNumberToParam,
        removeNumberFromParam: modifiersHook.removeNumberFromParam,
        clearChanges: modifiersHook.clearChanges,
        clearForwardBaseline: modifiersHook.clearForwardBaseline,
        clearRevertBaseline: modifiersHook.clearRevertBaseline,
        toggleChip,
        bulkModifyNumber: modifiersHook.bulkModifyNumber,
        checkDuplicates: commandsHook.checkDuplicates,
        removeDuplicateStrategies: modifiersHook.removeDuplicateStrategies,
        getForwardBaseline: commandsHook.getForwardBaseline,

        // Отправка команд
        selectedSendServers: sendHook.selectedSendServers,
        setSelectedSendServers: sendHook.setSelectedSendServers,
        isSending: sendHook.isSending,
        sendResult: sendHook.sendResult,
        setSendResult: sendHook.setSendResult,
        sendCommands: sendHook.sendCommands,

        // История
        commandHistory: historyHook.commandHistory,
        saveToHistory: historyHook.saveToHistory,
        removeHistoryBlock: historyHook.removeHistoryBlock,
        clearHistory: historyHook.clearHistory
    };
};

export default useTriggersHub;
