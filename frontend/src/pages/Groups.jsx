import React, { useState, useEffect } from 'react';
import { FiUsers, FiPlus, FiEdit2, FiTrash2, FiMove, FiCheck, FiX } from 'react-icons/fi';
import { serversAPI, groupsAPI } from '../api/api';
import styles from './Groups.module.css';

const Groups = () => {
  const [servers, setServers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [editingGroupName, setEditingGroupName] = useState('');
  const [selectedServers, setSelectedServers] = useState([]);
  const [targetGroup, setTargetGroup] = useState('');

  useEffect(() => {
    loadServers();
    loadGroups();
  }, []);

  const loadServers = async () => {
    try {
      const response = await serversAPI.getAll();
      setServers(response.data);
    } catch (error) {
      console.error('Error loading servers:', error);
    }
  };

  const loadGroups = async () => {
    try {
      const response = await groupsAPI.getAll();
      const groupNames = response.data.groups || [];
      
      // Добавляем статистику по каждой группе
      const groupsWithStats = groupNames.map(name => {
        const serversInGroup = servers.filter(s => s.group_name === name);
        return {
          name,
          count: serversInGroup.length,
          servers: serversInGroup
        };
      });
      
      setGroups(groupsWithStats);
    } catch (error) {
      console.error('Error loading groups:', error);
    }
  };

  useEffect(() => {
    if (servers.length > 0) {
      loadGroups();
    }
  }, [servers]);

  const getGroupServers = (groupName) => {
    return servers.filter(s => s.group_name === groupName);
  };

  const getServersWithoutGroup = () => {
    return servers.filter(s => !s.group_name);
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    
    if (groups.length >= 200) {
      alert('Достигнут лимит: максимум 200 групп');
      return;
    }

    // Группа создастся автоматически когда добавим первый сервер
    setShowCreateModal(false);
    setNewGroupName('');
    
    // Открываем модальное окно для добавления серверов
    setTargetGroup(newGroupName.trim());
    setShowMoveModal(true);
  };

  const handleRenameGroup = async (oldName, newName) => {
    if (!newName.trim() || oldName === newName) return;

    try {
      // Переименовываем группу у всех серверов
      const serversToUpdate = servers.filter(s => s.group_name === oldName);
      
      for (const server of serversToUpdate) {
        await serversAPI.update(server.id, {
          ...server,
          group_name: newName.trim()
        });
      }

      await loadServers();
      alert('Группа переименована');
    } catch (error) {
      console.error('Error renaming group:', error);
      alert('Ошибка переименования группы');
    }
  };

  const handleDeleteGroup = async (groupName) => {
    if (!confirm(`Удалить группу "${groupName}"? Серверы останутся, но будут без группы.`)) {
      return;
    }

    try {
      const serversToUpdate = servers.filter(s => s.group_name === groupName);
      
      for (const server of serversToUpdate) {
        await serversAPI.update(server.id, {
          ...server,
          group_name: null
        });
      }

      await loadServers();
      alert('Группа удалена');
    } catch (error) {
      console.error('Error deleting group:', error);
      alert('Ошибка удаления группы');
    }
  };

  const handleMoveServers = async () => {
    if (selectedServers.length === 0 || !targetGroup.trim()) return;

    const targetGroupServers = getGroupServers(targetGroup);
    const newCount = targetGroupServers.length + selectedServers.length;

    if (newCount > 50) {
      alert(`В группе может быть максимум 50 серверов. Сейчас: ${targetGroupServers.length}, пытаетесь добавить: ${selectedServers.length}`);
      return;
    }

    if (newCount < 3 && targetGroup !== '') {
      alert('В группе должно быть минимум 3 сервера');
      return;
    }

    try {
      for (const serverId of selectedServers) {
        const server = servers.find(s => s.id === serverId);
        if (server) {
          await serversAPI.update(serverId, {
            ...server,
            group_name: targetGroup.trim() || null
          });
        }
      }

      await loadServers();
      setShowMoveModal(false);
      setSelectedServers([]);
      setTargetGroup('');
      alert('Серверы перемещены');
    } catch (error) {
      console.error('Error moving servers:', error);
      alert('Ошибка перемещения серверов');
    }
  };

  const toggleServerSelection = (serverId) => {
    setSelectedServers(prev => 
      prev.includes(serverId) 
        ? prev.filter(id => id !== serverId)
        : [...prev, serverId]
    );
  };

  const groupedServers = groups.map(group => ({
    ...group,
    servers: getGroupServers(group.name)
  }));

  const serversWithoutGroup = getServersWithoutGroup();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1><FiUsers /> Управление группами</h1>
          <p className={styles.subtitle}>
            Группы: {groups.length}/200 • Серверов: {servers.length}
          </p>
        </div>
        <button 
          className={styles.createBtn}
          onClick={() => setShowCreateModal(true)}
          disabled={groups.length >= 200}
        >
          <FiPlus /> Создать группу
        </button>
      </div>

      <div className={styles.content}>
        {/* Серверы без группы */}
        {serversWithoutGroup.length > 0 && (
          <div className={styles.groupCard}>
            <div className={styles.groupHeader}>
              <div>
                <h3>Без группы</h3>
                <span className={styles.groupCount}>{serversWithoutGroup.length} серверов</span>
              </div>
              <button
                className={styles.moveBtn}
                onClick={() => {
                  setSelectedServers(serversWithoutGroup.map(s => s.id));
                  setShowMoveModal(true);
                }}
              >
                <FiMove /> Переместить в группу
              </button>
            </div>
            <div className={styles.serversList}>
              {serversWithoutGroup.map(server => (
                <div key={server.id} className={styles.serverItem}>
                  <div className={styles.serverInfo}>
                    <div className={styles.serverName}>{server.name}</div>
                    <div className={styles.serverHost}>{server.host}:{server.port}</div>
                  </div>
                  <button
                    className={styles.smallBtn}
                    onClick={() => {
                      setSelectedServers([server.id]);
                      setShowMoveModal(true);
                    }}
                  >
                    <FiMove />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Группы */}
        {groupedServers.map(group => (
          <div key={group.name} className={styles.groupCard}>
            <div className={styles.groupHeader}>
              <div>
                <h3>{group.name}</h3>
                <span className={styles.groupCount}>
                  {group.servers.length} серверов (мин: 3, макс: 50)
                </span>
              </div>
              <div className={styles.groupActions}>
                <button
                  className={styles.iconBtn}
                  onClick={() => {
                    const newName = prompt('Новое название группы:', group.name);
                    if (newName) handleRenameGroup(group.name, newName);
                  }}
                  title="Переименовать"
                >
                  <FiEdit2 />
                </button>
                <button
                  className={styles.iconBtn}
                  onClick={() => handleDeleteGroup(group.name)}
                  title="Удалить группу"
                >
                  <FiTrash2 />
                </button>
              </div>
            </div>
            
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
                  <button
                    className={styles.smallBtn}
                    onClick={() => {
                      setSelectedServers([server.id]);
                      setTargetGroup('');
                      setShowMoveModal(true);
                    }}
                    title="Переместить в другую группу"
                  >
                    <FiMove />
                  </button>
                </div>
              ))}
            </div>

            <button
              className={styles.addToGroupBtn}
              onClick={() => {
                if (group.servers.length >= 50) {
                  alert('В группе может быть максимум 50 серверов');
                  return;
                }
                setTargetGroup(group.name);
                setShowMoveModal(true);
              }}
              disabled={group.servers.length >= 50}
            >
              <FiPlus /> Добавить серверы в группу
            </button>
          </div>
        ))}

        {groups.length === 0 && serversWithoutGroup.length === 0 && (
          <div className={styles.empty}>
            <FiUsers size={48} />
            <p>Нет групп и серверов</p>
            <p className={styles.emptyHint}>Создайте группу или добавьте серверы</p>
          </div>
        )}
      </div>

      {/* Модальное окно создания группы */}
      {showCreateModal && (
        <div 
          className={styles.modal}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              e.preventDefault();
              setShowCreateModal(false);
            }
          }}
        >
          <div className={styles.modalContent}>
            <h2>Создать новую группу</h2>
            <div className={styles.formGroup}>
              <label>Название группы</label>
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Например: Production Bots"
                className={styles.input}
                autoFocus
              />
            </div>
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setShowCreateModal(false)}>
                Отмена
              </button>
              <button 
                className={styles.saveBtn} 
                onClick={handleCreateGroup}
                disabled={!newGroupName.trim()}
              >
                Создать и добавить серверы
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно перемещения серверов */}
      {showMoveModal && (
        <div 
          className={styles.modal}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              e.preventDefault();
              setShowMoveModal(false);
            }
          }}
        >
          <div className={styles.modalContent}>
            <h2>Переместить серверы</h2>
            
            <div className={styles.formGroup}>
              <label>Целевая группа</label>
              <select
                value={targetGroup}
                onChange={(e) => setTargetGroup(e.target.value)}
                className={styles.input}
              >
                <option value="">Без группы</option>
                {groups.map(g => (
                  <option key={g.name} value={g.name}>
                    {g.name} ({g.servers.length}/50)
                  </option>
                ))}
              </select>
              <small>Или введите название новой группы:</small>
              <input
                type="text"
                value={targetGroup}
                onChange={(e) => setTargetGroup(e.target.value)}
                placeholder="Новая группа"
                className={styles.input}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Выберите серверы ({selectedServers.length} выбрано)</label>
              <div className={styles.serverSelectList}>
                {servers
                  .filter(s => !targetGroup || s.group_name !== targetGroup)
                  .map(server => (
                    <div
                      key={server.id}
                      className={`${styles.serverSelectItem} ${selectedServers.includes(server.id) ? styles.selected : ''}`}
                      onClick={() => toggleServerSelection(server.id)}
                    >
                      <div className={styles.checkbox}>
                        {selectedServers.includes(server.id) ? <FiCheck /> : <div className={styles.emptyCheckbox} />}
                      </div>
                      <div className={styles.serverInfo}>
                        <div className={styles.serverName}>{server.name}</div>
                        <div className={styles.serverHost}>
                          {server.host}:{server.port}
                          {server.group_name && ` • ${server.group_name}`}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div className={styles.modalActions}>
              <button 
                className={styles.cancelBtn} 
                onClick={() => {
                  setShowMoveModal(false);
                  setSelectedServers([]);
                  setTargetGroup('');
                }}
              >
                Отмена
              </button>
              <button 
                className={styles.saveBtn} 
                onClick={handleMoveServers}
                disabled={selectedServers.length === 0}
              >
                Переместить ({selectedServers.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Groups;





