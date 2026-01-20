import React, { lazy, Suspense } from 'react';
import { FiSend, FiBook, FiSettings } from 'react-icons/fi';
import styles from './CommandsNew.module.css';
import PageHeader from '../components/PageHeader';
import { useCommandsNew } from '../components/CommandsNew/useCommandsNew';
import ServerSelector from '../components/CommandsNew/ServerSelector';
import CommandEditor from '../components/CommandsNew/CommandEditor';
import QuickCommands from '../components/CommandsNew/QuickCommands';
import PresetsManager from '../components/CommandsNew/PresetsManager';
import CommandConstructor from '../components/CommandsNew/CommandConstructor';
import CommandsReference from '../components/CommandsNew/CommandsReference';
import { 
  getGroupedServers, 
  isGroupFullySelected, 
  isGroupPartiallySelected, 
  toggleGroupSelection as toggleGroupSelectionUtil,
  toggleServerSelection as toggleServerSelectionUtil,
  selectAll as selectAllUtil,
  deselectAll as deselectAllUtil
} from '../components/CommandsNew/serverUtils';

// Lazy loading для StrategyCommander
const StrategyCommander = lazy(() => import('./StrategyCommander'));

/**
 * Главный компонент страницы отправки команд
 */
const CommandsNew = () => {
  const [showStrategyCommander, setShowStrategyCommander] = React.useState(false);
  
  const {
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
    delayBetweenBots,
    setDelayBetweenBots,
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
    handleAddQuickCommand,
    handleUpdateQuickCommand,
    handleDeleteQuickCommand,
    handleSavePreset,
    handleUpdatePreset,
    handleDeletePreset,
    handleLoadPresetToEditor,
    handleCommandInput,
    selectCommandSuggestion,
    handleCommandKeyDown,
    buildCommandFromConstructor,
    selectParam,
    handleSendCommand,
    handleQuickSend,
    closeCommandsReference
  } = useCommandsNew();

  // Фильтрация серверов для отображения
  const filteredServers = servers.filter(server => {
    const matchesSearch = 
      server.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      server.host.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (server.group_name && server.group_name.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesGroup = selectedGroup === 'all' || 
                        (!selectedGroup && !server.group_name) ||
                        (server.group_name && server.group_name.split(',').map(g => g.trim()).includes(selectedGroup));
    
    return matchesSearch && matchesGroup;
  });

  // Утилиты для работы с серверами
  const toggleServerSelection = (serverId) => {
    toggleServerSelectionUtil(serverId, selectedServers, setSelectedServers);
  };

  const toggleGroupSelection = (groupName) => {
    toggleGroupSelectionUtil(groupName, servers, selectedServers, setSelectedServers);
  };

  const selectAll = () => {
    selectAllUtil(filteredServers, setSelectedServers);
  };

  const deselectAll = () => {
    deselectAllUtil(setSelectedServers);
  };

  return (
    <div className={styles.container}>
      {showStrategyCommander ? (
        <Suspense fallback={
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '10px' }}>⏳</div>
              <div style={{ fontSize: '18px' }}>Загрузка Strategy Commander...</div>
            </div>
          </div>
        }>
          <StrategyCommander onClose={() => setShowStrategyCommander(false)} />
        </Suspense>
      ) : (
        <>
          <PageHeader 
            icon={<FiSend />} 
            title="Отправка команд" 
            gradient="cyan"
          >
            <button 
              className={styles.strategyCommanderButton}
              onClick={() => setShowStrategyCommander(true)}
              title="Открыть MoonBot Commander Pro"
            >
              <FiSettings /> Strategy Commander
            </button>
            <button 
              onClick={() => setShowCommandsReference(!showCommandsReference)}
              className={styles.headerBtn}
            >
              <FiBook /> Справочник команд
            </button>
          </PageHeader>

          <ServerSelector
            servers={servers}
            selectedServers={selectedServers}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedGroup={selectedGroup}
            setSelectedGroup={setSelectedGroup}
            groups={groups}
            toggleServerSelection={toggleServerSelection}
            selectAll={selectAll}
            deselectAll={deselectAll}
            getGroupedServers={() => getGroupedServers(filteredServers)}
            isGroupFullySelected={isGroupFullySelected}
            isGroupPartiallySelected={isGroupPartiallySelected}
            toggleGroupSelection={toggleGroupSelection}
          />

          <div className={styles.content}>
            {/* Левая панель - Пресеты */}
            <div className={styles.leftPanel}>
              <PresetsManager
                presets={presets}
                newPresetName={newPresetName}
                setNewPresetName={setNewPresetName}
                commands={commands}
                handleSavePreset={handleSavePreset}
                handleLoadPresetToEditor={handleLoadPresetToEditor}
                handleUpdatePreset={handleUpdatePreset}
                handleDeletePreset={handleDeletePreset}
                loading={loading}
                showPresetHint={showPresetHint}
                setShowPresetHint={setShowPresetHint}
                showPresetManager={showPresetManager}
                setShowPresetManager={setShowPresetManager}
                editingPreset={editingPreset}
                setEditingPreset={setEditingPreset}
                presetValidationError={presetValidationError}
                setPresetValidationError={setPresetValidationError}
              />
            </div>

            {/* Центральная панель - Редактор команд */}
            <CommandEditor
              commands={commands}
              setCommands={setCommands}
              loading={loading}
              selectedServers={selectedServers}
              handleSendCommand={handleSendCommand}
              delayBetweenBots={delayBetweenBots}
              setDelayBetweenBots={setDelayBetweenBots}
              clearAfterSend={clearAfterSend}
              setClearAfterSend={setClearAfterSend}
              response={response}
            />

            {/* Правая панель - Конструктор + Быстрые команды */}
            <div className={styles.rightPanel}>
              <CommandConstructor
                selectedConstructor={selectedConstructor}
                setSelectedConstructor={setSelectedConstructor}
                constructorValues={constructorValues}
                setConstructorValues={setConstructorValues}
                buildCommandFromConstructor={buildCommandFromConstructor}
                showParamAutocomplete={showParamAutocomplete}
                setShowParamAutocomplete={setShowParamAutocomplete}
                filteredParams={filteredParams}
                setFilteredParams={setFilteredParams}
                selectParam={selectParam}
              />

              <QuickCommands
                quickCommands={quickCommands}
                showAddQuickCmd={showAddQuickCmd}
                setShowAddQuickCmd={setShowAddQuickCmd}
                newQuickCmd={newQuickCmd}
                setNewQuickCmd={setNewQuickCmd}
                editingQuickCmd={editingQuickCmd}
                setEditingQuickCmd={setEditingQuickCmd}
                handleAddQuickCommand={handleAddQuickCommand}
                handleUpdateQuickCommand={handleUpdateQuickCommand}
                handleDeleteQuickCommand={handleDeleteQuickCommand}
                handleQuickSend={handleQuickSend}
                handleCommandInput={handleCommandInput}
                handleCommandKeyDown={handleCommandKeyDown}
                showCommandSuggestions={showCommandSuggestions}
                activeSuggestionField={activeSuggestionField}
                commandSuggestions={commandSuggestions}
                selectedSuggestionIndex={selectedSuggestionIndex}
                setSelectedSuggestionIndex={setSelectedSuggestionIndex}
                selectCommandSuggestion={selectCommandSuggestion}
              />
            </div>
          </div>

          {/* Модальное окно справочника */}
          <CommandsReference
            showCommandsReference={showCommandsReference}
            closeCommandsReference={closeCommandsReference}
            botCommands={botCommands}
            commandsFilter={commandsFilter}
            setCommandsFilter={setCommandsFilter}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            selectedCommandsFromReference={selectedCommandsFromReference}
            setSelectedCommandsFromReference={setSelectedCommandsFromReference}
          />
        </>
      )}
    </div>
  );
};

export default CommandsNew;
