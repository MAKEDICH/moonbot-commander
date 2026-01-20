/**
 * API функции для Strategy Commander.
 * 
 * Содержит функции для:
 * - Загрузки стратегий с сервера
 * - Отправки команд на серверы
 */

/**
 * Загрузить стратегии с выбранного сервера
 * 
 * @param {number} selectedServer - ID сервера
 * @param {string} command - Команда для загрузки стратегий
 * @param {function} setLoadingStrategies - Setter для состояния загрузки
 * @param {function} setLoadingProgress - Setter для прогресса загрузки
 * @param {function} setStrategyInput - Setter для текста стратегий
 * @param {function} showToast - Функция показа уведомлений
 */
export const loadStrategiesFromServer = async (
  selectedServer,
  command,
  setLoadingStrategies,
  setLoadingProgress,
  setStrategyInput,
  showToast
) => {
  if (!selectedServer) {
    showToast('Выберите сервер!', 'warning');
    return;
  }
  
  setLoadingStrategies(true);
  setLoadingProgress({ current: 0, max: 30, message: 'Подготовка...' });
  
  try {
    const { commandsAPI } = await import('../../api/api');
    const api = (await import('../../api/api')).default;
    
    setLoadingProgress({ current: 1, max: 30, message: 'Очистка старого кэша...' });
    try {
      await api.delete(`/api/strategies/cache/${selectedServer}`);
    } catch (e) {
      console.warn('Не удалось очистить кэш:', e);
    }
    
    setLoadingProgress({ current: 2, max: 30, message: 'Отправка команды на MoonBot...' });
    await commandsAPI.send({
      server_id: selectedServer,
      command: command,
      timeout: 30
    });
    
    showToast('Команда отправлена, ожидаем стратегии...', 'info');
    setLoadingProgress({ current: 3, max: 30, message: 'Ожидание ответа от MoonBot...' });
    
    let attempts = 0;
    const maxAttempts = 45;
    const delayMs = 1000;
    let lastPackCount = 0;
    let stableCount = 0;
    const stableThreshold = 3;
    
    while (attempts < maxAttempts) {
      attempts++;
      
      setLoadingProgress({ 
        current: 3 + attempts, 
        max: 30 + maxAttempts, 
        message: `Проверка данных... (попытка ${attempts}/${maxAttempts})` 
      });
      
      await new Promise(resolve => setTimeout(resolve, delayMs));
      
      try {
        const response = await api.get(`/api/strategies/cache/${selectedServer}`);
        const cacheData = response.data;
        
        if (cacheData.packs && cacheData.packs.length > 0) {
          const currentPackCount = cacheData.packs.length;
          
          if (currentPackCount === lastPackCount) {
            stableCount++;
            setLoadingProgress({ 
              current: 3 + attempts, 
              max: 30 + maxAttempts, 
              message: `Получено ${currentPackCount} пакет(ов), проверка завершённости... (${stableCount}/${stableThreshold})` 
            });
          } else {
            stableCount = 0;
            lastPackCount = currentPackCount;
            setLoadingProgress({ 
              current: 3 + attempts, 
              max: 30 + maxAttempts, 
              message: `Получено ${currentPackCount} пакет(ов), ожидаем ещё...` 
            });
          }
          
          if (stableCount >= stableThreshold) {
            setLoadingProgress({ 
              current: 30 + maxAttempts, 
              max: 30 + maxAttempts, 
              message: `Обработка ${currentPackCount} пакет(ов)...` 
            });
            
            const fullText = cacheData.packs
              .sort((a, b) => a.pack_number - b.pack_number)
              .map(pack => pack.data)
              .join('\n');
            
            setStrategyInput(fullText);
            showToast(`✅ Стратегии загружены! (${currentPackCount} пакет(ов))`, 'success');
            setLoadingStrategies(false);
            setLoadingProgress({ current: 0, max: 0, message: '' });
            return;
          }
        }
      } catch (error) {
        console.error('Ошибка загрузки кэша:', error);
      }
      
      if (attempts < maxAttempts) {
        console.log(`Попытка ${attempts}/${maxAttempts}, пакетов: ${lastPackCount}, стабильность: ${stableCount}/${stableThreshold}`);
      }
    }
    
    // Если после всех попыток есть хоть какие-то пакеты - загружаем их
    if (lastPackCount > 0) {
      try {
        const response = await api.get(`/api/strategies/cache/${selectedServer}`);
        const cacheData = response.data;
        if (cacheData.packs && cacheData.packs.length > 0) {
          const fullText = cacheData.packs
            .sort((a, b) => a.pack_number - b.pack_number)
            .map(pack => pack.data)
            .join('\n');
          
          setStrategyInput(fullText);
          showToast(`⚠️ Загружено ${cacheData.packs.length} пакет(ов). Возможно не все стратегии получены.`, 'warning');
          setLoadingStrategies(false);
          setLoadingProgress({ current: 0, max: 0, message: '' });
          return;
        }
      } catch (error) {
        console.error('Финальная ошибка загрузки:', error);
      }
    }
    
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


/**
 * Отправить команды на выбранные серверы
 * 
 * @param {string} commandPack - Пакет команд для отправки
 * @param {number[]} selectedSendServers - Массив ID выбранных серверов
 * @param {object[]} servers - Массив всех серверов
 * @param {function} setIsSending - Setter для состояния отправки
 * @param {function} setSendResult - Setter для результата отправки
 * @param {function} showToast - Функция показа уведомлений
 */
export const sendCommandsToServers = async (
  commandPack,
  selectedSendServers,
  servers,
  setIsSending,
  setSendResult,
  showToast
) => {
  if (!commandPack || selectedSendServers.length === 0) {
    showToast('Выберите серверы и убедитесь, что есть команды для отправки', 'warning');
    return;
  }

  setIsSending(true);
  setSendResult(null);

  try {
    const { commandsAPI } = await import('../../api/api');
    
    const commandList = commandPack.split('\n')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0);

    if (commandList.length === 0) {
      throw new Error('Нет команд для отправки');
    }

    const selectedServersData = servers.filter(s => selectedSendServers.includes(s.id));
    
    let totalSuccess = 0;
    let totalFailed = 0;
    const allResults = [];

    for (const server of selectedServersData) {
      for (const cmd of commandList) {
        try {
          const result = await commandsAPI.send({
            server_id: server.id,
            command: cmd,
            timeout: 10
          });

          allResults.push({
            server_name: server.name,
            command: cmd,
            status: 'success',
            response: result.data.response
          });
          totalSuccess++;
        } catch (error) {
          allResults.push({
            server_name: server.name,
            command: cmd,
            status: 'error',
            response: error.response?.data?.detail || 'Ошибка отправки'
          });
          totalFailed++;
        }
      }
    }

    setSendResult({
      status: totalFailed === 0 ? 'success' : 'partial',
      results: allResults,
      summary: {
        successful: totalSuccess,
        failed: totalFailed,
        total: allResults.length,
        servers: selectedServersData.length,
        commands: commandList.length
      },
      time: new Date().toLocaleString('ru-RU')
    });

    if (totalFailed === 0) {
      showToast(`✅ Все команды успешно отправлены на ${selectedServersData.length} сервер(ов)!`, 'success');
    } else if (totalSuccess > 0) {
      showToast(`⚠️ Отправлено ${totalSuccess} команд, ошибок: ${totalFailed}`, 'warning');
    } else {
      showToast('❌ Все команды завершились с ошибкой', 'error');
    }

  } catch (error) {
    setSendResult({
      status: 'error',
      message: error.message || 'Неизвестная ошибка'
    });
    showToast('❌ Ошибка: ' + error.message, 'error');
  } finally {
    setIsSending(false);
  }
};


