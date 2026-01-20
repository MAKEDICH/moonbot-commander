import React, { useState, useMemo } from 'react';
import { FiCopy, FiTrash2, FiSave, FiSend, FiServer, FiCheck, FiX, FiSearch, FiChevronDown, FiChevronUp, FiLoader, FiMessageCircle } from 'react-icons/fi';
import styles from '../../pages/StrategyCommander.module.css';

/**
 * Компонент пака команд с возможностью отправки на выбранные серверы
 * 
 * Включает:
 * - Отображение сформированных команд
 * - Выбор серверов для отправки (чекбоксы)
 * - Кнопки копирования, очистки, сохранения и отправки
 */
const CommandsPack = ({ 
  commandPack, 
  parsedItems,
  servers = [],
  selectedSendServers = [],
  setSelectedSendServers,
  onCopy,
  onClear,
  onSave,
  onSend,
  isSending = false,
  sendResult = null
}) => {
  const [isServerSelectorOpen, setIsServerSelectorOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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

  if (parsedItems.length === 0) return null;

  const hasCommands = commandPack && commandPack.trim().length > 0;
  const canSend = hasCommands && selectedSendServers.length > 0 && !isSending;

  return (
    <div className={styles.commandsContainer}>
      <h3>Пак команд (текущие изменения)</h3>
      
      <textarea
        className={styles.commandPackTextarea}
        value={commandPack}
        readOnly
        placeholder="Измените параметры в таблице выше, чтобы сформировать команды..."
      />
      
      {/* Секция выбора серверов */}
      {hasCommands && servers.length > 0 && (
        <div className={styles.serverSendSection}>
          <div 
            className={styles.serverSendHeader}
            onClick={() => setIsServerSelectorOpen(!isServerSelectorOpen)}
          >
            <div className={styles.serverSendTitle}>
              <FiServer className={styles.serverIcon} />
              <span>Отправить на серверы</span>
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

      {/* Кнопки действий */}
      <div className={styles.commandsActions}>
        <button 
          type="button"
          className={styles.copyBtn} 
          onClick={onCopy}
          disabled={!hasCommands}
        >
          <FiCopy /> Скопировать
        </button>
        <button 
          type="button"
          className={styles.clearBtn} 
          onClick={onClear}
          disabled={!hasCommands}
        >
          <FiTrash2 /> Очистить
        </button>
        <button 
          type="button"
          className={styles.saveBtn} 
          onClick={onSave}
          disabled={!hasCommands}
        >
          <FiSave /> Сохранить
        </button>
        
        {servers.length > 0 && (
          <button 
            type="button"
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
        )}
      </div>
    </div>
  );
};

export default CommandsPack;
