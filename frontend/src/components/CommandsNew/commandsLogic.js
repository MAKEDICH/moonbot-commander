import { serversAPI, commandsAPI, groupsAPI, quickCommandsAPI, presetsAPI, botCommandsAPI } from '../../api/api';
import { DEFAULT_QUICK_COMMANDS } from './constants';

/**
 * Загрузка данных с сервера
 */
export const useDataLoaders = (setState) => {
  const loadServers = async () => {
    try {
      const response = await serversAPI.getAll();
      const activeServers = response.data.filter(s => s.is_active);
      setState.setServers(activeServers);
    } catch (error) {
      console.error('Error loading servers:', error);
    }
  };

  const loadGroups = async () => {
    try {
      const response = await groupsAPI.getAll();
      setState.setGroups(response.data.groups || []);
    } catch (error) {
      console.error('Error loading groups:', error);
    }
  };

  const loadQuickCommands = async () => {
    try {
      // Сначала удаляем дубликаты если есть
      try {
        const dupResult = await quickCommandsAPI.removeDuplicates();
        if (dupResult.data.removed > 0) {
          console.log(`Removed ${dupResult.data.removed} duplicate quick commands`);
        }
      } catch (dupError) {
        console.error('Error removing duplicates:', dupError);
      }
      
      const response = await quickCommandsAPI.getAll();
      const userCommands = response.data;
      
      if (userCommands.length === 0) {
        await createDefaultCommands();
        const newResponse = await quickCommandsAPI.getAll();
        setState.setQuickCommands(newResponse.data);
      } else {
        setState.setQuickCommands(userCommands);
      }
    } catch (error) {
      console.error('Error loading quick commands:', error);
    }
  };

  const createDefaultCommands = async () => {
    try {
      for (let i = 0; i < DEFAULT_QUICK_COMMANDS.length; i++) {
        const cmd = DEFAULT_QUICK_COMMANDS[i];
        try {
          await quickCommandsAPI.create({
            label: cmd.label,
            command: cmd.command,
            order: i
          });
        } catch (error) {
          if (!error.response?.status === 400) {
            console.error(`Error creating command ${cmd.label}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Error creating default commands:', error);
    }
  };

  const loadPresets = async () => {
    try {
      const response = await presetsAPI.getAll();
      setState.setPresets(response.data);
    } catch (error) {
      console.error('Error loading presets:', error);
    }
  };

  const loadBotCommands = async () => {
    try {
      const response = await botCommandsAPI.getAll();
      setState.setBotCommands(response.data);
    } catch (error) {
      console.error('Error loading bot commands:', error);
    }
  };

  return {
    loadServers,
    loadGroups,
    loadQuickCommands,
    loadPresets,
    loadBotCommands
  };
};

/**
 * CRUD операции для быстрых команд
 */
export const useQuickCommandsCrud = (setState, loaders) => {
  const handleAddQuickCommand = async (newQuickCmd) => {
    if (!newQuickCmd.label || !newQuickCmd.command) return;

    try {
      await quickCommandsAPI.create(newQuickCmd);
      await loaders.loadQuickCommands();
      setState.setNewQuickCmd({ label: '', command: '' });
      setState.setShowAddQuickCmd(false);
    } catch (error) {
      console.error('Ошибка добавления команды:', error);
    }
  };

  const handleUpdateQuickCommand = async (editingQuickCmd) => {
    if (!editingQuickCmd || !editingQuickCmd.label || !editingQuickCmd.command) return;
    
    try {
      await quickCommandsAPI.update(editingQuickCmd.id, {
        label: editingQuickCmd.label,
        command: editingQuickCmd.command
      });
      await loaders.loadQuickCommands();
      setState.setEditingQuickCmd(null);
      setState.setShowCommandSuggestions(false);
    } catch (error) {
      console.error('Ошибка обновления команды:', error);
    }
  };

  const handleDeleteQuickCommand = async (id) => {
    try {
      await quickCommandsAPI.delete(id);
      await loaders.loadQuickCommands();
    } catch (error) {
      console.error('Ошибка удаления команды:', error);
    }
  };

  return {
    handleAddQuickCommand,
    handleUpdateQuickCommand,
    handleDeleteQuickCommand
  };
};

/**
 * CRUD операции для пресетов
 */
export const usePresetsCrud = (setState, loaders, warning) => {
  const handleSavePreset = async (newPresetName, commands, presets) => {
    if (!newPresetName.trim() || !commands.trim()) return;

    try {
      const usedNumbers = presets.map(p => p.button_number).filter(n => n !== null);
      const nextNumber = usedNumbers.length > 0 ? Math.max(...usedNumbers) + 1 : 1;
      
      if (nextNumber > 50) {
        warning('Достигнут максимум кнопок (50). Удалите или измените номер существующей кнопки.');
        return;
      }
      
      await presetsAPI.create({
        name: newPresetName,
        commands: commands,
        button_number: nextNumber
      });
      
      await loaders.loadPresets();
      setState.setNewPresetName('');
    } catch (error) {
      console.error('Ошибка сохранения пресета:', error);
    }
  };

  const handleUpdatePreset = async (id, data) => {
    try {
      await presetsAPI.update(id, data);
      await loaders.loadPresets();
      setState.setEditingPreset(null);
    } catch (error) {
      console.error('Ошибка обновления пресета:', error);
    }
  };

  const handleDeletePreset = async (id) => {
    try {
      await presetsAPI.delete(id);
      await loaders.loadPresets();
    } catch (error) {
      console.error('Ошибка удаления пресета:', error);
    }
  };

  return {
    handleSavePreset,
    handleUpdatePreset,
    handleDeletePreset
  };
};

/**
 * Отправка команд на сервер
 */
export const useCommandSender = (setState, warning) => {
  const handleSendCommand = async (e, state) => {
    e.preventDefault();
    const { selectedServers, commands, servers, delayBetweenBots, useBotname, timeout, clearAfterSend } = state;
    
    if (selectedServers.length === 0 || !commands.trim()) return;

    setState.setLoading(true);
    setState.setResponse(null);

    try {
      const commandList = commands.split('\n')
        .map(cmd => cmd.trim())
        .filter(cmd => cmd.length > 0);

      if (commandList.length === 0) {
        throw new Error('Нет команд для отправки');
      }

      const selectedServersData = servers.filter(s => selectedServers.includes(s.id));
      const allResults = [];
      let totalSuccess = 0;
      let totalFailed = 0;

      for (let serverIndex = 0; serverIndex < selectedServersData.length; serverIndex++) {
        const server = selectedServersData[serverIndex];
        
        if (serverIndex > 0 && delayBetweenBots > 0) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenBots * 1000));
        }

        for (const cmd of commandList) {
          try {
            let finalCommand = cmd;
            if (useBotname && server.name) {
              finalCommand = `botname:${server.name} ${cmd}`;
            }

            const result = await commandsAPI.send({
              server_id: server.id,
              command: finalCommand,
              timeout: timeout
            });

            allResults.push({
              server_name: server.name,
              command: finalCommand,
              status: 'success',
              response: result.data.response
            });
            totalSuccess++;
          } catch (error) {
            allResults.push({
              server_name: server.name,
              command: useBotname ? `botname:${server.name} ${cmd}` : cmd,
              status: 'error',
              response: error.response?.data?.detail || 'Ошибка отправки'
            });
            totalFailed++;
          }
        }
      }

      setState.setResponse({
        status: 'success',
        results: allResults,
        summary: {
          successful: totalSuccess,
          failed: totalFailed,
          total: allResults.length,
          servers: selectedServersData.length,
          commands: commandList.length
        },
        time: new Date().toLocaleString('ru-RU'),
        bulk: true
      });
      
      if (clearAfterSend) {
        setState.setCommands('');
      }
      
    } catch (error) {
      setState.setResponse({
        status: 'error',
        text: error.message || error.response?.data?.detail || 'Ошибка отправки команд',
        time: new Date().toLocaleString('ru-RU')
      });
    } finally {
      setState.setLoading(false);
    }
  };

  const handleQuickSend = async (command, state) => {
    const { selectedServers, servers, delayBetweenBots, useBotname, timeout } = state;
    
    if (selectedServers.length === 0) {
      warning('Выберите хотя бы один сервер');
      return;
    }

    setState.setLoading(true);
    setState.setResponse(null);
    
    try {
      const selectedServersData = servers.filter(s => selectedServers.includes(s.id));
      const allResults = [];
      
      for (let serverIndex = 0; serverIndex < selectedServersData.length; serverIndex++) {
        const server = selectedServersData[serverIndex];
        
        if (serverIndex > 0 && delayBetweenBots > 0) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenBots * 1000));
        }

        let finalCommand = command;
        if (useBotname && server.name) {
          finalCommand = `botname:${server.name} ${command}`;
        }

        try {
          const result = await commandsAPI.send({
            server_id: server.id,
            command: finalCommand,
            timeout: timeout
          });

          allResults.push({
            server_name: server.name,
            command: finalCommand,
            status: 'success',
            response: result.data.response
          });
        } catch (error) {
          allResults.push({
            server_name: server.name,
            command: finalCommand,
            status: 'error',
            response: error.response?.data?.detail || 'Ошибка отправки'
          });
        }
      }
      
      let responseText = '';
      let successCount = allResults.filter(r => r.status === 'success').length;
      let errorCount = allResults.filter(r => r.status === 'error').length;
      
      responseText += `✅ Успешно: ${successCount} | ❌ Ошибок: ${errorCount}\n\n`;
      
      allResults.forEach(result => {
        const statusIcon = result.status === 'success' ? '✅' : '❌';
        responseText += `${statusIcon} [${result.server_name}] ${result.command}\n`;
        responseText += `${result.response}\n\n`;
      });
      
      setState.setResponse({
        status: errorCount === 0 ? 'success' : (successCount === 0 ? 'error' : 'partial'),
        text: responseText.trim(),
        time: new Date().toLocaleString('ru-RU')
      });
      
    } catch (error) {
      setState.setResponse({
        status: 'error',
        text: error.message || 'Ошибка отправки команды',
        time: new Date().toLocaleString('ru-RU')
      });
    } finally {
      setState.setLoading(false);
    }
  };

  return {
    handleSendCommand,
    handleQuickSend
  };
};





