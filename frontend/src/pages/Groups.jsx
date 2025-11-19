import React, { useState, useEffect } from 'react';
import { FiUsers, FiPlus, FiEdit2, FiTrash2, FiMove, FiCheck, FiX, FiChevronDown, FiChevronRight } from 'react-icons/fi';
import { serversAPI, groupsAPI } from '../api/api';
import styles from './Groups.module.css';
import { useNotification } from '../context/NotificationContext';

const Groups = () => {
  const { showError } = useNotification();
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
  const [emptyGroups, setEmptyGroups] = useState([]); // Пустые группы из localStorage
  const [expandedGroups, setExpandedGroups] = useState(new Set()); // Для accordion
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [renamingGroup, setRenamingGroup] = useState(null);
  const [newRenameValue, setNewRenameValue] = useState('');
  const [deletingGroup, setDeletingGroup] = useState(null);

  useEffect(() => {
    loadServers();
    loadGroups();
    loadEmptyGroups();
  }, []);

  const loadEmptyGroups = () => {
    const stored = JSON.parse(localStorage.getItem('emptyGroups') || '[]');
    setEmptyGroups(stored);
  };

  const saveEmptyGroups = (groups) => {
    localStorage.setItem('emptyGroups', JSON.stringify(groups));
    setEmptyGroups(groups);
  };

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
      
      // Загружаем актуальные пустые группы из localStorage
      const storedEmptyGroups = JSON.parse(localStorage.getItem('emptyGroups') || '[]');
      
      // Объединяем группы из API и пустые группы из localStorage
      const allGroupNames = [...new Set([...groupNames, ...storedEmptyGroups])];
      
      // Просто сохраняем имена групп, статистика будет вычисляться позже
      setGroups(allGroupNames.map(name => ({ name, count: 0, servers: [] })));
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
    return servers.filter(s => {
      if (!s.group_name) return false;
      const serverGroups = s.group_name.split(',').map(g => g.trim());
      return serverGroups.includes(groupName);
    });
  };

  const getServersWithoutGroup = () => {
    return servers.filter(s => !s.group_name);
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    
    if (groups.length >= 200) {
      return;
    }

    try {
      // Если серверы выбраны - добавляем их в группу
      if (selectedServers.length > 0) {
        for (const serverId of selectedServers) {
          const server = servers.find(s => s.id === serverId);
          if (server) {
            let updatedGroupName;
            if (server.group_name) {
              const existingGroups = server.group_name.split(',').map(g => g.trim());
              if (!existingGroups.includes(newGroupName.trim())) {
                updatedGroupName = [...existingGroups, newGroupName.trim()].join(', ');
              } else {
                updatedGroupName = server.group_name;
              }
            } else {
              updatedGroupName = newGroupName.trim();
            }
            
            // FIXED: Remove password to avoid re-encryption
            const { password, ...serverWithoutPassword } = server;
            await serversAPI.update(serverId, {
              ...serverWithoutPassword,
              group_name: updatedGroupName
            });
          }
        }
        await loadServers();
      } else {
        // Если серверы не выбраны - создаём пустую группу в localStorage
        const updatedEmptyGroups = [...emptyGroups, newGroupName.trim()];
        saveEmptyGroups(updatedEmptyGroups);
        await loadGroups();
      }
      
      setShowCreateModal(false);
      setNewGroupName('');
      setSelectedServers([]);
    } catch (error) {
      console.error('Error creating group:', error);
      showError('Ошибка создания группы');
    }
  };

  const handleRenameGroup = async (oldName, newName) => {
    if (!newName.trim() || oldName === newName) return;

    try {
      // Переименовываем группу у всех серверов (в их comma-separated строках)
      const serversToUpdate = servers.filter(s => {
        if (!s.group_name) return false;
        const serverGroups = s.group_name.split(',').map(g => g.trim());
        return serverGroups.includes(oldName);
      });
      
      for (const server of serversToUpdate) {
        const serverGroups = server.group_name.split(',').map(g => g.trim());
        const updatedGroups = serverGroups.map(g => g === oldName ? newName.trim() : g);
        // FIXED: Remove password to avoid re-encryption
        const { password, ...serverWithoutPassword } = server;
        await serversAPI.update(server.id, {
          ...serverWithoutPassword,
          group_name: updatedGroups.join(', ')
        });
      }

      // Переименовываем в emptyGroups если есть
      if (emptyGroups.includes(oldName)) {
        const updatedEmptyGroups = emptyGroups.map(g => g === oldName ? newName.trim() : g);
        saveEmptyGroups(updatedEmptyGroups);
      }

      await loadServers();
      setShowRenameModal(false);
      setRenamingGroup(null);
      setNewRenameValue('');
    } catch (error) {
      console.error('Error renaming group:', error);
      showError('Ошибка переименования группы');
    }
  };

  const handleDeleteGroup = async () => {
    if (!deletingGroup) return;
    
    const groupServers = getGroupServers(deletingGroup);
    
    try {
      if (groupServers.length === 0) {
        // Пустая группа - удаляем только из localStorage
        const updatedEmptyGroups = emptyGroups.filter(g => g !== deletingGroup);
        saveEmptyGroups(updatedEmptyGroups);
        await loadGroups();
      } else {
        // Группа с серверами - удаляем из group_name серверов
        const serversToUpdate = servers.filter(s => {
          if (!s.group_name) return false;
          const serverGroups = s.group_name.split(',').map(g => g.trim());
          return serverGroups.includes(deletingGroup);
        });
        
        for (const server of serversToUpdate) {
          const serverGroups = server.group_name.split(',').map(g => g.trim());
          const updatedGroups = serverGroups.filter(g => g !== deletingGroup);
          
          // FIXED: Remove password to avoid re-encryption
          const { password, ...serverWithoutPassword } = server;
          await serversAPI.update(server.id, {
            ...serverWithoutPassword,
            group_name: updatedGroups.length > 0 ? updatedGroups.join(', ') : null
          });
        }

        // Удаляем из emptyGroups если есть
        if (emptyGroups.includes(deletingGroup)) {
          const updatedEmptyGroups = emptyGroups.filter(g => g !== deletingGroup);
          saveEmptyGroups(updatedEmptyGroups);
        }

        await loadServers();
      }
      
      setShowDeleteModal(false);
      setDeletingGroup(null);
    } catch (error) {
      console.error('Error deleting group:', error);
      showError('Ошибка удаления группы');
    }
  };

  const handleMoveServers = async () => {
    if (selectedServers.length === 0 || !targetGroup.trim()) return;

    try {
      for (const serverId of selectedServers) {
        const server = servers.find(s => s.id === serverId);
        if (server) {
          // ДОБАВЛЯЕМ группу к существующим, а не заменяем
          let updatedGroupName;
          if (server.group_name) {
            const existingGroups = server.group_name.split(',').map(g => g.trim());
            if (!existingGroups.includes(targetGroup.trim())) {
              updatedGroupName = [...existingGroups, targetGroup.trim()].join(', ');
            } else {
              updatedGroupName = server.group_name; // Группа уже есть
            }
          } else {
            updatedGroupName = targetGroup.trim();
          }
          
          // FIXED: Remove password to avoid re-encryption
          const { password, ...serverWithoutPassword } = server;
          await serversAPI.update(serverId, {
            ...serverWithoutPassword,
            group_name: updatedGroupName
          });
        }
      }

      // Если это была пустая группа, удаляем её из localStorage
      if (emptyGroups.includes(targetGroup.trim())) {
        const updatedEmptyGroups = emptyGroups.filter(g => g !== targetGroup.trim());
        saveEmptyGroups(updatedEmptyGroups);
      }

      await loadServers();
      setShowMoveModal(false);
      setSelectedServers([]);
      setTargetGroup('');
    } catch (error) {
      console.error('Error moving servers:', error);
      showError('Ошибка добавления серверов');
    }
  };

  const toggleServerSelection = (serverId) => {
    setSelectedServers(prev => 
      prev.includes(serverId) 
        ? prev.filter(id => id !== serverId)
        : [...prev, serverId]
    );
  };

  const toggleGroupExpanded = (groupName) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupName)) {
        newSet.delete(groupName);
      } else {
        newSet.add(groupName);
      }
      return newSet;
    });
  };

  // ИСПРАВЛЕНО: Добавлена функция для выбора всех серверов в модальном окне
  const toggleSelectAll = () => {
    const availableServers = servers.filter(s => !targetGroup || s.group_name !== targetGroup);
    
    if (selectedServers.length === availableServers.length) {
      // Если все выбраны - снять выбор
      setSelectedServers([]);
    } else {
      // Выбрать все доступные
      setSelectedServers(availableServers.map(s => s.id));
    }
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
              <div className={styles.groupTitleWithCheckbox}>
                {/* ИСПРАВЛЕНО: Добавлен чекбокс для выбора всех серверов БЕЗ ГРУППЫ */}
                <div 
                  className={styles.groupCheckbox}
                  onClick={() => {
                    const allIds = serversWithoutGroup.map(s => s.id);
                    const allSelected = allIds.every(id => selectedServers.includes(id));
                    
                    if (allSelected) {
                      // Снять выбор со всех серверов этой группы
                      setSelectedServers(prev => prev.filter(id => !allIds.includes(id)));
                    } else {
                      // Выбрать все сервера этой группы
                      setSelectedServers(prev => [...new Set([...prev, ...allIds])]);
                    }
                  }}
                >
                  {serversWithoutGroup.every(s => selectedServers.includes(s.id)) ? (
                    <FiCheck className={styles.checkIcon} />
                  ) : (
                    <div className={styles.emptyCheckbox} />
                  )}
                </div>
                <div>
                  <h3>Без группы</h3>
                  <span className={styles.groupCount}>{serversWithoutGroup.length} серверов</span>
                </div>
              </div>
              <button
                className={styles.moveBtn}
                onClick={() => {
                  setShowMoveModal(true);
                }}
                disabled={selectedServers.length === 0}
              >
                <FiMove /> Добавить в группу ({selectedServers.filter(id => serversWithoutGroup.find(s => s.id === id)).length})
              </button>
            </div>
            <div className={styles.serversList}>
              {serversWithoutGroup.map(server => (
                <div key={server.id} className={styles.serverItem}>
                  <div 
                    className={styles.serverCheckbox}
                    onClick={() => toggleServerSelection(server.id)}
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
        {groupedServers.map(group => {
          const isExpanded = expandedGroups.has(group.name);
          
          return (
          <div key={group.name} className={styles.groupCard}>
            <div 
              className={styles.groupHeader}
              onClick={() => toggleGroupExpanded(group.name)}
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
                  onClick={() => {
                    setRenamingGroup(group.name);
                    setNewRenameValue(group.name);
                    setShowRenameModal(true);
                  }}
                  title="Переименовать"
                >
                  <FiEdit2 />
                </button>
                <button
                  className={styles.iconBtn}
                  onClick={() => {
                    setDeletingGroup(group.name);
                    setShowDeleteModal(true);
                  }}
                  title="Удалить группу"
                >
                  <FiTrash2 />
                </button>
              </div>
            </div>
            
            {isExpanded && (
              <>
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
                          onClick={async () => {
                            // Удаляем сервер из текущей группы
                            const serverGroups = server.group_name.split(',').map(g => g.trim());
                            const updatedGroups = serverGroups.filter(g => g !== group.name);
                            
                            try {
                              // FIXED: Remove password to avoid re-encryption
                              const { password, ...serverWithoutPassword } = server;
                              await serversAPI.update(server.id, {
                                ...serverWithoutPassword,
                                group_name: updatedGroups.length > 0 ? updatedGroups.join(', ') : null
                              });
                              
                              // Проверяем, был ли это последний сервер в группе
                              const remainingServersInGroup = group.servers.filter(s => s.id !== server.id);
                              
                              // Если это последний сервер, добавляем группу в emptyGroups
                              if (remainingServersInGroup.length === 0) {
                                const storedEmptyGroups = JSON.parse(localStorage.getItem('emptyGroups') || '[]');
                                if (!storedEmptyGroups.includes(group.name)) {
                                  const updatedEmptyGroups = [...storedEmptyGroups, group.name];
                                  saveEmptyGroups(updatedEmptyGroups);
                                }
                              }
                              
                              await loadServers();
                            } catch (error) {
                              console.error('Error removing server from group:', error);
                              showError('Ошибка удаления сервера из группы');
                            }
                          }}
                          title="Удалить из этой группы"
                          style={{ color: 'var(--error)' }}
                        >
                          <FiX />
                        </button>
                        <button
                          className={styles.smallBtn}
                          onClick={() => {
                            setSelectedServers([server.id]);
                            setTargetGroup('');
                            setShowMoveModal(true);
                          }}
                          title="Добавить в другую группу"
                        >
                          <FiMove />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  className={styles.addToGroupBtn}
                  onClick={() => {
                    setTargetGroup(group.name);
                    setShowMoveModal(true);
                  }}
                >
                  <FiPlus /> Добавить серверы в группу
                </button>
              </>
            )}
          </div>
          );
        })}

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
              setNewGroupName('');
              setSelectedServers([]);
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
                placeholder="Например: Production"
                className={styles.input}
                autoFocus
              />
            </div>

            <div className={styles.formGroup}>
              <label>Серверы (необязательно)</label>
              <small style={{ display: 'block', marginBottom: '10px', color: 'var(--text-muted)' }}>
                Выберите серверы для добавления в группу или оставьте пустым
              </small>
              
              <div style={{ marginBottom: '12px' }}>
                <button
                  type="button"
                  className={styles.selectAllBtn}
                  onClick={() => {
                    if (selectedServers.length === servers.length) {
                      setSelectedServers([]);
                    } else {
                      setSelectedServers(servers.map(s => s.id));
                    }
                  }}
                >
                  {selectedServers.length === servers.length ? 'Снять все' : 'Выбрать все'}
                </button>
              </div>

              <div className={styles.serverSelectList}>
                {servers.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
                    Нет доступных серверов
                  </p>
                ) : (
                  servers.map(server => (
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
                  ))
                )}
              </div>
            </div>

            <div className={styles.modalActions}>
              <button 
                className={styles.cancelBtn} 
                onClick={() => {
                  setShowCreateModal(false);
                  setNewGroupName('');
                  setSelectedServers([]);
                }}
              >
                Отмена
              </button>
              <button 
                className={styles.saveBtn} 
                onClick={handleCreateGroup}
                disabled={!newGroupName.trim()}
              >
                Создать группу {selectedServers.length > 0 && `(${selectedServers.length})`}
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
            <h2>Добавить серверы в группу</h2>
            
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
                    {g.name} ({g.servers.length})
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
              <div className={styles.selectAllContainer}>
                <label>Выберите серверы ({selectedServers.length} выбрано)</label>
                <button
                  type="button"
                  className={styles.selectAllBtn}
                  onClick={toggleSelectAll}
                >
                  {selectedServers.length === servers.filter(s => !targetGroup || s.group_name !== targetGroup).length
                    ? '✓ Снять все'
                    : '☐ Выбрать все'}
                </button>
              </div>
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
                Добавить ({selectedServers.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно переименования группы */}
      {showRenameModal && (
        <div 
          className={styles.modal}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              e.preventDefault();
              setShowRenameModal(false);
              setRenamingGroup(null);
              setNewRenameValue('');
            }
          }}
        >
          <div className={styles.modalContent}>
            <h2>Переименовать группу</h2>
            <div className={styles.formGroup}>
              <label>Новое название</label>
              <input
                type="text"
                value={newRenameValue}
                onChange={(e) => setNewRenameValue(e.target.value)}
                placeholder="Введите новое название"
                className={styles.input}
                autoFocus
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleRenameGroup(renamingGroup, newRenameValue);
                  }
                }}
              />
            </div>
            <div className={styles.modalActions}>
              <button 
                className={styles.cancelBtn} 
                onClick={() => {
                  setShowRenameModal(false);
                  setRenamingGroup(null);
                  setNewRenameValue('');
                }}
              >
                Отмена
              </button>
              <button 
                className={styles.saveBtn} 
                onClick={() => handleRenameGroup(renamingGroup, newRenameValue)}
                disabled={!newRenameValue.trim()}
              >
                Переименовать
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно удаления группы */}
      {showDeleteModal && (
        <div 
          className={styles.modal}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              e.preventDefault();
              setShowDeleteModal(false);
              setDeletingGroup(null);
            }
          }}
        >
          <div className={styles.modalContent}>
            <h2>Удалить группу</h2>
            <p style={{ marginBottom: '20px', color: 'var(--text-secondary)' }}>
              {getGroupServers(deletingGroup).length === 0
                ? `Вы уверены, что хотите удалить пустую группу "${deletingGroup}"?`
                : `Вы уверены, что хотите удалить группу "${deletingGroup}"? Серверы останутся в других группах (если есть).`
              }
            </p>
            <div className={styles.modalActions}>
              <button 
                className={styles.cancelBtn} 
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletingGroup(null);
                }}
              >
                Отмена
              </button>
              <button 
                className={styles.saveBtn} 
                onClick={handleDeleteGroup}
                style={{ background: 'var(--error)' }}
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Groups;





