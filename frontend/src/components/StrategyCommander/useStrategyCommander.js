import { useState, useEffect, useRef } from 'react';
import { 
  parseSingleStrategy, 
  pushStrategyToCorrectPlace, 
  getGlobalChangesPack 
} from './strategyUtils';
import { loadStrategiesFromServer, sendCommandsToServers } from './strategyCommanderApi';

const useStrategyCommander = () => {
  const [parsedItems, setParsedItems] = useState([]);
  const [allParamNames, setAllParamNames] = useState([]);
  const [strategyInput, setStrategyInput] = useState('');
  const [selectedItem, setSelectedItem] = useState('none');
  const [selectedParam, setSelectedParam] = useState('ALL_PARAMS');
  const [commandPack, setCommandPack] = useState('');
  const [history, setHistory] = useState([]);
  
  const [servers, setServers] = useState([]);
  const [selectedServer, setSelectedServer] = useState(null);
  const [loadingStrategies, setLoadingStrategies] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, max: 0, message: '' });
  
  // Состояние для отправки команд
  const [selectedSendServers, setSelectedSendServers] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);
  
  const [columnWidths, setColumnWidths] = useState({});
  const resizingRef = useRef({ isResizing: false, colIndex: -1, startX: 0, startWidth: 0, thElement: null });

  const [toasts, setToasts] = useState([]);
  const [showConfirm, setShowConfirm] = useState(null);

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

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    loadServers();
  }, []);

  const loadServers = async () => {
    try {
      const { serversAPI } = await import('../../api/api');
      const response = await serversAPI.getAll();
      setServers(response.data.filter(s => s.is_active));
    } catch (error) {
      showToast('Ошибка загрузки серверов', 'error');
    }
  };

  const handleLoadStrategies = async (command) => {
    await loadStrategiesFromServer(
      selectedServer,
      command,
      setLoadingStrategies,
      setLoadingProgress,
      setStrategyInput,
      showToast
    );
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
    const changes = getGlobalChangesPack(parsedItems);
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

    // Подсчёт количества стратегий
    let totalStrategies = 0;
    let foldersCount = 0;
    let standaloneStrategies = 0;
    
    items.forEach(item => {
      if (item.type === 'folder') {
        foldersCount++;
        totalStrategies += item.strategies.length;
      } else {
        standaloneStrategies++;
        totalStrategies++;
      }
    });

    setParsedItems(items);
    setAllParamNames(paramNames.sort());
    setCommandPack('');
    setSelectedItem('none');
    setSelectedParam('ALL_PARAMS');
    
    let message = `✅ Загружено ${totalStrategies} стратегий`;
    if (foldersCount > 0) {
      message += ` в ${foldersCount} папках`;
    }
    if (standaloneStrategies > 0) {
      message += foldersCount > 0 ? ` + ${standaloneStrategies} без папки` : '';
    }
    showToast(message, 'success');
  };

  const updateCommandPackDisplay = () => {
    const changes = getGlobalChangesPack(parsedItems);
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
    setParsedItems([...parsedItems]);
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
    setParsedItems([...parsedItems]);
    updateCommandPackDisplay();
  };

  const sendCommands = async () => {
    await sendCommandsToServers(
      commandPack,
      selectedSendServers,
      servers,
      setIsSending,
      setSendResult,
      showToast
    );
  };

  return {
    parsedItems,
    allParamNames,
    strategyInput,
    setStrategyInput,
    selectedItem,
    setSelectedItem,
    selectedParam,
    setSelectedParam,
    commandPack,
    history,
    servers,
    selectedServer,
    setSelectedServer,
    loadingStrategies,
    loadingProgress,
    columnWidths,
    resizingRef,
    toasts,
    showConfirm,
    showToast,
    handleConfirm,
    loadStrategiesFromServer: handleLoadStrategies,
    saveHistory,
    removeCommandFromBlock,
    copyToClipboard,
    parseAll,
    clearCommands,
    clearStrategyInput,
    handleParamChange,
    selectedSendServers,
    setSelectedSendServers,
    isSending,
    sendResult,
    sendCommands
  };
};

export default useStrategyCommander;
