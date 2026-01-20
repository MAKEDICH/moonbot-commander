/**
 * Хук для модификации параметров стратегий
 */

import { useCallback } from 'react';
import { valToMap, mapToText } from './utils';

/**
 * Хук модификации параметров
 * @param {Array} parsedItems - Разобранные элементы
 * @param {Function} setParsedItems - Функция обновления элементов
 * @param {Array} filteredRows - Отфильтрованные строки
 * @param {Function} getStrategyCommands - Функция получения команд стратегии
 * @returns {Object} Методы модификации
 */
const useParamModifiers = (parsedItems, setParsedItems, filteredRows, getStrategyCommands) => {
    /**
     * Обновление значения параметра
     */
    const updateParamValue = useCallback((stg, param, newValue) => {
        stg.params[param] = newValue;
        setParsedItems([...parsedItems]);
    }, [parsedItems, setParsedItems]);

    /**
     * Добавление номера к параметру
     */
    const addNumberToParam = useCallback((stg, param, num, sec = null) => {
        const cur = stg.params[param] || '';
        const sep = cur.includes(';') ? ';' : (cur.includes(',') ? ',' : ' ');
        const map = valToMap(cur);
        map[num] = sec != null ? sec : true;
        stg.params[param] = mapToText(map, sep);
        setParsedItems([...parsedItems]);
    }, [parsedItems, setParsedItems]);

    /**
     * Удаление номера из параметра
     */
    const removeNumberFromParam = useCallback((stg, param, num) => {
        const cur = stg.params[param] || '';
        const sep = cur.includes(';') ? ';' : (cur.includes(',') ? ',' : ' ');
        const map = valToMap(cur);
        delete map[num];
        stg.params[param] = mapToText(map, sep);
        setParsedItems([...parsedItems]);
    }, [parsedItems, setParsedItems]);

    /**
     * Очистка baseline (сброс изменений)
     */
    const clearChanges = useCallback(() => {
        parsedItems.forEach(it => {
            if (it.type === 'folder') {
                (it.strategies || []).forEach(stg => {
                    stg.params = { ...stg.originalParams };
                    delete stg.baselineForwardParams;
                    delete stg.baselineRevertParams;
                });
            } else {
                it.params = { ...it.originalParams };
                delete it.baselineForwardParams;
                delete it.baselineRevertParams;
            }
        });
        setParsedItems([...parsedItems]);
    }, [parsedItems, setParsedItems]);

    /**
     * Очистка только Forward baseline
     */
    const clearForwardBaseline = useCallback(() => {
        parsedItems.forEach(it => {
            if (it.type === 'folder') {
                (it.strategies || []).forEach(stg => {
                    stg.baselineForwardParams = { ...stg.params };
                });
            } else {
                it.baselineForwardParams = { ...it.params };
            }
        });
        setParsedItems([...parsedItems]);
    }, [parsedItems, setParsedItems]);

    /**
     * Очистка только Revert baseline
     */
    const clearRevertBaseline = useCallback(() => {
        parsedItems.forEach(it => {
            if (it.type === 'folder') {
                (it.strategies || []).forEach(stg => {
                    stg.baselineRevertParams = { ...stg.params };
                });
            } else {
                it.baselineRevertParams = { ...it.params };
            }
        });
        setParsedItems([...parsedItems]);
    }, [parsedItems, setParsedItems]);

    /**
     * Массовое добавление/удаление номера
     */
    const bulkModifyNumber = useCallback((num, sec, add, includeLaunch = false) => {
        let changed = 0;

        filteredRows.forEach(r => {
            if (r.type !== 'BL' && r.type !== 'Sell' && r.type !== 'Clear' && !(includeLaunch && r.type === 'Launch')) return;

            const stg = r.stg;
            const param = r.param;
            const current = stg.params[param] || '';
            const sep = current.includes(';') ? ';' : (current.includes(',') ? ',' : ' ');
            const map = valToMap(current);

            if (add) {
                map[num] = sec != null ? sec : true;
            } else {
                delete map[num];
            }

            const next = mapToText(map, sep);
            if (next !== current) {
                stg.params[param] = next;
                changed++;
            }
        });

        if (changed > 0) {
            setParsedItems([...parsedItems]);
        }

        return changed;
    }, [filteredRows, parsedItems, setParsedItems]);

    /**
     * Удаление дублирующихся стратегий
     */
    const removeDuplicateStrategies = useCallback(() => {
        const commandToStrategies = {};

        parsedItems.forEach(it => {
            if (it.type === 'folder') {
                (it.strategies || []).forEach(stg => {
                    const cmds = getStrategyCommands(stg);
                    cmds.forEach(cmd => {
                        if (!commandToStrategies[cmd]) commandToStrategies[cmd] = [];
                        commandToStrategies[cmd].push({ item: it, strategy: stg });
                    });
                });
            } else {
                const cmds = getStrategyCommands(it);
                cmds.forEach(cmd => {
                    if (!commandToStrategies[cmd]) commandToStrategies[cmd] = [];
                    commandToStrategies[cmd].push({ item: null, strategy: it });
                });
            }
        });

        const strategiesToRemove = new Set();
        Object.keys(commandToStrategies).forEach(cmd => {
            const strategies = commandToStrategies[cmd];
            if (strategies.length > 1) {
                for (let i = 1; i < strategies.length; i++) {
                    strategiesToRemove.add(strategies[i].strategy);
                }
            }
        });

        if (strategiesToRemove.size === 0) {
            return { success: false, removed: 0, message: 'Дублирующихся стратегий не найдено' };
        }

        let removed = 0;
        const newItems = parsedItems.filter(it => {
            if (it.type === 'folder') {
                const before = it.strategies.length;
                it.strategies = it.strategies.filter(s => !strategiesToRemove.has(s));
                removed += (before - it.strategies.length);
                return it.strategies.length > 0;
            } else {
                if (strategiesToRemove.has(it)) {
                    removed++;
                    return false;
                }
                return true;
            }
        });

        setParsedItems(newItems);
        return { success: true, removed, message: `Удалено ${removed} дублирующихся стратегий` };
    }, [parsedItems, setParsedItems, getStrategyCommands]);

    return {
        updateParamValue,
        addNumberToParam,
        removeNumberFromParam,
        clearChanges,
        clearForwardBaseline,
        clearRevertBaseline,
        bulkModifyNumber,
        removeDuplicateStrategies
    };
};

export default useParamModifiers;

