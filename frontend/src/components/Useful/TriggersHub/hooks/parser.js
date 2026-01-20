/**
 * Функции парсинга стратегий
 */

import { typeOfParam, extractSingle, extractNumsList } from './utils';

/**
 * Парсинг одной стратегии
 * @param {string[]} arr - Массив строк стратегии
 * @returns {Object} Объект стратегии
 */
export const parseSingleStrategy = (arr) => {
    const params = {};
    let name = '';

    arr.forEach(line => {
        if (!line || line.startsWith('//')) return;
        const i = line.indexOf('=');
        if (i === -1) return;
        const k = line.substring(0, i).trim();
        const v = line.substring(i + 1).trim();
        params[k] = v;
        if (k === 'StrategyName') name = v;
    });

    return {
        type: 'strategy',
        name: name,
        params: { ...params },
        originalParams: { ...params }
    };
};

/**
 * Вычисление индекса
 * @param {Array} items - Массив элементов
 * @returns {Object} Объект с rows и idx
 */
export const computeIndex = (items) => {
    const rows = [];
    (items || []).forEach(it => {
        if (it.type === "folder") {
            (it.strategies || []).forEach(stg => {
                Object.keys(stg.params || {}).forEach(p => {
                    const t = typeOfParam(p);
                    if (t === "Other") return;
                    const v = stg.params[p];
                    const nums = (t === "Launch" ? extractSingle(v) : (t === "Seconds" ? [] : extractNumsList(v)));
                    rows.push({ stg, strategy: stg.name || "NoName", folder: it.name || "", param: p, type: t, value: v, nums });
                });
            });
        } else {
            Object.keys(it.params || {}).forEach(p => {
                const t = typeOfParam(p);
                if (t === "Other") return;
                const v = it.params[p];
                const nums = (t === "Launch" ? extractSingle(v) : (t === "Seconds" ? [] : extractNumsList(v)));
                rows.push({ stg: it, strategy: it.name || "NoName", folder: "", param: p, type: t, value: v, nums });
            });
        }
    });

    // Сортировка: Launch первыми, BL/Sell/Clear в середине, Seconds последними
    rows.sort((a, b) => {
        const getOrder = (type) => {
            if (type === 'Launch') return 0;
            if (type === 'ByKey') return 1;
            if (type === 'BL' || type === 'Sell' || type === 'Clear') return 2;
            if (type === 'Seconds') return 3;
            return 4;
        };

        const orderA = getOrder(a.type);
        const orderB = getOrder(b.type);

        if (orderA !== orderB) return orderA - orderB;
        if (a.strategy !== b.strategy) return a.strategy.localeCompare(b.strategy);
        if (a.folder !== b.folder) return a.folder.localeCompare(b.folder);
        return a.param.localeCompare(b.param);
    });

    const idx = {};
    rows.forEach(r => {
        r.nums.forEach(n => {
            if (!idx[n]) idx[n] = { count: 0, items: [] };
            idx[n].count++;
            idx[n].items.push(r);
        });
    });
    return { rows, idx };
};

/**
 * Дедупликация элементов
 * @param {Array} items - Массив элементов
 * @returns {Array} Дедуплицированный массив
 */
export const dedupItems = (items) => {
    const out = [];
    const mergedFolders = {};

    items.forEach(it => {
        if (it.type === 'folder') {
            const key = it.name || '';
            if (!mergedFolders[key]) {
                mergedFolders[key] = { type: 'folder', name: it.name, strategies: [] };
                out.push(mergedFolders[key]);
            }
            (it.strategies || []).forEach(s => {
                mergedFolders[key].strategies.push(s);
            });
        } else {
            out.push(it);
        }
    });

    return out;
};

/**
 * Парсинг текста стратегий
 * @param {string} text - Текст со стратегиями
 * @param {Function} setProgress - Функция установки прогресса
 * @returns {Promise<Array>} Массив разобранных элементов
 */
export const parseStrategiesText = async (text, setProgress) => {
    const lines = text.split(/\r?\n/).map(l => l.trim());
    let items = [];
    let currentFolder = null;
    let insideFolder = false;
    let insideStrategy = false;
    let strategyLines = [];

    const chunkSize = 10000;
    let processedLines = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line) {
            if (line.startsWith('#Begin_Folder')) {
                if (insideStrategy && strategyLines.length > 0) {
                    const stg = parseSingleStrategy(strategyLines);
                    if (currentFolder) currentFolder.strategies.push(stg);
                    else items.push(stg);
                    strategyLines = [];
                    insideStrategy = false;
                }
                insideFolder = true;
                const folderName = line.replace('#Begin_Folder', '').trim();
                currentFolder = { type: 'folder', name: folderName, strategies: [] };
            } else if (line.startsWith('#End_Folder')) {
                if (insideStrategy && strategyLines.length > 0) {
                    const stg = parseSingleStrategy(strategyLines);
                    if (currentFolder) currentFolder.strategies.push(stg);
                    strategyLines = [];
                    insideStrategy = false;
                }
                if (currentFolder) items.push(currentFolder);
                currentFolder = null;
                insideFolder = false;
            } else if (line.startsWith('##Begin_Strategy')) {
                if (insideStrategy && strategyLines.length > 0) {
                    const stg = parseSingleStrategy(strategyLines);
                    if (currentFolder) currentFolder.strategies.push(stg);
                    else items.push(stg);
                    strategyLines = [];
                }
                insideStrategy = true;
                strategyLines = [];
            } else if (line.startsWith('##End_Strategy')) {
                if (insideStrategy) {
                    const stg = parseSingleStrategy(strategyLines);
                    if (currentFolder) currentFolder.strategies.push(stg);
                    else items.push(stg);
                    strategyLines = [];
                }
                insideStrategy = false;
            } else if (insideStrategy) {
                strategyLines.push(line);
            }
        }

        processedLines++;
        if (processedLines % chunkSize === 0 && setProgress) {
            const prog = 10 + (processedLines / lines.length) * 70;
            setProgress(prog);
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }

    // Обработка оставшихся данных
    if (insideStrategy && strategyLines.length > 0) {
        const stg = parseSingleStrategy(strategyLines);
        if (currentFolder) currentFolder.strategies.push(stg);
        else items.push(stg);
    }
    if (insideFolder && currentFolder) {
        items.push(currentFolder);
    }

    return dedupItems(items);
};

