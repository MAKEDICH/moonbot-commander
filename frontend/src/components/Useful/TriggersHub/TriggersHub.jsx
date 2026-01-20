/**
 * Хаб триггеров - инструмент для работы со стратегиями MoonBot
 * Позволяет парсить, редактировать и генерировать команды для стратегий
 * 
 * Модульная структура:
 * - components/KeyChip.jsx - чип ключа
 * - components/NumberChip.jsx - чип номера
 * - components/TableRow.jsx - строка таблицы
 * - components/ServerSelector.jsx - выбор серверов
 * - components/HistorySection.jsx - история команд
 * - components/CommandsSection.jsx - секция команд
 * - components/SendResultSection.jsx - результаты отправки
 * - useTriggersHub.js - основная логика
 */

import React, { useState, useMemo } from 'react';
import styles from './TriggersHub.module.css';
import useTriggersHub from './useTriggersHub';
import { 
    KeyChip, TableRow, ServerSelector, HistorySection, 
    CommandsSection, SendResultSection 
} from './components';

/**
 * Главный компонент Хаба триггеров
 */
const TriggersHub = () => {
    const {
        inputText, setInputText, isProcessing, progress, progressMsg,
        selectedRef, setSelectedRef, dupOnly, setDupOnly,
        currentPage, setCurrentPage, pageSize, setPageSize,
        activeChips, soloChip, servers, selectedServer, setSelectedServer,
        loadingStrategies, loadingProgress, loadStrategiesFromServer,
        cachedIndex, commands, pageData, meta, parse, updateParamValue,
        bulkModifyNumber, toggleChip, checkDuplicates, removeDuplicateStrategies,
        selectedSendServers, setSelectedSendServers, isSending, sendResult,
        setSendResult, sendCommands, commandHistory, saveToHistory,
        removeHistoryBlock, clearHistory, clearChanges, clearForwardBaseline,
        clearRevertBaseline
    } = useTriggersHub();
    
    const [parseInfo, setParseInfo] = useState('Вставьте текст и нажмите «Разобрать»');
    const [qeNum, setQeNum] = useState('');
    const [qeSec, setQeSec] = useState('');
    const [qeLaunch, setQeLaunch] = useState(false);
    const [isServerSelectorOpen, setIsServerSelectorOpen] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(true);
    const [isCommandsOpen, setIsCommandsOpen] = useState(true);
    const [duplicateInfo, setDuplicateInfo] = useState(null);
    
    // Вычисление флагов для чипов
    const chipFlags = useMemo(() => {
        const hasLaunch = {}, hasBL = {}, hasByKey = {};
        cachedIndex.rows.forEach(r => {
            r.nums.forEach(n => {
                if (r.type === 'Launch') hasLaunch[n] = true;
                if (r.type === 'BL' || r.type === 'Sell' || r.type === 'Clear') hasBL[n] = true;
                if (r.type === 'ByKey') hasByKey[n] = true;
            });
        });
        return { hasLaunch, hasBL, hasByKey };
    }, [cachedIndex]);
    
    // Ключи для отображения
    const displayKeys = useMemo(() => {
        const allKeys = Object.keys(cachedIndex.idx).map(x => parseInt(x, 10)).sort((a, b) => a - b);
        return dupOnly ? allKeys.filter(n => cachedIndex.idx[n].count > 1) : allKeys;
    }, [cachedIndex, dupOnly]);
    
    // Проверка есть ли папки в данных
    const hasFolders = useMemo(() => cachedIndex.rows.some(r => r.folder?.trim()), [cachedIndex]);
    
    // Обработчики
    const handleParse = async () => {
        const result = await parse();
        result.success ? setParseInfo(`Разобрано: ${result.count} стратегий`) : alert(result.message);
    };
    
    const handleLoadFromServer = async (cmd) => {
        const result = await loadStrategiesFromServer(cmd);
        result.success ? setParseInfo(result.message) : alert(result.message);
    };
    
    const handleSelect = (row) => {
        setSelectedRef({ stg: row.stg, strategy: row.strategy, folder: row.folder, param: row.param });
    };
    
    const handleQeAdd = () => {
        const num = parseInt(qeNum, 10);
        if (isNaN(num)) return alert('Введите номер');
        const changed = bulkModifyNumber(num, qeSec ? parseInt(qeSec, 10) : null, true, qeLaunch);
        alert(changed === 0 ? 'Нет изменений' : `Добавлено к ${changed} параметрам`);
    };
    
    const handleQeDel = () => {
        const num = parseInt(qeNum, 10);
        if (isNaN(num)) return alert('Введите номер');
        const changed = bulkModifyNumber(num, null, false, qeLaunch);
        alert(changed === 0 ? 'Нет изменений' : `Удалено из ${changed} параметров`);
    };
    
    const copyToClipboard = async (text) => {
        try { await navigator.clipboard.writeText(text); alert('Скопировано!'); } 
        catch (err) { console.error('Ошибка копирования:', err); }
    };
    
    const handleSendCommands = async (cmdText) => {
        const result = await sendCommands(cmdText);
        if (!result.success) alert(result.message);
    };
    
    const handleSaveToHistory = () => alert(saveToHistory().message);
    
    const handleCheckDuplicates = () => {
        const result = checkDuplicates();
        setDuplicateInfo({ 
            type: result.hasDuplicates ? 'warning' : 'success', 
            message: result.message, 
            duplicates: result.duplicates || [] 
        });
        if (!result.hasDuplicates) setTimeout(() => setDuplicateInfo(null), 3000);
    };
    
    const handleRemoveDuplicates = () => {
        if (!checkDuplicates().hasDuplicates) {
            setDuplicateInfo({ type: 'success', message: 'Дубликатов команд не найдено!', duplicates: [] });
            setTimeout(() => setDuplicateInfo(null), 3000);
            return;
        }
        const result = removeDuplicateStrategies();
        setDuplicateInfo({ type: result.success ? 'success' : 'warning', message: result.message, duplicates: [] });
        if (result.success) setParseInfo(`Разобрано: ${meta.strategies - result.removed} стратегий`);
        if (result.success) setTimeout(() => setDuplicateInfo(null), 3000);
    };
    
    const hasCommands = commands.forward?.trim().length > 0;
    const canSend = hasCommands && selectedSendServers.length > 0 && !isSending;
    
    return (
        <div className={styles.container}>
            {/* Progress */}
            {isProcessing && (
                <>
                    <div className={styles.progressWrap}>
                        <div className={styles.progressBar} style={{ width: `${progress}%` }} />
                    </div>
                    <div className={styles.progressText}>
                        <div className={styles.spinner} />
                        <span>{progressMsg}</span>
                    </div>
                </>
            )}
            
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.headerTitleWrap}>
                    <span className={styles.headerIcon}>🔀</span>
                    <h2 className={styles.headerTitle}>Хаб триггеров</h2>
                    <span className={styles.headerAuthor}>by @MAKEDICH</span>
                </div>
                <div className={styles.headerButtons}>
                    <button className={`${styles.btn} ${styles.btnPrimary}`}
                        onClick={handleParse} disabled={isProcessing || loadingStrategies}>
                        📖 Разобрать
                    </button>
                </div>
            </div>
            
            {/* Счётчик стратегий */}
            {meta.strategies > 0 && (
                <div className={styles.strategiesCounter}>
                    <span className={styles.counterIcon}>📊</span>
                    <span>Загружено стратегий: <strong>{meta.strategies}</strong></span>
                    <span className={styles.counterSep}>|</span>
                    <span>Ключей: <strong>{meta.keys}</strong></span>
                </div>
            )}
            
            {/* Layout */}
            <div className={styles.layout}>
                {/* Sidebar */}
                <div className={styles.sidebar}>
                    {/* Загрузка с сервера */}
                    <div className={styles.card}>
                        <h4 className={styles.cardTitle}>📡 Загрузить с сервера</h4>
                        <select className={styles.select} value={selectedServer || ''}
                            onChange={(e) => setSelectedServer(parseInt(e.target.value) || null)} disabled={loadingStrategies}>
                            <option value="">Выберите сервер...</option>
                            {servers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.host}:{s.port})</option>)}
                        </select>
                        <div className={styles.row}>
                            <button className={styles.btn} onClick={() => handleLoadFromServer('GetStrategiesFull')}
                                disabled={!selectedServer || loadingStrategies}>
                                {loadingStrategies ? '⏳' : '📋'} Все стратегии
                            </button>
                            <button className={styles.btn} onClick={() => handleLoadFromServer('GetStrategiesActive')}
                                disabled={!selectedServer || loadingStrategies}>
                                {loadingStrategies ? '⏳' : '✅'} Только активные
                            </button>
                        </div>
                        {loadingStrategies && (
                            <div className={styles.loadProgress}>
                                <div className={styles.loadProgressBar}>
                                    <div className={styles.loadProgressFill} 
                                        style={{ width: `${(loadingProgress.current / loadingProgress.max) * 100}%` }} />
                                </div>
                                <div className={styles.loadProgressText}>
                                    <div className={styles.loadSpinner} /><span>{loadingProgress.message}</span>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {/* Input card */}
                    <div className={styles.card}>
                        <h4 className={styles.cardTitle}>📝 Вставьте стратегии</h4>
                        <textarea className={styles.textarea} value={inputText}
                            onChange={(e) => setInputText(e.target.value)} placeholder="#Begin_Folder ..." />
                        <div className={styles.row}><span className={styles.muted}>{parseInfo}</span></div>
                    </div>
                    
                    {/* Duplicates */}
                    <div className={styles.card}>
                        <h4 className={styles.cardTitle}>🔢 Дубликаты</h4>
                        <label className={styles.checkbox}>
                            <input type="checkbox" checked={dupOnly} onChange={(e) => setDupOnly(e.target.checked)} />
                            <span className={styles.checkboxCustom}></span>
                            <span className={styles.checkboxLabel}>Показывать только дубликаты</span>
                        </label>
                        <div className={styles.legend}>
                            <div className={styles.legendTitle}>📋 Легенда цветов</div>
                            <div className={styles.legendItems}>
                                <div className={styles.legendItem}><span className={`${styles.legendDot} ${styles.legendRed}`}></span><span>Только Launch без BL</span></div>
                                <div className={styles.legendItem}><span className={`${styles.legendDot} ${styles.legendBlue}`}></span><span>Только BL без Launch</span></div>
                                <div className={styles.legendItem}><span className={`${styles.legendDot} ${styles.legendGreen}`}></span><span>Используется в ByKey</span></div>
                                <div className={styles.legendItem}><span className={`${styles.legendDot} ${styles.legendYellow}`}></span><span>Launch + BL вместе</span></div>
                                <div className={styles.legendItem}><span className={`${styles.legendDot} ${styles.legendPurple}`}></span><span>Solo режим (клик)</span></div>
                            </div>
                        </div>
                        <div className={styles.chips}>
                            {displayKeys.map(n => (
                                <KeyChip key={n} num={n} count={cachedIndex.idx[n].count}
                                    isActive={activeChips.has(n)} isSolo={soloChip === n}
                                    flags={{ hasLaunch: chipFlags.hasLaunch[n], hasBL: chipFlags.hasBL[n], hasByKey: chipFlags.hasByKey[n] }}
                                    onToggle={toggleChip} />
                            ))}
                        </div>
                        <div className={styles.row}>
                            <input className={`${styles.input} ${styles.inputSmall}`} value={qeNum}
                                onChange={(e) => setQeNum(e.target.value)} placeholder="номер" />
                            <input className={`${styles.input} ${styles.inputSmall}`} value={qeSec}
                                onChange={(e) => setQeSec(e.target.value)} placeholder="сек" />
                        </div>
                        <div className={styles.row}>
                            <button className={styles.btn} onClick={handleQeAdd}>Добавить видимым</button>
                            <button className={styles.btn} onClick={handleQeDel}>Удалить у видимых</button>
                        </div>
                        <label className={styles.checkbox}>
                            <input type="checkbox" checked={qeLaunch} onChange={(e) => setQeLaunch(e.target.checked)} />
                            <span className={styles.checkboxCustom}></span>
                            <span className={styles.checkboxLabel}>Включать запуск</span>
                        </label>
                    </div>
                </div>
                
                {/* Table */}
                <div className={styles.tableWrapper}>
                    <div className={styles.tableScroll}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Стратегия</th>
                                    {hasFolders && <th>Папка</th>}
                                    <th>Параметр</th>
                                    <th>Тип</th>
                                    <th>Значение</th>
                                    <th>Номера</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pageData.rows.map((row, i) => (
                                    <TableRow key={`${row.strategy}-${row.param}-${i}`} row={row}
                                        isSelected={selectedRef?.stg === row.stg}
                                        isHit={row.nums.some(n => activeChips.has(n))}
                                        isChanged={row.stg.params[row.param] !== (row.stg.originalParams?.[row.param] ?? row.value)}
                                        onSelect={handleSelect} onValueChange={updateParamValue}
                                        onToggleChip={(num) => toggleChip(num, false)} showFolder={hasFolders} />
                                ))}
                            </tbody>
                        </table>
                    </div>
                    
                    {/* Pagination */}
                    <div className={styles.pagination}>
                        <button className={styles.btn} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}>◀ Назад</button>
                        <span className={styles.muted}>
                            Страница <input className={`${styles.input} ${styles.paginationInput}`} type="number" 
                                value={currentPage} min={1} max={pageData.totalPages}
                                onChange={(e) => { const p = parseInt(e.target.value, 10); if (p >= 1 && p <= pageData.totalPages) setCurrentPage(p); }} />
                            из {pageData.totalPages}
                        </span>
                        <button className={styles.btn} onClick={() => setCurrentPage(p => Math.min(pageData.totalPages, p + 1))} disabled={currentPage >= pageData.totalPages}>Вперёд ▶</button>
                        <span className={styles.muted}>|</span>
                        <label>На странице: <select className={styles.select} value={pageSize}
                            onChange={(e) => { setPageSize(parseInt(e.target.value, 10)); setCurrentPage(1); }}>
                            <option value={50}>50</option><option value={100}>100</option>
                            <option value={200}>200</option><option value={500}>500</option>
                            <option value={1000}>1000</option><option value={-1}>Все</option>
                        </select></label>
                        <span className={styles.muted}>| Всего строк: {pageData.totalRows}</span>
                    </div>
                </div>
                
                {/* Commands section */}
                <CommandsSection commands={commands} hasCommands={hasCommands} canSend={canSend}
                    isSending={isSending} duplicateInfo={duplicateInfo} setDuplicateInfo={setDuplicateInfo}
                    isOpen={isCommandsOpen} setIsOpen={setIsCommandsOpen} selectedSendServers={selectedSendServers}
                    onCopy={copyToClipboard} onClearForward={clearForwardBaseline} onClearRevert={clearRevertBaseline}
                    onCheckDuplicates={handleCheckDuplicates} onRemoveDuplicates={handleRemoveDuplicates}
                    onClearChanges={clearChanges} onSaveToHistory={handleSaveToHistory}
                    onSendForward={() => handleSendCommands(commands.forward)} onSendRevert={() => handleSendCommands(commands.revert)} />
                
                {/* Server selector */}
                <div className={styles.fullRow}>
                    <ServerSelector servers={servers} selectedServers={selectedSendServers}
                        setSelectedServers={setSelectedSendServers} isOpen={isServerSelectorOpen} setIsOpen={setIsServerSelectorOpen} />
                </div>
                
                {/* History */}
                <div className={styles.fullRow}>
                    <HistorySection history={commandHistory} onRemoveBlock={removeHistoryBlock}
                        onClear={clearHistory} onCopyText={copyToClipboard} isOpen={isHistoryOpen} setIsOpen={setIsHistoryOpen} />
                </div>
                
                {/* Send result */}
                <SendResultSection sendResult={sendResult} onClose={() => setSendResult(null)} />
            </div>
        </div>
    );
};

export default TriggersHub;
