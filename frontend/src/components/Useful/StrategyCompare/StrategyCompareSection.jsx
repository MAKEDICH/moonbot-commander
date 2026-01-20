/**
 * Секция "Сравнение стратегий" для страницы Полезное
 */

import React, { useState } from 'react';
import styles from './StrategyCompare.module.css';
import useStrategyCompare from './useStrategyCompare';
import CommandSendSection from './CommandSendSection';
import { FolderTree, ComparisonTable } from './StrategyCompareComponents';

/**
 * Главный компонент секции
 */
const StrategyCompareSection = () => {
    const {
        manualText,
        setManualText,
        parseAll,
        clearAll,
        allStrategies,
        parsedData,
        selectedIndexes,
        toggleStrategySelection,
        baselineIndex,
        setBaselineIndex,
        baselineFromSelected,
        setBaselineFromSelected,
        showOnlyDiff,
        setShowOnlyDiff,
        compare,
        comparisonResult,
        updateParamValue,
        getBaselineOptions,
        trueColor,
        setTrueColor,
        falseColor,
        setFalseColor,
        servers,
        selectedServer,
        setSelectedServer,
        loadingStrategies,
        loadingProgress,
        loadStrategiesFromServer,
        copyStrategies,
        sidebarOpen,
        setSidebarOpen,
        error,
        needsParsing,
        // Отправка команд
        selectedSendServers,
        setSelectedSendServers,
        isSending,
        sendResult,
        setSendResult,
        commandPack,
        setCommandPack,
        sendCommands,
        saveToHistory,
        commandHistory,
        removeHistoryBlock,
        clearHistory
    } = useStrategyCompare();
    
    const [collapsedFolders, setCollapsedFolders] = useState(new Set());
    const [strategiesCollapsed, setStrategiesCollapsed] = useState(false);
    
    const toggleFolder = (folderId) => {
        setCollapsedFolders(prev => {
            const newSet = new Set(prev);
            if (newSet.has(folderId)) {
                newSet.delete(folderId);
            } else {
                newSet.add(folderId);
            }
            return newSet;
        });
    };
    
    const baselineOptions = getBaselineOptions();
    
    return (
        <div className={styles.container}>
            {/* Боковая панель */}
            <div className={`${styles.sidebar} ${sidebarOpen ? styles.open : ''}`}>
                <h2 className={styles.sidebarTitle}>Загрузка стратегий</h2>
                
                {/* Загрузка с сервера */}
                <div className={styles.serverSection}>
                    <h3>Загрузить с сервера:</h3>
                    <select
                        value={selectedServer || ''}
                        onChange={(e) => setSelectedServer(parseInt(e.target.value) || null)}
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
                    
                    <div className={styles.serverButtons}>
                        <button
                            onClick={() => loadStrategiesFromServer('GetStrategiesFull')}
                            disabled={!selectedServer || loadingStrategies}
                            className={styles.loadButton}
                            title="Загрузить все стратегии с выбранного сервера MoonBot"
                        >
                            {loadingStrategies ? '⏳' : '📋'} Все стратегии
                        </button>
                        <button
                            onClick={() => loadStrategiesFromServer('GetStrategiesActive')}
                            disabled={!selectedServer || loadingStrategies}
                            className={styles.loadButton}
                            title="Загрузить только активные стратегии"
                        >
                            {loadingStrategies ? '⏳' : '✅'} Только активные
                        </button>
                    </div>
                    
                    {loadingStrategies && loadingProgress.max > 0 && (
                        <div className={styles.progressWrapper}>
                            <progress 
                                value={loadingProgress.current} 
                                max={loadingProgress.max}
                                className={styles.progressBar}
                            />
                            <span className={styles.progressText}>
                                {loadingProgress.message}
                            </span>
                        </div>
                    )}
                </div>
                
                <hr className={styles.divider} />
                
                {/* Кнопки управления */}
                <div className={styles.controlButtons}>
                    <button 
                        onClick={parseAll} 
                        className={`${styles.parseButton} ${needsParsing ? styles.parseButtonFire : ''}`}
                    >
                        📖 Считать стратегии
                    </button>
                    <button onClick={clearAll} className={styles.clearButton}>
                        🗑️ Очистить
                    </button>
                </div>
                
                {/* Счётчик загруженных стратегий */}
                {allStrategies.length > 0 && (
                    <div className={styles.strategiesCounter}>
                        <span className={styles.counterIcon}>📊</span>
                        <span className={styles.counterText}>
                            Загружено стратегий: <strong>{allStrategies.length}</strong>
                        </span>
                    </div>
                )}
                
                <hr className={styles.divider} />
                
                {/* Ручной ввод */}
                <div className={styles.manualSection}>
                    <p>Поле для ручного ввода:</p>
                    <textarea
                        value={manualText}
                        onChange={(e) => setManualText(e.target.value)}
                        className={styles.manualTextarea}
                        placeholder="Вставьте стратегии сюда..."
                    />
                </div>
                
                {/* Палитра цветов */}
                <div className={styles.colorSection}>
                    <div className={styles.colorRow}>
                        <label>Совпадают:</label>
                        <input
                            type="color"
                            value={trueColor}
                            onChange={(e) => setTrueColor(e.target.value)}
                            className={styles.colorInput}
                        />
                    </div>
                    <div className={styles.colorRow}>
                        <label>Отличаются:</label>
                        <input
                            type="color"
                            value={falseColor}
                            onChange={(e) => setFalseColor(e.target.value)}
                            className={styles.colorInput}
                        />
                    </div>
                </div>
            </div>
            
            {/* Основной контент */}
            <div className={`${styles.mainContent} ${sidebarOpen ? styles.shifted : ''}`}>
                <div className={styles.titleRow}>
                    <h2 className={styles.title}>Сравнение стратегий (by @MAKEDICH)</h2>
                    <button 
                        className={styles.toggleSidebarInline}
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                    >
                        {sidebarOpen ? '✕ Скрыть загрузку' : '📂 Показать загрузку'}
                    </button>
                </div>
                
                {error && !needsParsing && (
                    <div className={styles.errorMessage}>{error}</div>
                )}
                
                {needsParsing && (
                    <div className={styles.parseHint}>
                        Нажмите «Считать стратегии» для обработки загруженных данных
                    </div>
                )}
                
                {/* Панель управления сравнением */}
                <div className={styles.compareControls}>
                    <h3>Поле для управления сравнением стратегий</h3>
                    
                    <div className={styles.controlsRow}>
                        <label className={styles.controlLabel}>
                            Эталонная стратегия:
                            <select
                                value={baselineIndex}
                                onChange={(e) => setBaselineIndex(parseInt(e.target.value))}
                                className={styles.baselineSelect}
                            >
                                {baselineOptions.map(opt => (
                                    <option key={opt.index} value={opt.index}>
                                        {opt.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                        
                        <label className={styles.checkboxLabel}>
                            <input
                                type="checkbox"
                                checked={baselineFromSelected}
                                onChange={(e) => setBaselineFromSelected(e.target.checked)}
                            />
                            Эталон из отмеченных
                        </label>
                        
                        <label className={styles.checkboxLabel}>
                            <input
                                type="checkbox"
                                checked={showOnlyDiff}
                                onChange={(e) => setShowOnlyDiff(e.target.checked)}
                            />
                            Только отличающиеся параметры
                        </label>
                    </div>
                    
                    <button 
                        onClick={compare}
                        className={styles.compareButton}
                        style={{ backgroundColor: trueColor }}
                    >
                        Сравнить
                    </button>
                </div>
                
                {/* Список стратегий */}
                {parsedData.length === 0 ? (
                    <div className={styles.noStrategies}>
                        Нет загруженных стратегий. Откройте панель справа и загрузите или вставьте.
                    </div>
                ) : (
                    <div className={styles.strategiesSection}>
                        <div 
                            className={styles.strategiesSectionHeader}
                            onClick={() => setStrategiesCollapsed(!strategiesCollapsed)}
                        >
                            <span className={styles.collapseIcon}>
                                {strategiesCollapsed ? '▶' : '▼'}
                            </span>
                            <h3>Выберите стратегии для сравнения ({selectedIndexes.size}/10):</h3>
                        </div>
                        {!strategiesCollapsed && (
                            <FolderTree
                                items={parsedData}
                                selectedIndexes={selectedIndexes}
                                onToggle={toggleStrategySelection}
                                allStrategies={allStrategies}
                                collapsedFolders={collapsedFolders}
                                toggleFolder={toggleFolder}
                            />
                        )}
                    </div>
                )}
                
                {/* Таблица сравнения */}
                <ComparisonTable
                    result={comparisonResult}
                    trueColor={trueColor}
                    falseColor={falseColor}
                    onUpdateValue={updateParamValue}
                    onCopy={copyStrategies}
                />
                
                {/* Секция отправки команд */}
                {comparisonResult && (
                    <CommandSendSection
                        servers={servers}
                        selectedSendServers={selectedSendServers}
                        setSelectedSendServers={setSelectedSendServers}
                        commandPack={commandPack}
                        setCommandPack={setCommandPack}
                        onSend={sendCommands}
                        onSave={saveToHistory}
                        commandHistory={commandHistory}
                        onRemoveHistoryBlock={removeHistoryBlock}
                        onClearHistory={clearHistory}
                        isSending={isSending}
                        sendResult={sendResult}
                        setSendResult={setSendResult}
                    />
                )}
            </div>
        </div>
    );
};

export default StrategyCompareSection;
