// Парсинг одной стратегии из строк
export const parseSingleStrategy = (linesArr, paramNames) => {
  const params = {};
  let strategyName = '';
  
  linesArr.forEach(line => {
    if (!line || line.startsWith('//')) return;
    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) return;
    const paramName = line.substring(0, eqIndex).trim();
    const paramValue = line.substring(eqIndex + 1).trim();
    params[paramName] = paramValue;
    if (paramName === 'StrategyName') {
      strategyName = paramValue;
    }
    if (!paramNames.includes(paramName)) {
      paramNames.push(paramName);
    }
  });

  return {
    type: 'strategy',
    name: strategyName,
    params: { ...params },
    originalParams: { ...params },
    commandTarget: ''
  };
};

// Добавление стратегии в нужное место
export const pushStrategyToCorrectPlace = (stgObj, folderObj, items) => {
  if (!stgObj) return;
  if (folderObj) {
    folderObj.strategies.push(stgObj);
  } else {
    items.push(stgObj);
  }
};

// Построение команды SetParam
export const buildSetParamCommand = (name, paramName, paramValue) => {
  const safeName = name ? `"${name}"` : `"UNDEFINED"`;
  return `SetParam ${safeName} ${paramName} ${paramValue}`;
};

// Получение всех изменений
export const getGlobalChangesPack = (parsedItems) => {
  const changes = [];
  parsedItems.forEach(item => {
    if (item.type === 'folder') {
      item.strategies.forEach(stg => {
        Object.keys(stg.params).forEach(paramName => {
          const newVal = stg.params[paramName];
          const oldVal = stg.originalParams[paramName];
          if (newVal !== oldVal) {
            const who = stg.commandTarget || stg.name;
            changes.push({
              forward: buildSetParamCommand(who, paramName, newVal),
              revert: buildSetParamCommand(who, paramName, oldVal),
              oldVal: oldVal,
              newVal: newVal,
              paramName: paramName,
              target: who
            });
          }
        });
      });
    } else {
      Object.keys(item.params).forEach(paramName => {
        const newVal = item.params[paramName];
        const oldVal = item.originalParams[paramName];
        if (newVal !== oldVal) {
          const who = item.commandTarget || item.name;
          changes.push({
            forward: buildSetParamCommand(who, paramName, newVal),
            revert: buildSetParamCommand(who, paramName, oldVal),
            oldVal: oldVal,
            newVal: newVal,
            paramName: paramName,
            target: who
          });
        }
      });
    }
  });
  return changes;
};

// Генерация опций для выбора стратегий
export const generateSelectOptions = (parsedItems) => {
  const options = [{ value: 'none', label: 'Не указано (все стратегии)' }];
  
  parsedItems.forEach((item, fIndex) => {
    if (item.type === 'folder') {
      options.push({ value: `f:${fIndex}`, label: `Папка: ${item.name}` });
      item.strategies.forEach((stg, sIndex) => {
        options.push({ value: `f:${fIndex},s:${sIndex}`, label: `   Стратегия: ${stg.name}` });
      });
    } else {
      options.push({ value: `t:${fIndex}`, label: `Стратегия: ${item.name || "NoName"}` });
    }
  });
  
  return options;
};

// Получение данных для таблицы
export const getTableData = (parsedItems, selectedItem, selectedParam) => {
  if (parsedItems.length === 0) return { headers: [], rows: [], showStrategyColumn: false };

  const selectVal = selectedItem;
  const paramVal = selectedParam;

  if (selectVal === 'none') {
    // Все стратегии
    const rows = [];
    parsedItems.forEach(item => {
      if (item.type === 'folder') {
        item.strategies.forEach(stg => {
          Object.keys(stg.params).forEach(paramName => {
            if (paramVal !== 'ALL_PARAMS' && paramName !== paramVal) return;
            const who = item.name;
            stg.commandTarget = who;
            rows.push({
              strategyName: stg.name,
              paramName,
              stgObj: stg,
              isFolder: false
            });
          });
        });
      } else {
        Object.keys(item.params).forEach(paramName => {
          if (paramVal !== 'ALL_PARAMS' && paramName !== paramVal) return;
          const who = item.name;
          item.commandTarget = who;
          rows.push({
            strategyName: item.name,
            paramName,
            stgObj: item,
            isFolder: false
          });
        });
      }
    });
    return { 
      headers: ['Стратегия', 'Параметр', 'Значение', 'Изменение', 'Команда (SetParam)'], 
      rows,
      showStrategyColumn: true
    };
  } else if (selectVal.startsWith('f:') && !selectVal.includes(',')) {
    // Папка
    const folderIndex = parseInt(selectVal.replace('f:', ''));
    const folder = parsedItems[folderIndex];
    if (!folder || folder.type !== 'folder') return { headers: [], rows: [], showStrategyColumn: false };

    const rows = [];
    folder.strategies.forEach(stg => {
      Object.keys(stg.params).forEach(paramName => {
        if (paramVal !== 'ALL_PARAMS' && paramName !== paramVal) return;
        const who = folder.name;
        stg.commandTarget = who;
        rows.push({
          strategyName: stg.name,
          paramName,
          stgObj: stg,
          isFolder: true
        });
      });
    });
    return { 
      headers: ['Стратегия (в папке)', 'Параметр', 'Значение', 'Изменение', 'Команда (SetParam)'], 
      rows,
      showStrategyColumn: true
    };
  } else if (selectVal.startsWith('f:') && selectVal.includes(',s:')) {
    // Стратегия в папке
    const parts = selectVal.split(',');
    const folderIndex = parseInt(parts[0].replace('f:', ''));
    const strategyIndex = parseInt(parts[1].replace('s:', ''));
    const folder = parsedItems[folderIndex];
    if (!folder || folder.type !== 'folder') return { headers: [], rows: [], showStrategyColumn: false };
    const stg = folder.strategies[strategyIndex];
    if (!stg) return { headers: [], rows: [], showStrategyColumn: false };

    const rows = [];
    Object.keys(stg.params).forEach(paramName => {
      if (paramVal !== 'ALL_PARAMS' && paramName !== paramVal) return;
      const who = folder.name;
      stg.commandTarget = who;
      rows.push({
        paramName,
        stgObj: stg,
        isFolder: false
      });
    });
    return { 
      headers: ['Параметр', 'Значение', 'Изменение', 'Команда (SetParam)'], 
      rows,
      showStrategyColumn: false
    };
  } else if (selectVal.startsWith('t:')) {
    // Отдельная стратегия
    const topIndex = parseInt(selectVal.replace('t:', ''));
    const stg = parsedItems[topIndex];
    if (!stg || stg.type !== 'strategy') return { headers: [], rows: [], showStrategyColumn: false };

    const rows = [];
    Object.keys(stg.params).forEach(paramName => {
      if (paramVal !== 'ALL_PARAMS' && paramName !== paramVal) return;
      const who = stg.name;
      stg.commandTarget = who;
      rows.push({
        paramName,
        stgObj: stg,
        isFolder: false
      });
    });
    return { 
      headers: ['Параметр', 'Значение', 'Изменение', 'Команда (SetParam)'], 
      rows,
      showStrategyColumn: false
    };
  }

  return { headers: [], rows: [], showStrategyColumn: false };
};

// Копирование данных столбца
export const copyColumnData = (colIndex, tableData, buildSetParamCommand) => {
  const lines = [];
  
  tableData.rows.forEach(row => {
    let value = '';
    if (tableData.showStrategyColumn) {
      switch (colIndex) {
        case 0: value = row.strategyName; break;
        case 1: value = row.paramName; break;
        case 2: value = row.stgObj.params[row.paramName]; break;
        case 3: 
          const oldVal = row.stgObj.originalParams[row.paramName];
          const newVal = row.stgObj.params[row.paramName];
          value = oldVal !== newVal ? `${oldVal} → ${newVal}` : '';
          break;
        case 4: 
          const who = row.stgObj.commandTarget || row.stgObj.name;
          value = buildSetParamCommand(who, row.paramName, row.stgObj.params[row.paramName]);
          break;
      }
    } else {
      switch (colIndex) {
        case 0: value = row.paramName; break;
        case 1: value = row.stgObj.params[row.paramName]; break;
        case 2: 
          const oldVal = row.stgObj.originalParams[row.paramName];
          const newVal = row.stgObj.params[row.paramName];
          value = oldVal !== newVal ? `${oldVal} → ${newVal}` : '';
          break;
        case 3: 
          const who = row.stgObj.commandTarget || row.stgObj.name;
          value = buildSetParamCommand(who, row.paramName, row.stgObj.params[row.paramName]);
          break;
      }
    }
    lines.push(value);
  });

  return lines.join('\n');
};



