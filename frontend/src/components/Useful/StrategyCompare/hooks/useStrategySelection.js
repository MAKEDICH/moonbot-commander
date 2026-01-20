/**
 * Хук для выбора и сравнения стратегий
 */

import { useState, useCallback } from 'react';
import { readFileAsText, parseAllData, buildStrategiesText } from '../strategyParser';

/**
 * Хук управления выбором и сравнением стратегий
 * @param {Function} setError - Установка ошибки
 * @returns {Object} Состояние и методы
 */
const useStrategySelection = (setError) => {
    // Файлы и текст
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [manualText, setManualText] = useState('');
    
    // Стратегии
    const [allStrategies, setAllStrategies] = useState([]);
    const [parsedData, setParsedData] = useState([]);
    const [selectedIndexes, setSelectedIndexes] = useState(new Set());
    
    // Сравнение
    const [baselineIndex, setBaselineIndex] = useState(0);
    const [baselineFromSelected, setBaselineFromSelected] = useState(false);
    const [showOnlyDiff, setShowOnlyDiff] = useState(false);
    const [comparisonResult, setComparisonResult] = useState(null);
    const [initialValues, setInitialValues] = useState({});
    
    const [needsParsing, setNeedsParsing] = useState(false);

    /**
     * Добавление файлов
     */
    const addFiles = useCallback((files) => {
        const newFiles = Array.from(files).slice(0, 20 - uploadedFiles.length);
        setUploadedFiles(prev => [...prev, ...newFiles].slice(0, 20));
    }, [uploadedFiles.length]);

    /**
     * Удаление файла
     */
    const removeFile = useCallback((index) => {
        setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    }, []);

    /**
     * Очистка всего
     */
    const clearAll = useCallback(() => {
        setUploadedFiles([]);
        setManualText('');
        setAllStrategies([]);
        setParsedData([]);
        setSelectedIndexes(new Set());
        setComparisonResult(null);
        setError(null);
    }, [setError]);

    /**
     * Парсинг всех источников
     */
    const parseAll = useCallback(async () => {
        setError(null);
        let totalText = '';
        
        for (const file of uploadedFiles) {
            const txt = await readFileAsText(file);
            if (txt.trim()) totalText += '\n' + txt;
        }
        
        if (manualText.trim()) {
            totalText += '\n' + manualText;
        }
        
        if (!totalText.trim()) {
            setError('Загрузите стратегии с сервера или вставьте текст вручную');
            return;
        }
        
        const result = parseAllData(totalText);
        
        if (result.strategies.length > 0) {
            setAllStrategies(result.strategies);
            setParsedData(result.tree);
            setSelectedIndexes(new Set());
            setComparisonResult(null);
            setNeedsParsing(false);
        } else {
            setError('Не удалось распарсить ни одной стратегии.');
        }
    }, [uploadedFiles, manualText, setError]);

    /**
     * Переключение выбора стратегии
     */
    const toggleStrategySelection = useCallback((index) => {
        setSelectedIndexes(prev => {
            const newSet = new Set(prev);
            if (newSet.has(index)) {
                newSet.delete(index);
            } else {
                if (newSet.size >= 10) return prev;
                newSet.add(index);
            }
            return newSet;
        });
    }, []);

    /**
     * Получение списка эталонных стратегий
     */
    const getBaselineOptions = useCallback(() => {
        if (baselineFromSelected) {
            return Array.from(selectedIndexes).map(idx => ({
                index: idx,
                name: allStrategies[idx]?.strategyName || 'Без имени'
            }));
        }
        return allStrategies.map((s, idx) => ({
            index: idx,
            name: s.strategyName
        }));
    }, [baselineFromSelected, selectedIndexes, allStrategies]);

    /**
     * Сравнение стратегий
     */
    const compare = useCallback(() => {
        if (selectedIndexes.size === 0) {
            setError('Выберите хотя бы одну стратегию!');
            return;
        }
        
        let indexes = Array.from(selectedIndexes);
        
        const baseIdx = baselineIndex;
        const pos = indexes.indexOf(baseIdx);
        if (pos >= 0) indexes.splice(pos, 1);
        indexes.unshift(baseIdx);
        
        const selectedStrategies = indexes.map(i => allStrategies[i]);
        const baselineStrategy = selectedStrategies[0];
        
        const visited = new Set();
        const finalOrder = [];
        
        indexes.forEach(idx => {
            const lines = allStrategies[idx].originalLines;
            lines.forEach(line => {
                const eqPos = line.indexOf('=');
                if (eqPos > 0) {
                    const param = line.slice(0, eqPos).trim();
                    if (!visited.has(param)) {
                        visited.add(param);
                        finalOrder.push(param);
                    }
                }
            });
        });
        
        const rows = [];
        
        finalOrder.forEach(param => {
            const baselineValue = baselineStrategy.params[param] || '';
            let isAllSame = true;
            
            const values = selectedStrategies.map((st, idx) => {
                const val = st.params[param] || '';
                if (val !== baselineValue) isAllSame = false;
                return {
                    value: val,
                    isSame: idx === 0 || val === baselineValue,
                    strategyIndex: indexes[idx]
                };
            });
            
            if (showOnlyDiff && isAllSame) return;
            
            rows.push({ param, baselineValue, isAllSame, values });
        });
        
        const initVals = {};
        rows.forEach(row => {
            row.values.forEach((val, idx) => {
                const key = `${indexes[idx]}_${row.param}`;
                initVals[key] = val.value;
            });
        });
        setInitialValues(initVals);
        
        setComparisonResult({ indexes, strategies: selectedStrategies, rows });
        setError(null);
    }, [selectedIndexes, baselineIndex, allStrategies, showOnlyDiff, setError]);

    /**
     * Обновление значения параметра
     */
    const updateParamValue = useCallback((strategyIndex, param, newValue) => {
        setAllStrategies(prev => {
            const updated = [...prev];
            const st = { ...updated[strategyIndex] };
            
            st.params = { ...st.params, [param]: newValue };
            
            if (param in st.paramLinesMap) {
                const lineIdx = st.paramLinesMap[param];
                const oldLine = st.originalLines[lineIdx];
                const eqPos = oldLine.indexOf('=');
                if (eqPos >= 0) {
                    st.originalLines = [...st.originalLines];
                    st.originalLines[lineIdx] = oldLine.slice(0, eqPos + 1) + newValue;
                }
            } else {
                st.originalLines = [...st.originalLines, `${param}=${newValue}`];
                st.paramLinesMap = { ...st.paramLinesMap, [param]: st.originalLines.length - 1 };
                st.syntheticParamsSet = new Set([...st.syntheticParamsSet, param]);
            }
            
            updated[strategyIndex] = st;
            return updated;
        });
        
        setComparisonResult(prev => {
            if (!prev) return prev;
            
            const { rows, strategies, indexes } = prev;
            
            const updatedStrategies = strategies.map((st, idx) => {
                if (indexes[idx] === strategyIndex) {
                    return { ...st, params: { ...st.params, [param]: newValue } };
                }
                return st;
            });
            
            const updatedRows = rows.map(row => {
                if (row.param !== param) return row;
                
                const newBaselineValue = indexes[0] === strategyIndex ? newValue : row.baselineValue;
                let isAllSame = true;
                
                const updatedValues = row.values.map((val, idx) => {
                    const currentValue = val.strategyIndex === strategyIndex ? newValue : val.value;
                    const isSame = idx === 0 || currentValue === newBaselineValue;
                    if (!isSame) isAllSame = false;
                    
                    return { ...val, value: currentValue, isSame };
                });
                
                return { ...row, baselineValue: newBaselineValue, isAllSame, values: updatedValues };
            });
            
            return { ...prev, strategies: updatedStrategies, rows: updatedRows };
        });
    }, []);

    /**
     * Копирование выбранных стратегий
     */
    const copyStrategies = useCallback((indexes) => {
        return buildStrategiesText(indexes, allStrategies);
    }, [allStrategies]);

    return {
        uploadedFiles,
        addFiles,
        removeFile,
        manualText,
        setManualText,
        allStrategies,
        parsedData,
        selectedIndexes,
        toggleStrategySelection,
        baselineIndex,
        setBaselineIndex,
        baselineFromSelected,
        setBaselineFromSelected,
        showOnlyDiff,
        setShowOnlyDiff,
        comparisonResult,
        initialValues,
        needsParsing,
        setNeedsParsing,
        parseAll,
        clearAll,
        getBaselineOptions,
        compare,
        updateParamValue,
        copyStrategies
    };
};

export default useStrategySelection;

