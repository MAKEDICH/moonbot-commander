/**
 * Парсер стратегий MoonBot
 * Функции для парсинга текста стратегий в структурированные данные
 */

/**
 * Чтение файла как текст
 * @param {File} file - Файл для чтения
 * @returns {Promise<string>} Содержимое файла
 */
export const readFileAsText = (file) => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result || '');
        reader.onerror = () => resolve('');
        reader.readAsText(file);
    });
};

/**
 * Парсинг текста одной стратегии
 * @param {string} blockText - Текст блока стратегии
 * @param {Array} strategiesList - Список стратегий для добавления
 * @returns {Object} Объект с типом, именем и индексом стратегии
 */
export const parseStrategyText = (blockText, strategiesList) => {
    const lines = blockText.split(/\r?\n/).filter(line => {
        const up = line.toUpperCase();
        return !(up.includes('##BEGIN_STRATEGY') || up.includes('##END_STRATEGY'));
    });
    
    const params = {};
    const paramLinesMap = {};
    const paramOrder = [];
    
    lines.forEach((l, idx) => {
        const eqPos = l.indexOf('=');
        if (eqPos > 0) {
            const k = l.slice(0, eqPos).trim();
            const v = l.slice(eqPos + 1).trim();
            params[k] = v;
            paramLinesMap[k] = idx;
            paramOrder.push(k);
        }
    });
    
    // Авто-добавление Active и FVersion
    if (!('Active' in params)) {
        params['Active'] = '0';
        paramOrder.push('Active');
    }
    if (!('FVersion' in params)) {
        params['FVersion'] = '12';
        paramOrder.push('FVersion');
    }
    
    const strategyName = params['StrategyName'] || 'Без имени (авто)';
    const idx = strategiesList.length;
    
    strategiesList.push({
        strategyName,
        originalLines: [...lines],
        params,
        originalParams: { ...params }, // Сохраняем оригинальные параметры для сравнения
        paramLinesMap,
        paramOrder,
        baselineOriginalLines: [...lines],
        syntheticParamsSet: new Set()
    });
    
    return { type: 'strategy', strategyName, index: idx };
};

/**
 * Парсинг блока стратегии
 * @param {Array} lines - Массив строк
 * @param {number} startIndex - Начальный индекс
 * @param {Function} getPos - Функция получения текущей позиции
 * @param {Function} setPos - Функция установки позиции
 * @param {Array} strategiesList - Список стратегий
 * @returns {Object} Распарсенная стратегия
 */
export const parseStrategyBlock = (lines, startIndex, getPos, setPos, strategiesList) => {
    const content = [];
    content.push(lines[startIndex]);
    let i = getPos();
    
    while (i < lines.length) {
        const l = lines[i];
        content.push(l);
        i++;
        if (l.toUpperCase().includes('##END_STRATEGY')) break;
    }
    
    setPos(i);
    return parseStrategyText(content.join('\n'), strategiesList);
};

/**
 * Парсинг содержимого папки
 * @param {Array} lines - Массив строк
 * @param {Function} getPos - Функция получения текущей позиции
 * @param {Function} setPos - Функция установки позиции
 * @param {Array} strategiesList - Список стратегий
 * @returns {Array} Массив элементов папки
 */
export const parseFolderContent = (lines, getPos, setPos, strategiesList) => {
    const items = [];
    
    while (getPos() < lines.length) {
        let line = lines[getPos()].trim();
        
        if (line.startsWith('#End_Folder')) {
            setPos(getPos() + 1);
            break;
        }
        
        setPos(getPos() + 1);
        
        if (line.startsWith('#Begin_Folder')) {
            const folderName = line.replace('#Begin_Folder', '').trim();
            const fObj = {
                type: 'folder',
                name: folderName || '(без имени)',
                children: parseFolderContent(lines, getPos, setPos, strategiesList)
            };
            items.push(fObj);
        } else if (line.toUpperCase().startsWith('##BEGIN_STRATEGY')) {
            const st = parseStrategyBlock(lines, getPos() - 1, getPos, setPos, strategiesList);
            items.push(st);
        }
    }
    
    return items;
};

/**
 * Главный парсер - парсинг всего текста
 * @param {string} bigText - Полный текст для парсинга
 * @returns {Object} Объект с деревом и списком стратегий
 */
export const parseAllData = (bigText) => {
    const lines = bigText.split(/\r?\n/);
    let i = 0;
    const root = [];
    const strategiesList = [];
    
    const getPos = () => i;
    const setPos = (val) => { i = val; };
    
    while (i < lines.length) {
        const line = lines[i].trim();
        i++;
        
        if (line.startsWith('#Begin_Folder')) {
            const folderName = line.replace('#Begin_Folder', '').trim();
            const folderObj = {
                type: 'folder',
                name: folderName || '(без имени)',
                children: parseFolderContent(lines, getPos, setPos, strategiesList)
            };
            root.push(folderObj);
        } else if (line.toUpperCase().startsWith('##BEGIN_STRATEGY')) {
            const st = parseStrategyBlock(lines, i - 1, getPos, setPos, strategiesList);
            root.push(st);
        }
    }
    
    return { tree: root, strategies: strategiesList };
};

/**
 * Сборка стратегий в текст для копирования
 * @param {Array} indexes - Индексы стратегий для копирования
 * @param {Array} allStrategies - Все стратегии
 * @returns {string} Текст стратегий
 */
export const buildStrategiesText = (indexes, allStrategies) => {
    if (!indexes.length) return '';
    
    let result = '';
    indexes.forEach(i => {
        const s = allStrategies[i];
        result += '##Begin_Strategy\n';
        result += s.originalLines.join('\n') + '\n';
        result += '##End_Strategy\n';
    });
    
    return result;
};



