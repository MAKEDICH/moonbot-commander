import React from 'react';
import { FiServer, FiSearch } from 'react-icons/fi';
import styles from '../../pages/CommandsNew.module.css';

/**
 * Компонент выбора серверов с группировкой и чекбоксами
 */
const ServerSelector = ({
  servers,
  selectedServers,
  searchQuery,
  setSearchQuery,
  selectedGroup,
  setSelectedGroup,
  groups,
  toggleServerSelection,
  selectAll,
  deselectAll,
  getGroupedServers,
  isGroupFullySelected,
  isGroupPartiallySelected,
  toggleGroupSelection
}) => {
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

  const groupedServers = getGroupedServers(filteredServers);

  return (
    <div className={styles.serverSelectorCompact}>
      <div className={styles.selectorHeader}>
        <h3><FiServer /> Выбор серверов</h3>
        <div className={styles.selectorStats}>
          Выбрано: <strong>{selectedServers.length}</strong> из {servers.length}
        </div>
      </div>

      <div className={styles.selectorControls}>
        <div className={styles.searchBox}>
          <FiSearch className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Поиск по имени, IP, группе..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <select 
          value={selectedGroup} 
          onChange={(e) => setSelectedGroup(e.target.value)}
          className={styles.select}
        >
          <option value="all">Все группы</option>
          <option value="">Без группы</option>
          {groups.map(group => (
            <option key={group} value={group}>{group}</option>
          ))}
        </select>

        <div className={styles.quickActions}>
          <button onClick={selectAll} className={styles.miniBtn}>✓ Все</button>
          <button onClick={deselectAll} className={styles.miniBtn}>✗ Сбросить</button>
        </div>
      </div>

      <div className={styles.serverCheckboxList}>
        {Object.entries(groupedServers).map(([groupName, groupServers]) => {
          const isFullySelected = isGroupFullySelected(groupName, servers, selectedServers);
          const isPartiallySelected = isGroupPartiallySelected(groupName, servers, selectedServers);
          const selectedCount = groupServers.filter(s => selectedServers.includes(s.id)).length;

          return (
            <div key={groupName} className={styles.checkboxGroup}>
              {/* Чекбокс группы */}
              <label className={styles.checkboxItem}>
                <input
                  type="checkbox"
                  checked={isFullySelected}
                  ref={el => {
                    if (el) el.indeterminate = isPartiallySelected && !isFullySelected;
                  }}
                  onChange={() => toggleGroupSelection(groupName)}
                  className={styles.checkboxInput}
                />
                <span className={styles.checkboxLabel}>
                  <strong>{groupName === '' ? 'БЕЗ ГРУППЫ' : groupName}</strong> 
                  <span className={styles.checkboxCount}>({selectedCount}/{groupServers.length})</span>
                </span>
              </label>

              {/* Чекбоксы серверов */}
              <div className={styles.checkboxServers}>
                {groupServers.map(server => {
                  const isSelected = selectedServers.includes(server.id);
                  return (
                    <label key={server.id} className={styles.checkboxItem}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleServerSelection(server.id)}
                        className={styles.checkboxInput}
                      />
                      <span className={styles.checkboxLabel}>
                        {server.name} 
                        <span className={styles.checkboxDetails}>({server.host}:{server.port})</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ServerSelector;





