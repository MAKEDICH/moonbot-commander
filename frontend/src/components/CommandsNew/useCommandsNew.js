import { useState, useEffect } from 'react';
import { useNotification } from '../../context/NotificationContext';
import { useDataLoaders, useQuickCommandsCrud, usePresetsCrud, useCommandSender } from './commandsLogic';

/**
 * Кастомный хук для бизнес-логики CommandsNew
 */
export const useCommandsNew = () => {
  const { warning } = useNotification();
  
  // Серверы и группы
  const [servers, setServers] = useState([]);
  const [selectedServers, setSelectedServers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('all');

  // Команды
  const [commands, setCommands] = useState('');
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [timeout, setTimeout] = useState(5);
  const [delayBetweenBots, setDelayBetweenBots] = useState(0);
  const [useBotname, setUseBotname] = useState(false);
  const [clearAfterSend, setClearAfterSend] = useState(false);

  // Быстрые команды
  const [quickCommands, setQuickCommands] = useState([]);
  const [showAddQuickCmd, setShowAddQuickCmd] = useState(false);
  const [newQuickCmd, setNewQuickCmd] = useState({ label: '', command: '' });
  const [editingQuickCmd, setEditingQuickCmd] = useState(null);

  // Пресеты
  const [presets, setPresets] = useState([]);
  const [showPresetManager, setShowPresetManager] = useState(false);
  const [editingPreset, setEditingPreset] = useState(null);
  const [newPresetName, setNewPresetName] = useState('');
  const [presetValidationError, setPresetValidationError] = useState('');
  const [showPresetHint, setShowPresetHint] = useState(false);

  // Справочник команд
  const [botCommands, setBotCommands] = useState([]);
  const [showCommandsReference, setShowCommandsReference] = useState(false);
  const [commandsFilter, setCommandsFilter] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedCommandsFromReference, setSelectedCommandsFromReference] = useState([]);

  // Конструктор команд
  const [selectedConstructor, setSelectedConstructor] = useState(null);
  const [constructorValues, setConstructorValues] = useState({});
  const [showParamAutocomplete, setShowParamAutocomplete] = useState(false);
  const [filteredParams, setFilteredParams] = useState([]);

  // Автоподстановка команд
  const [commandSuggestions, setCommandSuggestions] = useState([]);
  const [showCommandSuggestions, setShowCommandSuggestions] = useState(false);
  const [activeSuggestionField, setActiveSuggestionField] = useState(null);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);

  // Инициализация загрузчиков данных
  const setState = {
    setServers, setGroups, setQuickCommands, setPresets, setBotCommands,
    setNewQuickCmd, setShowAddQuickCmd, setEditingQuickCmd, setShowCommandSuggestions,
    setNewPresetName, setEditingPreset, setLoading, setResponse, setCommands
  };

  const loaders = useDataLoaders(setState);
  const quickCommandsCrud = useQuickCommandsCrud(setState, loaders);
  const presetsCrud = usePresetsCrud(setState, loaders, warning);
  const commandSender = useCommandSender(setState, warning);

  useEffect(() => {
    loaders.loadServers();
    loaders.loadGroups();
    loaders.loadQuickCommands();
    loaders.loadPresets();
    loaders.loadBotCommands();
    
    const savedClearAfterSend = localStorage.getItem('clearAfterSend');
    if (savedClearAfterSend !== null) {
      setClearAfterSend(savedClearAfterSend === 'true');
    }
  }, []);

  useEffect(() => {
    if (!showParamAutocomplete && !showCommandSuggestions) {
      return;
    }

    const handleClickOutside = (e) => {
      if (showParamAutocomplete && !e.target.closest('.autocompleteWrapper')) {
        setShowParamAutocomplete(false);
      }
      if (showCommandSuggestions && !e.target.closest('input') && !e.target.closest('.suggestionsDropdown')) {
        setShowCommandSuggestions(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showParamAutocomplete, showCommandSuggestions]);

  // === Автоподстановка команд ===
  const handleCommandInput = (value, field) => {
    if (field === 'new') {
      setNewQuickCmd({...newQuickCmd, command: value});
    } else if (field === 'edit') {
      setEditingQuickCmd({...editingQuickCmd, command: value});
    }

    if (value.length > 0) {
      const filtered = botCommands
        .filter(cmd => 
          cmd.command.toLowerCase().includes(value.toLowerCase()) ||
          cmd.description.toLowerCase().includes(value.toLowerCase())
        )
        .slice(0, 8);
      
      setCommandSuggestions(filtered);
      setShowCommandSuggestions(true);
      setActiveSuggestionField(field);
      setSelectedSuggestionIndex(0);
    } else {
      setShowCommandSuggestions(false);
      setCommandSuggestions([]);
    }
  };

  const selectCommandSuggestion = (command) => {
    if (activeSuggestionField === 'new') {
      setNewQuickCmd({...newQuickCmd, command: command});
    } else if (activeSuggestionField === 'edit') {
      setEditingQuickCmd({...editingQuickCmd, command: command});
    }
    setShowCommandSuggestions(false);
    setCommandSuggestions([]);
    setSelectedSuggestionIndex(0);
  };

  const handleCommandKeyDown = (e, field) => {
    if (!showCommandSuggestions || commandSuggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSuggestionIndex(prev => 
        prev < commandSuggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : 0);
    } else if (e.key === 'Enter' && showCommandSuggestions) {
      e.preventDefault();
      selectCommandSuggestion(commandSuggestions[selectedSuggestionIndex].command);
    } else if (e.key === 'Escape') {
      setShowCommandSuggestions(false);
      setCommandSuggestions([]);
    }
  };

  // === Конструктор команд ===
  const buildCommandFromConstructor = () => {
    if (!selectedConstructor) return;

    const parts = [selectedConstructor.name];
    
    selectedConstructor.fields.forEach(field => {
      const value = constructorValues[field.name];
      if (value || !field.optional) {
        parts.push(value || '');
      }
    });

    const newCommand = parts.join(' ').trim();
    
    if (commands.trim()) {
      setCommands(commands + '\n' + newCommand);
    } else {
      setCommands(newCommand);
    }

    setConstructorValues({});
  };

  const selectParam = (param) => {
    setConstructorValues(prev => ({
      ...prev,
      param: param
    }));
    setShowParamAutocomplete(false);
    setFilteredParams([]);
  };

  const handleLoadPresetToEditor = (preset) => {
    setCommands(preset.commands);
  };

  // === Справочник команд ===
  const closeCommandsReference = () => {
    if (selectedCommandsFromReference.length > 0) {
      const newCommands = selectedCommandsFromReference.join('\n');
      if (commands.trim()) {
        setCommands(commands + '\n' + newCommands);
      } else {
        setCommands(newCommands);
      }
      setSelectedCommandsFromReference([]);
    }
    setShowCommandsReference(false);
  };

  // Состояние для передачи в commandSender
  const currentState = {
    selectedServers, commands, servers, delayBetweenBots, useBotname, timeout, clearAfterSend
  };

  return {
    // Состояние
    servers,
    selectedServers,
    setSelectedServers,
    searchQuery,
    setSearchQuery,
    groups,
    selectedGroup,
    setSelectedGroup,
    commands,
    setCommands,
    response,
    loading,
    timeout,
    delayBetweenBots,
    setDelayBetweenBots,
    useBotname,
    clearAfterSend,
    setClearAfterSend,
    quickCommands,
    showAddQuickCmd,
    setShowAddQuickCmd,
    newQuickCmd,
    setNewQuickCmd,
    editingQuickCmd,
    setEditingQuickCmd,
    presets,
    showPresetManager,
    setShowPresetManager,
    editingPreset,
    setEditingPreset,
    newPresetName,
    setNewPresetName,
    presetValidationError,
    setPresetValidationError,
    showPresetHint,
    setShowPresetHint,
    botCommands,
    showCommandsReference,
    setShowCommandsReference,
    commandsFilter,
    setCommandsFilter,
    selectedCategory,
    setSelectedCategory,
    selectedCommandsFromReference,
    setSelectedCommandsFromReference,
    selectedConstructor,
    setSelectedConstructor,
    constructorValues,
    setConstructorValues,
    showParamAutocomplete,
    setShowParamAutocomplete,
    filteredParams,
    setFilteredParams,
    commandSuggestions,
    showCommandSuggestions,
    activeSuggestionField,
    selectedSuggestionIndex,
    setSelectedSuggestionIndex,
    
    // Методы
    handleAddQuickCommand: () => quickCommandsCrud.handleAddQuickCommand(newQuickCmd),
    handleUpdateQuickCommand: () => quickCommandsCrud.handleUpdateQuickCommand(editingQuickCmd),
    handleDeleteQuickCommand: quickCommandsCrud.handleDeleteQuickCommand,
    handleSavePreset: () => presetsCrud.handleSavePreset(newPresetName, commands, presets),
    handleUpdatePreset: presetsCrud.handleUpdatePreset,
    handleDeletePreset: presetsCrud.handleDeletePreset,
    handleLoadPresetToEditor,
    handleCommandInput,
    selectCommandSuggestion,
    handleCommandKeyDown,
    buildCommandFromConstructor,
    selectParam,
    handleSendCommand: (e) => commandSender.handleSendCommand(e, currentState),
    handleQuickSend: (command) => commandSender.handleQuickSend(command, currentState),
    closeCommandsReference
  };
};
