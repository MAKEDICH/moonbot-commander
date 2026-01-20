import React from 'react';
import { FiEdit2, FiTrash2, FiX, FiMove, FiChevronDown, FiChevronRight } from 'react-icons/fi';
import { serversAPI } from '../../api/api';
import styles from '../../pages/Groups.module.css';

const GroupCard = ({
  group,
  isExpanded,
  onToggleExpanded,
  onRename,
  onDelete,
  onLoadServers,
  onSaveEmptyGroups,
  showError
}) => {
  const handleRemoveServerFromGroup = async (server) => {
    const serverGroups = server.group_name.split(',').map(g => g.trim());
    const updatedGroups = serverGroups.filter(g => g !== group.name);
    
    try {
      const { password, ...serverWithoutPassword } = server;
      await serversAPI.update(server.id, {
        ...serverWithoutPassword,
        group_name: updatedGroups.length > 0 ? updatedGroups.join(', ') : null
      });
      
      const remainingServersInGroup = group.servers.filter(s => s.id !== server.id);
      
      if (remainingServersInGroup.length === 0) {
        const storedEmptyGroups = JSON.parse(localStorage.getItem('emptyGroups') || '[]');
        if (!storedEmptyGroups.includes(group.name)) {
          const updatedEmptyGroups = [...storedEmptyGroups, group.name];
          onSaveEmptyGroups(updatedEmptyGroups);
        }
      }
      
      await onLoadServers();
    } catch (error) {
      console.error('Error removing server from group:', error);
      showError('Ошибка удаления сервера из группы');
    }
  };

  return (
    <div className={styles.groupCard}>
      <div 
        className={styles.groupHeader}
        onClick={onToggleExpanded}
        style={{ cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
          {isExpanded ? <FiChevronDown /> : <FiChevronRight />}
          <div>
            <h3>{group.name}</h3>
            <span className={styles.groupCount}>
              {group.servers.length} {group.servers.length === 1 ? 'сервер' : group.servers.length < 5 ? 'сервера' : 'серверов'}
            </span>
          </div>
        </div>
        <div className={styles.groupActions} onClick={(e) => e.stopPropagation()}>
          <button
            className={styles.iconBtn}
            onClick={onRename}
            title="Переименовать"
          >
            <FiEdit2 />
          </button>
          <button
            className={styles.iconBtn}
            onClick={onDelete}
            title="Удалить группу"
          >
            <FiTrash2 />
          </button>
        </div>
      </div>
      
      {isExpanded && (
        <div className={styles.serversList}>
          {group.servers.map(server => (
            <div key={server.id} className={styles.serverItem}>
              <div className={styles.serverInfo}>
                <div className={styles.serverName}>
                  {server.name}
                  {!server.is_active && <span className={styles.inactive}> (отключен)</span>}
                </div>
                <div className={styles.serverHost}>{server.host}:{server.port}</div>
              </div>
              <div className={styles.serverActions}>
                <button
                  className={styles.smallBtn}
                  onClick={() => handleRemoveServerFromGroup(server)}
                  title="Удалить из этой группы"
                  style={{ color: 'var(--error)' }}
                >
                  <FiX />
                </button>
                <button
                  className={styles.smallBtn}
                  onClick={() => window.location.href = `/servers/${server.id}`}
                  title="Настройки сервера"
                >
                  <FiMove />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GroupCard;



