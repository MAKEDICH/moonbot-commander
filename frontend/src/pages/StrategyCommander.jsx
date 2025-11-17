import React, { useState, useEffect, useRef } from 'react';
import { FiArrowLeft, FiCopy, FiTrash2, FiSave, FiUpload, FiX, FiCheck, FiAlertCircle, FiInfo } from 'react-icons/fi';
import styles from './StrategyCommander.module.css';

const StrategyCommander = ({ onClose }) => {
  const [parsedItems, setParsedItems] = useState([]);
  const [allParamNames, setAllParamNames] = useState([]);
  const [strategyInput, setStrategyInput] = useState('');
  const [selectedItem, setSelectedItem] = useState('none');
  const [selectedParam, setSelectedParam] = useState('ALL_PARAMS');
  const [commandPack, setCommandPack] = useState('');
  const [history, setHistory] = useState([]);
  
  // Загрузка с сервера
  const [servers, setServers] = useState([]);
  const [selectedServer, setSelectedServer] = useState(null);
  const [loadingStrategies, setLoadingStrategies] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, max: 0, message: '' });
  
  // Состояния для изменения размера столбцов
  const [columnWidths, setColumnWidths] = useState({});
  const resizingRef = useRef({ isResizing: false, colIndex: -1, startX: 0, startWidth: 0, thElement: null });

  // Toast уведомления
  const [toasts, setToasts] = useState([]);
  const [showConfirm, setShowConfirm] = useState(null);

  // Функции для Toast уведомлений
  const showToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const showConfirmDialog = (message, onConfirm) => {
    setShowConfirm({ message, onConfirm });
  };

  const handleConfirm = (confirmed) => {
    if (confirmed && showConfirm?.onConfirm) {
      showConfirm.onConfirm();
    }
    setShowConfirm(null);
  };

  // Загрузка истории из localStorage
  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    loadServers();
  }, []);

  const loadServers = async () => {
    try {
      const { serversAPI } = await import('../api/api');
      const response = await serversAPI.getAll();
      setServers(response.data.filter(s => s.is_active));
    } catch (error) {
      showToast('Ошибка загрузки серверов', 'error');
    }
  };

  const loadStrategiesFromServer = async (command) => {
    if (!selectedServer) {
      showToast('Выберите сервер!', 'warning');
      return;
    }
    
    setLoadingStrategies(true);
    setLoadingProgress({ current: 0, max: 30, message: 'Подготовка...' });
    
    try {
      const { commandsAPI } = await import('../api/api');
      const api = (await import('../api/api')).default;
      
      // Очищаем старый кэш перед запросом
      setLoadingProgress({ current: 1, max: 30, message: 'Очистка старого кэша...' });
      try {
        await api.delete(`/api/strategies/cache/${selectedServer}`);
      } catch (e) {
        console.warn('Не удалось очистить кэш:', e);
      }
      
      // Отправляем команду с увеличенным timeout
      setLoadingProgress({ current: 2, max: 30, message: 'Отправка команды на MoonBot...' });
      await commandsAPI.send({
        server_id: selectedServer,
        command: command,
        timeout: 30  // Увеличен timeout до 30 секунд
      });
      
      showToast('Команда отправлена, ожидаем стратегии...', 'info');
      setLoadingProgress({ current: 3, max: 30, message: 'Ожидание ответа от MoonBot...' });
      
      // Пытаемся получить стратегии несколько раз с задержкой
      let attempts = 0;
      const maxAttempts = 30;  // Увеличено до 30 попыток
      const delayMs = 1000;
      
      while (attempts < maxAttempts) {
        attempts++;
        
        // Обновляем прогресс
        setLoadingProgress({ 
          current: 3 + attempts, 
          max: 30 + maxAttempts, 
          message: `Проверка данных... (попытка ${attempts}/${maxAttempts})` 
        });
        
        // Ждём перед запросом
        await new Promise(resolve => setTimeout(resolve, delayMs));
        
        // Запрашиваем кэш (через api.js для автоматической авторизации)
        try {
          const response = await api.get(`/api/strategies/cache/${selectedServer}`);
          const cacheData = response.data;
          
          if (cacheData.packs && cacheData.packs.length > 0) {
            setLoadingProgress({ 
              current: 30 + maxAttempts, 
              max: 30 + maxAttempts, 
              message: `Обработка ${cacheData.packs.length} пакет(ов)...` 
            });
            
            const fullText = cacheData.packs
              .sort((a, b) => a.pack_number - b.pack_number)
              .map(pack => pack.data)
              .join('\n');
            
            setStrategyInput(fullText);
            showToast(`✅ Стратегии загружены! (${cacheData.packs.length} пакет(ов))`, 'success');
            setLoadingStrategies(false);
            setLoadingProgress({ current: 0, max: 0, message: '' });
            return;
          }
        } catch (error) {
          console.error('Ошибка загрузки кэша:', error);
          // Продолжаем попытки
        }
        
        // Если это не последняя попытка, показываем прогресс
        if (attempts < maxAttempts) {
          console.log(`Попытка ${attempts}/${maxAttempts}...`);
        }
      }
      
      // Если после всех попыток ничего не получили
      setLoadingProgress({ current: 0, max: 0, message: '' });
      showToast('⚠️ Стратегии не получены за 30 секунд. Проверьте связь с Moonbot.', 'warning');
    } catch (error) {
      setLoadingProgress({ current: 0, max: 0, message: '' });
      showToast('❌ Ошибка: ' + error.message, 'error');
      console.error('Ошибка загрузки стратегий:', error);
    } finally {
      setLoadingStrategies(false);
      setLoadingProgress({ current: 0, max: 0, message: '' });
    }
  };

  // Обработчики для изменения размера колонок
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (resizingRef.current.isResizing && resizingRef.current.thElement) {
        const newWidth = resizingRef.current.startWidth + (e.clientX - resizingRef.current.startX);
        if (newWidth > 50) { // Минимальная ширина 50px
          resizingRef.current.thElement.style.width = newWidth + 'px';
        }
      }
    };

    const handleMouseUp = () => {
      if (resizingRef.current.isResizing) {
        resizingRef.current.isResizing = false;
        resizingRef.current.thElement = null;
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleResizerMouseDown = (e, colIndex, thElement) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = {
      isResizing: true,
      colIndex: colIndex,
      startX: e.clientX,
      startWidth: thElement.offsetWidth,
      thElement: thElement
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const loadHistory = () => {
    const dataStr = localStorage.getItem('moonbotChangeHistory');
    if (dataStr) {
      try {
        const historyBlocks = JSON.parse(dataStr);
        if (Array.isArray(historyBlocks)) {
          setHistory(historyBlocks);
        }
      } catch (error) {
        console.error('Error loading history:', error);
      }
    }
  };

  const saveHistory = () => {
    const changes = getGlobalChangesPack();
    if (changes.length === 0) {
      showToast('Нет изменений для сохранения!', 'warning');
      return;
    }

    const historyBlocks = [...history];
    const now = new Date();
    const newBlock = {
      savedAt: now.toLocaleString('ru-RU', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }),
      changes: changes
    };
    historyBlocks.push(newBlock);
    localStorage.setItem('moonbotChangeHistory', JSON.stringify(historyBlocks));
    setHistory(historyBlocks);
    showToast('Изменения сохранены в историю!', 'success');
  };

  const removeCommandFromBlock = (blockIndex, cmdIndex) => {
    const historyBlocks = [...history];
    if (historyBlocks[blockIndex]) {
      historyBlocks[blockIndex].changes.splice(cmdIndex, 1);
      if (historyBlocks[blockIndex].changes.length === 0) {
        historyBlocks.splice(blockIndex, 1);
      }
      localStorage.setItem('moonbotChangeHistory', JSON.stringify(historyBlocks));
      setHistory(historyBlocks);
    }
  };

  const copyToClipboard = (text) => {
    // Fallback for non-HTTPS environments (production servers without SSL)
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    
    try {
      document.execCommand('copy');
      showToast('Скопировано в буфер обмена!', 'success');
    } catch (err) {
      showToast('Ошибка копирования', 'error');
    }
    
    document.body.removeChild(textarea);
  };

  const copyAllForward = (changes) => {
    const commands = changes.map(ch => ch.forward).join('\n');
    copyToClipboard(commands);
  };

  const copyAllRevert = (changes) => {
    const commands = changes.map(ch => ch.revert).join('\n');
    copyToClipboard(commands);
  };

  // Разбор всех стратегий
  const parseAll = () => {
    const text = strategyInput.trim();
    if (!text) {
      showToast('Пожалуйста, введите текст!', 'warning');
      return;
    }

    const items = [];
    const paramNames = [];
    const lines = text.split(/\r?\n/).map(l => l.trim());
    let currentFolder = null;
    let insideFolder = false;
    let insideStrategy = false;
    let currentStrategyLines = [];

    for (let line of lines) {
      if (!line) continue;

      if (line.startsWith('#Begin_Folder')) {
        if (insideStrategy && currentStrategyLines.length > 0) {
          const stgObj = parseSingleStrategy(currentStrategyLines, paramNames);
          pushStrategyToCorrectPlace(stgObj, currentFolder, items);
          currentStrategyLines = [];
          insideStrategy = false;
        }
        insideFolder = true;
        const folderName = line.replace('#Begin_Folder', '').trim();
        currentFolder = {
          type: 'folder',
          name: folderName,
          strategies: []
        };
        continue;
      }

      if (line.startsWith('#End_Folder')) {
        if (insideStrategy && currentStrategyLines.length > 0) {
          const stgObj = parseSingleStrategy(currentStrategyLines, paramNames);
          pushStrategyToCorrectPlace(stgObj, currentFolder, items);
          currentStrategyLines = [];
          insideStrategy = false;
        }
        if (currentFolder) {
          items.push(currentFolder);
        }
        currentFolder = null;
        insideFolder = false;
        continue;
      }

      if (line.startsWith('##Begin_Strategy')) {
        if (insideStrategy && currentStrategyLines.length > 0) {
          const stgObj = parseSingleStrategy(currentStrategyLines, paramNames);
          pushStrategyToCorrectPlace(stgObj, currentFolder, items);
          currentStrategyLines = [];
        }
        insideStrategy = true;
        currentStrategyLines = [];
        continue;
      }

      if (line.startsWith('##End_Strategy')) {
        if (insideStrategy) {
          const stgObj = parseSingleStrategy(currentStrategyLines, paramNames);
          pushStrategyToCorrectPlace(stgObj, currentFolder, items);
          currentStrategyLines = [];
        }
        insideStrategy = false;
        continue;
      }

      if (insideStrategy) {
        currentStrategyLines.push(line);
      }
    }

    if (insideStrategy && currentStrategyLines.length > 0) {
      const stgObj = parseSingleStrategy(currentStrategyLines, paramNames);
      pushStrategyToCorrectPlace(stgObj, currentFolder, items);
    }

    if (insideFolder && currentFolder) {
      items.push(currentFolder);
    }

    if (items.length === 0) {
      showToast('Не найдено ни одной папки или стратегии!', 'error');
      return;
    }

    setParsedItems(items);
    setAllParamNames(paramNames.sort());
    setCommandPack('');
    setSelectedItem('none');
    setSelectedParam('ALL_PARAMS');
  };

  const pushStrategyToCorrectPlace = (stgObj, folderObj, items) => {
    if (!stgObj) return;
    if (folderObj) {
      folderObj.strategies.push(stgObj);
    } else {
      items.push(stgObj);
    }
  };

  const parseSingleStrategy = (linesArr, paramNames) => {
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

  const buildSetParamCommand = (name, paramName, paramValue) => {
    const safeName = name ? `"${name}"` : `"UNDEFINED"`;
    return `SetParam ${safeName} ${paramName} ${paramValue}`;
  };

  const getGlobalChangesPack = () => {
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

  const updateCommandPackDisplay = () => {
    const changes = getGlobalChangesPack();
    const forwardCommands = changes.map(ch => ch.forward);
    setCommandPack(forwardCommands.join('\n'));
  };

  const clearCommands = () => {
    parsedItems.forEach(item => {
      if (item.type === 'folder') {
        item.strategies.forEach(stg => {
          stg.originalParams = { ...stg.params };
        });
      } else {
        item.originalParams = { ...item.params };
      }
    });
    setCommandPack('');
    setParsedItems([...parsedItems]); // trigger re-render
    showToast('Старые изменения сброшены, "Пак команд" очищен.', 'success');
  };

  const clearStrategyInput = () => {
    if (strategyInput.trim()) {
      showConfirmDialog('Вы уверены, что хотите очистить весь текст?', () => {
        setStrategyInput('');
        setParsedItems([]);
        setAllParamNames([]);
        setCommandPack('');
        setSelectedItem('none');
        setSelectedParam('ALL_PARAMS');
        showToast('Текст стратегий очищен', 'success');
      });
    }
  };

  const handleParamChange = (stgObj, paramName, newValue) => {
    stgObj.params[paramName] = newValue;
    setParsedItems([...parsedItems]); // trigger re-render
    updateCommandPackDisplay();
  };

  // Генерация опций для select
  const generateSelectOptions = () => {
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

  // Получение данных для отображения таблицы
  const getTableData = () => {
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

  const copyColumnData = (colIndex) => {
    const tableData = getTableData();
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

    const textToCopy = lines.join('\n');
    if (!textToCopy) {
      showToast('В этом столбце нет данных для копирования!', 'warning');
      return;
    }
    copyToClipboard(textToCopy);
  };

  const tableData = getTableData();

  return (
    <div className={styles.container}>
      {/* Toast уведомления */}
      <div className={styles.toastsContainer}>
        {toasts.map(toast => (
          <div key={toast.id} className={`${styles.toast} ${styles[toast.type]}`}>
            <div className={styles.toastIcon}>
              {toast.type === 'success' && <FiCheck />}
              {toast.type === 'error' && <FiX />}
              {toast.type === 'warning' && <FiAlertCircle />}
              {toast.type === 'info' && <FiInfo />}
            </div>
            <span>{toast.message}</span>
          </div>
        ))}
      </div>

      {/* Confirm Dialog */}
      {showConfirm && (
        <div className={styles.confirmOverlay} onClick={() => handleConfirm(false)}>
          <div className={styles.confirmDialog} onClick={(e) => e.stopPropagation()}>
            <div className={styles.confirmHeader}>
              <FiAlertCircle className={styles.confirmIcon} />
              <h3>Подтверждение</h3>
            </div>
            <div className={styles.confirmBody}>
              <p>{showConfirm.message}</p>
            </div>
            <div className={styles.confirmActions}>
              <button 
                className={styles.confirmCancel} 
                onClick={() => handleConfirm(false)}
              >
                Отмена
              </button>
              <button 
                className={styles.confirmOk} 
                onClick={() => handleConfirm(true)}
              >
                Подтвердить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Заголовок с кнопкой возврата */}
      <div className={styles.header}>
        <button className={styles.backButton} onClick={onClose}>
          <FiArrowLeft /> Вернуться к командам
        </button>
        <h1>MoonBot Commander Pro</h1>
      </div>

      {/* Ввод стратегий */}
      <div className={styles.inputSection}>
        <div className={styles.serverLoadSection}>
          <label>Загрузить стратегии с сервера:</label>
          <div className={styles.serverControls}>
            <select 
              value={selectedServer || ''} 
              onChange={(e) => setSelectedServer(parseInt(e.target.value))}
              className={styles.serverSelect}
              disabled={loadingStrategies}
            >
              <option value="">Выберите сервер...</option>
              {servers.map(server => (
                <option key={server.id} value={server.id}>
                  {server.name} ({server.host}:{server.port})
                </option>
              ))}
            </select>
            
            <button 
              onClick={() => loadStrategiesFromServer('GetStrategiesFull')}
              disabled={!selectedServer || loadingStrategies}
              className={styles.loadButton}
            >
              {loadingStrategies ? '⏳' : '📋'} Все стратегии
            </button>
            
            <button 
              onClick={() => loadStrategiesFromServer('GetStrategiesActive')}
              disabled={!selectedServer || loadingStrategies}
              className={styles.loadButton}
            >
              {loadingStrategies ? '⏳' : '✅'} Только активные
            </button>
          </div>
          
          {/* Индикатор прогресса загрузки */}
          {loadingStrategies && loadingProgress.max > 0 && (
            <div className={styles.loadingProgressContainer}>
              <div className={styles.loadingProgressBar}>
                <div 
                  className={styles.loadingProgressFill}
                  style={{ width: `${(loadingProgress.current / loadingProgress.max) * 100}%` }}
                />
              </div>
              <div className={styles.loadingProgressText}>
                {loadingProgress.message}
                <span className={styles.loadingProgressPercent}>
                  {Math.round((loadingProgress.current / loadingProgress.max) * 100)}%
                </span>
              </div>
            </div>
          )}
        </div>
        <label>Вставьте сюда текст стратегий:</label>
        <textarea
          className={styles.strategyInput}
          value={strategyInput}
          onChange={(e) => setStrategyInput(e.target.value)}
          placeholder="Вставьте сюда текст стратегий..."
        />
        <div className={styles.inputActions}>
          <button className={styles.parseButton} onClick={parseAll}>
            <FiUpload /> Разобрать
          </button>
          <button 
            className={styles.clearInputButton} 
            onClick={clearStrategyInput}
            disabled={!strategyInput.trim()}
            title="Очистить текст стратегий"
          >
            <FiX /> Очистить
          </button>
        </div>
      </div>

      {/* Селекторы */}
      {parsedItems.length > 0 && (
        <div className={styles.selectorsContainer}>
          <div className={styles.selectorGroup}>
            <label>Выбор папки/стратегии:</label>
            <select 
              value={selectedItem} 
              onChange={(e) => setSelectedItem(e.target.value)}
              className={styles.select}
            >
              {generateSelectOptions().map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          
          <div className={styles.selectorGroup}>
            <label>Параметр:</label>
            <select 
              value={selectedParam} 
              onChange={(e) => setSelectedParam(e.target.value)}
              className={styles.select}
            >
              <option value="ALL_PARAMS">Все параметры</option>
              {allParamNames.map(pName => (
                <option key={pName} value={pName}>{pName}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Таблица параметров */}
      {tableData.rows.length > 0 && (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                {tableData.headers.map((header, colIndex) => (
                  <th 
                    key={colIndex}
                    ref={(el) => {
                      if (el && !el.dataset.hasResizer) {
                        el.dataset.hasResizer = 'true';
                      }
                    }}
                  >
                    <div className={styles.thContent}>
                      <span>{header}</span>
                      <button 
                        type="button"
                        className={styles.copyIcon} 
                        onClick={() => copyColumnData(colIndex)}
                        title="Скопировать весь столбец"
                      >
                        <FiCopy />
                      </button>
                    </div>
                    <div 
                      className={styles.resizer}
                      onMouseDown={(e) => {
                        const th = e.currentTarget.parentElement;
                        handleResizerMouseDown(e, colIndex, th);
                      }}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.rows.map((row, rowIndex) => {
                const oldVal = row.stgObj.originalParams[row.paramName];
                const newVal = row.stgObj.params[row.paramName];
                const isChanged = oldVal !== newVal;
                const who = row.stgObj.commandTarget || row.stgObj.name;

                return (
                  <tr key={rowIndex} className={isChanged ? styles.changed : ''}>
                    {tableData.showStrategyColumn && (
                      <td>{row.strategyName}</td>
                    )}
                    <td>{row.paramName}</td>
                    <td>
                      <input
                        type="text"
                        value={newVal}
                        onChange={(e) => handleParamChange(row.stgObj, row.paramName, e.target.value)}
                        className={styles.editInput}
                      />
                    </td>
                    <td className={styles.changeColumn}>
                      {isChanged && `${oldVal} → ${newVal}`}
                    </td>
                    <td className={styles.command}>
                      {buildSetParamCommand(who, row.paramName, newVal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Пак команд */}
      {parsedItems.length > 0 && (
        <div className={styles.commandsContainer}>
          <h3>Пак команд (текущие изменения)</h3>
          <textarea
            className={styles.commandPackTextarea}
            value={commandPack}
            readOnly
          />
          <div className={styles.commandsActions}>
            <button 
              type="button"
              className={styles.copyBtn} 
              onClick={() => copyToClipboard(commandPack)}
              disabled={!commandPack}
            >
              <FiCopy /> Скопировать
            </button>
            <button 
              type="button"
              className={styles.clearBtn} 
              onClick={clearCommands}
              disabled={!commandPack}
            >
              <FiTrash2 /> Очистить
            </button>
            <button 
              type="button"
              className={styles.saveBtn} 
              onClick={saveHistory}
              disabled={!commandPack}
            >
              <FiSave /> Сохранить
            </button>
          </div>
        </div>
      )}

      {/* История */}
      <div className={styles.historyContainer}>
        <h3>История сохранённых команд</h3>
        {history.length === 0 ? (
          <div className={styles.noHistory}>История пуста</div>
        ) : (
          <div className={styles.historyBlocks}>
            {[...history].reverse().map((block, blockIndex) => {
              const actualIndex = history.length - 1 - blockIndex;
              return (
                <div key={actualIndex} className={styles.historyBlock}>
                  <div className={styles.historyHeader}>
                    <h4>Сохранено: {block.savedAt}</h4>
                    <div className={styles.historyHeaderButtons}>
                      <button 
                        type="button"
                        className={styles.copyBtn} 
                        onClick={() => copyAllForward(block.changes)}
                      >
                        <FiCopy /> Copy ALL Forward
                      </button>
                      <button 
                        type="button"
                        className={styles.copyBtn} 
                        onClick={() => copyAllRevert(block.changes)}
                      >
                        <FiCopy /> Copy ALL Revert
                      </button>
                    </div>
                  </div>

                  <ul className={styles.historyCommandsList}>
                    {block.changes.map((ch, cmdIndex) => (
                      <li key={cmdIndex} className={styles.historyCommand}>
                        <div className={styles.forwardContainer}>
                          <div className={styles.forwardLeft}>
                            <strong>{ch.forward}</strong>
                            <button 
                              type="button"
                              className={styles.copySmallBtn} 
                              onClick={() => copyToClipboard(ch.forward)}
                            >
                              Copy Forward
                            </button>
                          </div>
                          <button 
                            type="button"
                            className={styles.removeBtn} 
                            onClick={() => removeCommandFromBlock(actualIndex, cmdIndex)}
                          >
                            ✗
                          </button>
                        </div>
                        <div className={styles.leftActions}>
                          <span><em>Revert:</em> {ch.revert}</span>
                          <button 
                            type="button"
                            className={styles.copySmallBtn} 
                            onClick={() => copyToClipboard(ch.revert)}
                          >
                            Copy Revert
                          </button>
                          <span className={styles.changeInfo}>
                            ( {ch.paramName}: "{ch.oldVal}" =&gt; "{ch.newVal}" )
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default StrategyCommander;

