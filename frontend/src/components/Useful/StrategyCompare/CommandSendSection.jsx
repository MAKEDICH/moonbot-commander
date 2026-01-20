/**
 * Секция отправки команд на серверы
 * Используется в StrategyCompare для отправки сформированных команд
 */

import React, { useState, useMemo } from 'react';
import { 
    FiServer, FiCheck, FiX, FiSearch, 
    FiChevronDown, FiChevronUp, FiSend, 
    FiLoader, FiMessageCircle, FiCopy,
    FiSave, FiTrash2, FiClock
} from 'react-icons/fi';
import styles from './StrategyCompare.module.css';

const CommandSendSection = ({
    servers = [],
    selectedSendServers = [],
    setSelectedSendServers,
    commandPack = '',
    setCommandPack,
    onSend,
    onSave,
    commandHistory = [],
    onRemoveHistoryBlock,
    onClearHistory,
    isSending = false,
    sendResult = null,
    setSendResult
}) => {
    const [isServerSelectorOpen, setIsServerSelectorOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isCommandsOpen, setIsCommandsOpen] = useState(true);
    const [isHistoryOpen, setIsHistoryOpen] = useState(true);

    // Группировка серверов по группам
    const groupedServers = useMemo(() => {
        const groups = {};
        servers.forEach(server => {
            const groupName = server.group_name || 'Без группы';
            if (!groups[groupName]) {
                groups[groupName] = [];
            }
            groups[groupName].push(server);
        });
        return groups;
    }, [servers]);

    // Фильтрация серверов по поиску
    const filteredGroupedServers = useMemo(() => {
        if (!searchQuery.trim()) return groupedServers;
        
        const query = searchQuery.toLowerCase();
        const filtered = {};
        
        Object.entries(groupedServers).forEach(([groupName, groupServers]) => {
            const matchingServers = groupServers.filter(server => 
                server.name.toLowerCase().includes(query) ||
                server.host.toLowerCase().includes(query) ||
                groupName.toLowerCase().includes(query)
            );
            if (matchingServers.length > 0) {
                filtered[groupName] = matchingServers;
            }
        });
        
        return filtered;
    }, [groupedServers, searchQuery]);

    // Проверка полного/частичного выбора группы
    const isGroupFullySelected = (groupServers) => {
        return groupServers.every(s => selectedSendServers.includes(s.id));
    };

    const isGroupPartiallySelected = (groupServers) => {
        const selected = groupServers.filter(s => selectedSendServers.includes(s.id));
        return selected.length > 0 && selected.length < groupServers.length;
    };

    // Переключение сервера
    const toggleServer = (serverId) => {
        setSelectedSendServers(prev => 
            prev.includes(serverId) 
                ? prev.filter(id => id !== serverId)
                : [...prev, serverId]
        );
    };

    // Переключение группы
    const toggleGroup = (groupServers) => {
        const groupIds = groupServers.map(s => s.id);
        const allSelected = isGroupFullySelected(groupServers);
        
        if (allSelected) {
            setSelectedSendServers(prev => prev.filter(id => !groupIds.includes(id)));
        } else {
            setSelectedSendServers(prev => [...new Set([...prev, ...groupIds])]);
        }
    };

    // Выбрать все / Снять все
    const selectAllServers = () => {
        setSelectedSendServers(servers.map(s => s.id));
    };

    const deselectAllServers = () => {
        setSelectedSendServers([]);
    };

    // Копирование в буфер обмена
    const copyToClipboard = async (text) => {
        try {
            await navigator.clipboard.writeText(text || commandPack);
        } catch (err) {
            console.error('Ошибка копирования:', err);
        }
    };

    const hasCommands = commandPack && commandPack.trim().length > 0;
    const canSend = hasCommands && selectedSendServers.length > 0 && !isSending;

    return (
        <div className={styles.commandSendSection}>
            {/* Секция команд */}
            <div className={styles.commandsPackSection}>
                <div 
                    className={styles.commandsPackHeader}
                    onClick={() => setIsCommandsOpen(!isCommandsOpen)}
                >
                    <span>Пак команд {hasCommands && `(${commandPack.split('\n').filter(c => c.trim()).length} команд)`}</span>
                    <button className={styles.toggleBtn}>
                        {isCommandsOpen ? <FiChevronUp /> : <FiChevronDown />}
                    </button>
                </div>
                
                {isCommandsOpen && (
                    <div className={styles.commandsPackBody}>
                        <textarea
                            className={styles.commandPackTextarea}
                            value={commandPack}
                            onChange={(e) => setCommandPack(e.target.value)}
                            placeholder="Команды автоматически формируются при изменении параметров в таблице..."
                        />
                        
                        {/* Кнопки в ряд: Скопировать, Очистить, Сохранить, Отправить */}
                        <div className={styles.commandPackActions}>
                            <button 
                                onClick={() => copyToClipboard()}
                                className={styles.copyBtn}
                                disabled={!hasCommands}
                                title="Скопировать команды в буфер обмена"
                            >
                                <FiCopy /> Скопировать
                            </button>
                            <button 
                                onClick={() => setCommandPack('')}
                                className={styles.clearPackBtn}
                                disabled={!hasCommands}
                                title="Очистить пак команд"
                            >
                                <FiTrash2 /> Очистить
                            </button>
                            <button 
                                onClick={onSave}
                                className={styles.saveBtn}
                                disabled={!hasCommands}
                                title="Сохранить команды в историю"
                            >
                                <FiSave /> Сохранить
                            </button>
                            <button 
                                className={`${styles.sendBtn} ${canSend ? styles.sendBtnActive : ''}`}
                                onClick={onSend}
                                disabled={!canSend}
                                title={!hasCommands ? 'Нет команд для отправки' : selectedSendServers.length === 0 ? 'Выберите серверы' : `Отправить на ${selectedSendServers.length} сервер(ов)`}
                            >
                                {isSending ? (
                                    <><FiLoader className={styles.spinIcon} /> Отправка...</>
                                ) : (
                                    <><FiSend /> Отправить ({selectedSendServers.length})</>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* История сохранённых команд */}
            <div className={styles.historySection}>
                <div 
                    className={styles.historyHeader}
                    onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                >
                    <span><FiClock /> История сохранённых команд</span>
                    <button className={styles.toggleBtn}>
                        {isHistoryOpen ? <FiChevronUp /> : <FiChevronDown />}
                    </button>
                </div>
                
                {isHistoryOpen && (
                    <div className={styles.historyBody}>
                        {commandHistory.length === 0 ? (
                            <div className={styles.noHistory}>История пуста</div>
                        ) : (
                            <>
                                {[...commandHistory].reverse().map((block, idx) => {
                                    const actualIndex = commandHistory.length - 1 - idx;
                                    const changes = block.changes || [];
                                    
                                    return (
                                        <div key={actualIndex} className={styles.historyBlock}>
                                            <div className={styles.historyBlockHeader}>
                                                <span className={styles.historyDate}>
                                                    Сохранено: {block.savedAt}
                                                </span>
                                                <div className={styles.historyBlockActions}>
                                                    <button 
                                                        onClick={() => copyToClipboard(changes.map(c => c.forward).join('\n'))}
                                                        className={styles.copyForwardBtn}
                                                        title="Скопировать все Forward команды"
                                                    >
                                                        <FiCopy /> Copy ALL Forward
                                                    </button>
                                                    <button 
                                                        onClick={() => copyToClipboard(changes.map(c => c.revert).join('\n'))}
                                                        className={styles.copyRevertBtn}
                                                        title="Скопировать все Revert команды"
                                                    >
                                                        <FiCopy /> Copy ALL Revert
                                                    </button>
                                                </div>
                                            </div>
                                            
                                            <div className={styles.historyChanges}>
                                                {changes.map((change, cmdIdx) => (
                                                    <div key={cmdIdx} className={styles.historyChangeItem}>
                                                        <div className={styles.historyChangeRow}>
                                                            <span className={styles.forwardCommand}>{change.forward}</span>
                                                            <button 
                                                                onClick={() => onRemoveHistoryBlock(actualIndex)}
                                                                className={styles.historyDeleteBtn}
                                                                title="Удалить"
                                                            >
                                                                X
                                                            </button>
                                                        </div>
                                                        <button 
                                                            onClick={() => copyToClipboard(change.forward)}
                                                            className={styles.copyForwardSmallBtn}
                                                        >
                                                            Copy Forward
                                                        </button>
                                                        
                                                        <div className={styles.revertRow}>
                                                            <span className={styles.revertLabel}>Revert:</span>
                                                            <span className={styles.revertCommand}>{change.revert}</span>
                                                        </div>
                                                        <button 
                                                            onClick={() => copyToClipboard(change.revert)}
                                                            className={styles.copyRevertSmallBtn}
                                                        >
                                                            Copy Revert
                                                        </button>
                                                        
                                                        <div className={styles.changeInfo}>
                                                            ( {change.paramName}: "{change.oldVal}" =&gt; "{change.newVal}" )
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                                <button 
                                    onClick={onClearHistory}
                                    className={styles.clearHistoryBtn}
                                >
                                    <FiTrash2 /> Очистить историю
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Секция выбора серверов */}
            {servers.length > 0 && (
                <div className={styles.serverSendSection}>
                    <div 
                        className={styles.serverSendHeader}
                        onClick={() => setIsServerSelectorOpen(!isServerSelectorOpen)}
                    >
                        <div className={styles.serverSendTitle}>
                            <FiServer className={styles.serverIcon} />
                            <span>Выбор серверов</span>
                            <span className={styles.serverCount}>
                                ({selectedSendServers.length} из {servers.length})
                            </span>
                        </div>
                        <button className={styles.toggleBtn}>
                            {isServerSelectorOpen ? <FiChevronUp /> : <FiChevronDown />}
                        </button>
                    </div>

                    {isServerSelectorOpen && (
                        <div className={styles.serverSendBody}>
                            {/* Поиск и быстрые действия */}
                            <div className={styles.serverControls}>
                                <div className={styles.serverSearchBox}>
                                    <FiSearch className={styles.searchIcon} />
                                    <input
                                        type="text"
                                        placeholder="Поиск серверов..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className={styles.serverSearchInput}
                                    />
                                </div>
                                <div className={styles.quickSelectBtns}>
                                    <button 
                                        onClick={selectAllServers} 
                                        className={styles.quickSelectBtn}
                                        title="Выбрать все"
                                    >
                                        <FiCheck /> Все
                                    </button>
                                    <button 
                                        onClick={deselectAllServers} 
                                        className={styles.quickSelectBtn}
                                        title="Снять выбор"
                                    >
                                        <FiX /> Сбросить
                                    </button>
                                </div>
                            </div>

                            {/* Список серверов по группам */}
                            <div className={styles.serverCheckboxList}>
                                {Object.entries(filteredGroupedServers).map(([groupName, groupServers]) => {
                                    const isFullySelected = isGroupFullySelected(groupServers);
                                    const isPartially = isGroupPartiallySelected(groupServers);
                                    const selectedCount = groupServers.filter(s => selectedSendServers.includes(s.id)).length;

                                    return (
                                        <div key={groupName} className={styles.serverGroup}>
                                            {/* Заголовок группы */}
                                            <label className={styles.groupHeader}>
                                                <input
                                                    type="checkbox"
                                                    checked={isFullySelected}
                                                    ref={el => {
                                                        if (el) el.indeterminate = isPartially && !isFullySelected;
                                                    }}
                                                    onChange={() => toggleGroup(groupServers)}
                                                    className={styles.groupCheckbox}
                                                />
                                                <span className={styles.groupName}>{groupName}</span>
                                                <span className={styles.groupCount}>
                                                    {selectedCount}/{groupServers.length}
                                                </span>
                                            </label>

                                            {/* Серверы в группе */}
                                            <div className={styles.serverItems}>
                                                {groupServers.map(server => (
                                                    <label key={server.id} className={styles.serverItem}>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedSendServers.includes(server.id)}
                                                            onChange={() => toggleServer(server.id)}
                                                            className={styles.serverCheckbox}
                                                        />
                                                        <span className={styles.serverName}>{server.name}</span>
                                                        <span className={styles.serverHost}>
                                                            {server.host}:{server.port}
                                                        </span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}

                                {Object.keys(filteredGroupedServers).length === 0 && (
                                    <div className={styles.noServersFound}>
                                        Серверы не найдены
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Результат отправки */}
            {sendResult && (
                <div className={`${styles.sendResult} ${styles[sendResult.status]}`}>
                    <div className={styles.sendResultHeader}>
                        {sendResult.status === 'success' ? (
                            <><FiCheck /> Команды отправлены</>
                        ) : sendResult.status === 'partial' ? (
                            <><FiMessageCircle /> Частично выполнено</>
                        ) : (
                            <><FiX /> Ошибка отправки</>
                        )}
                        <button 
                            className={styles.closeResultBtn}
                            onClick={() => setSendResult(null)}
                            title="Закрыть"
                        >
                            <FiX />
                        </button>
                    </div>
                    {sendResult.summary && (
                        <div className={styles.sendResultSummary}>
                            Успешно: {sendResult.summary.successful} | 
                            Ошибок: {sendResult.summary.failed} | 
                            Серверов: {sendResult.summary.servers}
                        </div>
                    )}
                    {sendResult.message && (
                        <div className={styles.sendResultMessage}>{sendResult.message}</div>
                    )}
                    
                    {/* Детальные ответы от ботов */}
                    {sendResult.results && sendResult.results.length > 0 && (
                        <div className={styles.sendResultDetails}>
                            <div className={styles.sendResultDetailsHeader}>
                                <FiMessageCircle /> Ответы от ботов:
                            </div>
                            <div className={styles.sendResultList}>
                                {sendResult.results.map((result, index) => (
                                    <div 
                                        key={index} 
                                        className={`${styles.sendResultItem} ${styles[result.status]}`}
                                    >
                                        <div className={styles.sendResultItemHeader}>
                                            <span className={styles.sendResultServerName}>
                                                {result.status === 'success' ? <FiCheck /> : <FiX />}
                                                {result.server_name}
                                            </span>
                                            <span className={styles.sendResultCommand}>
                                                {result.command}
                                            </span>
                                        </div>
                                        <div className={styles.sendResultResponse}>
                                            {result.response || 'Нет ответа'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default CommandSendSection;
