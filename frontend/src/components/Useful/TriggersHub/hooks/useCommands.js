/**
 * Хук для генерации команд
 */

import { useMemo, useCallback } from 'react';
import { buildSetParamCommand } from './utils';

/**
 * Хук генерации и управления командами
 * @param {Array} parsedItems - Разобранные элементы
 * @returns {Object} Команды и методы проверки
 */
const useCommands = (parsedItems) => {
    /**
     * Генерация команд с Forward/Revert (раздельные baseline)
     */
    const commands = useMemo(() => {
        const fwd = [];
        const rev = [];
        const changes = [];

        const collect = (stg) => {
            Object.keys(stg.params).forEach(p => {
                const cur = stg.params[p];
                // Раздельные baseline для Forward и Revert
                const hasBF = stg.baselineForwardParams && Object.prototype.hasOwnProperty.call(stg.baselineForwardParams, p);
                const hasBR = stg.baselineRevertParams && Object.prototype.hasOwnProperty.call(stg.baselineRevertParams, p);
                const baseFwd = hasBF ? stg.baselineForwardParams[p] : (stg.originalParams?.[p] ?? cur);
                const baseRev = hasBR ? stg.baselineRevertParams[p] : (stg.originalParams?.[p] ?? cur);
                const who = stg.name || "NoName";

                // Forward: текущее отличается от forward baseline
                if (cur !== baseFwd) {
                    fwd.push(buildSetParamCommand(who, p, cur));
                }
                // Revert: baseRev отличается от текущего (откат к revert baseline)
                if (cur !== baseRev) {
                    rev.push(buildSetParamCommand(who, p, baseRev));
                }
                // Changes: для истории и отображения
                if (cur !== baseFwd || cur !== baseRev) {
                    changes.push({
                        forward: cur !== baseFwd ? buildSetParamCommand(who, p, cur) : null,
                        revert: cur !== baseRev ? buildSetParamCommand(who, p, baseRev) : null,
                        paramName: p,
                        oldVal: baseFwd,
                        newVal: cur,
                        target: who
                    });
                }
            });
        };

        (parsedItems || []).forEach(it => {
            if (it.type === "folder") {
                (it.strategies || []).forEach(stg => collect(stg));
            } else {
                collect(it);
            }
        });

        return {
            forward: fwd.join('\n'),
            revert: rev.join('\n'),
            changes: changes.filter(c => c.forward || c.revert)
        };
    }, [parsedItems]);

    /**
     * Проверка дубликатов команд
     */
    const checkDuplicates = useCallback(() => {
        if (!commands.forward || !commands.forward.trim()) {
            return { hasDuplicates: false, duplicates: [], message: 'Нет команд для проверки' };
        }

        const lines = commands.forward.split('\n').map(l => l.trim()).filter(l => l);
        const commandCount = {};

        lines.forEach(line => {
            commandCount[line] = (commandCount[line] || 0) + 1;
        });

        const duplicates = Object.keys(commandCount)
            .filter(cmd => commandCount[cmd] > 1)
            .map(cmd => ({ command: cmd, count: commandCount[cmd] }))
            .sort((a, b) => b.count - a.count);

        if (duplicates.length === 0) {
            return { hasDuplicates: false, duplicates: [], message: 'Дубликатов команд не найдено!' };
        }

        return { hasDuplicates: true, duplicates, message: `Найдено ${duplicates.length} дублирующихся команд` };
    }, [commands.forward]);

    /**
     * Получение команд от стратегии
     */
    const getStrategyCommands = useCallback((stg) => {
        const cmds = [];
        Object.keys(stg.params || {}).forEach(p => {
            const cur = stg.params[p];
            const hasBF = stg.baselineForwardParams && Object.prototype.hasOwnProperty.call(stg.baselineForwardParams, p);
            const baseFwd = hasBF ? stg.baselineForwardParams[p] : (stg.originalParams?.[p] ?? cur);
            const who = stg.name || "NoName";
            if (cur !== baseFwd) {
                cmds.push(buildSetParamCommand(who, p, cur));
            }
        });
        return cmds;
    }, []);

    /**
     * Получение baseline для Forward (для отображения)
     */
    const getForwardBaseline = useCallback((stg, param) => {
        const hasBF = stg.baselineForwardParams && Object.prototype.hasOwnProperty.call(stg.baselineForwardParams, param);
        return hasBF ? stg.baselineForwardParams[param] : (stg.originalParams?.[param] ?? stg.params[param]);
    }, []);

    return {
        commands,
        checkDuplicates,
        getStrategyCommands,
        getForwardBaseline
    };
};

export default useCommands;

