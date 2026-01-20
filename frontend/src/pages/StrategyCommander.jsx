import React from 'react';
import styles from './StrategyCommander.module.css';
import { 
  StrategyHeader,
  StrategyInput,
  StrategyFilters,
  StrategyTable,
  CommandsPack,
  History,
  Notifications,
  useStrategyCommander,
  getTableData,
  generateSelectOptions,
  copyColumnData,
  buildSetParamCommand
} from '../components/StrategyCommander';

const StrategyCommander = ({ onClose }) => {
  const {
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
    resizingRef,
    toasts,
    showConfirm,
    showToast,
    handleConfirm,
    loadStrategiesFromServer,
    saveHistory,
    removeCommandFromBlock,
    copyToClipboard,
    parseAll,
    clearCommands,
    clearStrategyInput,
    handleParamChange,
    // Отправка команд
    selectedSendServers,
    setSelectedSendServers,
    isSending,
    sendResult,
    sendCommands
  } = useStrategyCommander();

  const tableData = getTableData(parsedItems, selectedItem, selectedParam);
  const selectOptions = generateSelectOptions(parsedItems);

  const handleCopyColumn = (colIndex) => {
    const text = copyColumnData(colIndex, tableData, buildSetParamCommand);
    if (!text) {
      showToast('В этом столбце нет данных для копирования!', 'warning');
      return;
    }
    copyToClipboard(text);
  };

  const handleCopyAllForward = (changes) => {
    const commands = changes.map(ch => ch.forward).join('\n');
    copyToClipboard(commands);
  };

  const handleCopyAllRevert = (changes) => {
    const commands = changes.map(ch => ch.revert).join('\n');
    copyToClipboard(commands);
  };

  return (
    <div className={styles.container}>
      <Notifications 
        toasts={toasts}
        showConfirm={showConfirm}
        onConfirm={handleConfirm}
      />

      <StrategyHeader onClose={onClose} />

      <StrategyInput 
        strategyInput={strategyInput}
        setStrategyInput={setStrategyInput}
        servers={servers}
        selectedServer={selectedServer}
        setSelectedServer={setSelectedServer}
        loadingStrategies={loadingStrategies}
        loadingProgress={loadingProgress}
        onLoadStrategies={loadStrategiesFromServer}
        onParse={parseAll}
        onClear={clearStrategyInput}
      />

      <StrategyFilters 
        parsedItems={parsedItems}
        allParamNames={allParamNames}
        selectedItem={selectedItem}
        setSelectedItem={setSelectedItem}
        selectedParam={selectedParam}
        setSelectedParam={setSelectedParam}
        selectOptions={selectOptions}
      />

      <StrategyTable 
        tableData={tableData}
        onParamChange={handleParamChange}
        onCopyColumn={handleCopyColumn}
        resizingRef={resizingRef}
        strategiesCount={parsedItems.length}
      />

      <CommandsPack 
        commandPack={commandPack}
        parsedItems={parsedItems}
        servers={servers}
        selectedSendServers={selectedSendServers}
        setSelectedSendServers={setSelectedSendServers}
        onCopy={() => copyToClipboard(commandPack)}
        onClear={clearCommands}
        onSave={saveHistory}
        onSend={sendCommands}
        isSending={isSending}
        sendResult={sendResult}
      />

      <History 
        history={history}
        onCopyForward={handleCopyAllForward}
        onCopyRevert={handleCopyAllRevert}
        onCopySingle={copyToClipboard}
        onRemoveCommand={removeCommandFromBlock}
      />
    </div>
  );
};

export default StrategyCommander;
