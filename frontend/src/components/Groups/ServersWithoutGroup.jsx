import React from 'react';
import { FiCheck, FiMove } from 'react-icons/fi';
import styles from '../../pages/Groups.module.css';

const ServersWithoutGroup = ({ 
  servers, 
  selectedServers, 
  onToggleServerSelection,
  onToggleSelectAll,
  onShowMoveModal 
}) => {
  if (servers.length === 0) return null;

  const allIds = servers.map(s => s.id);
  const allSelected = allIds.every(id => selectedServers.includes(id));
  const selectedCount = selectedServers.filter(id => servers.find(s => s.id === id)).length;

  return (
    <div className={styles.groupCard}>
      <div className={styles.groupHeader}>
        <div className={styles.groupTitleWithCheckbox}>
          <div 
            className={styles.groupCheckbox}
            onClick={() => onToggleSelectAll(allIds)}
          >
            {allSelected ? (
              <FiCheck className={styles.checkIcon} />
            ) : (
              <div className={styles.emptyCheckbox} />
            )}
          </div>
          <div>
            <h3>Без группы</h3>
            <span className={styles.groupCount}>{servers.length} серверов</span>
          </div>
        </div>
        <button
          className={styles.moveBtn}
          onClick={onShowMoveModal}
          disabled={selectedServers.length === 0}
        >
          <FiMove /> Добавить в группу ({selectedCount})
        </button>
      </div>
      <div className={styles.serversList}>
        {servers.map(server => (
          <div key={server.id} className={styles.serverItem}>
            <div 
              className={styles.serverCheckbox}
              onClick={() => onToggleServerSelection(server.id)}
            >
              {selectedServers.includes(server.id) ? (
                <FiCheck className={styles.checkIcon} />
              ) : (
                <div className={styles.emptyCheckbox} />
              )}
            </div>
            <div className={styles.serverInfo}>
              <div className={styles.serverName}>{server.name}</div>
              <div className={styles.serverHost}>{server.host}:{server.port}</div>
            </div>
            <button
              className={styles.smallBtn}
              onClick={() => {
                onToggleServerSelection(server.id, true);
                onShowMoveModal();
              }}
            >
              <FiMove />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ServersWithoutGroup;



