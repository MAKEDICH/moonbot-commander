import { useState, useEffect } from 'react';
import { serversAPI, groupsAPI } from '../../api/api';
import { useNotification } from '../../context/NotificationContext';

const useGroups = () => {
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
  const [emptyGroups, setEmptyGroups] = useState([]);
  const [expandedGroups, setExpandedGroups] = useState(new Set());
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

  useEffect(() => {
    if (servers.length > 0) {
      loadGroups();
    }
  }, [servers]);

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
      const storedEmptyGroups = JSON.parse(localStorage.getItem('emptyGroups') || '[]');
      const allGroupNames = [...new Set([...groupNames, ...storedEmptyGroups])];
      setGroups(allGroupNames.map(name => ({ name, count: 0, servers: [] })));
    } catch (error) {
      console.error('Error loading groups:', error);
    }
  };

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
    if (groups.length >= 200) return;

    try {
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
            
            const { password, ...serverWithoutPassword } = server;
            await serversAPI.update(serverId, {
              ...serverWithoutPassword,
              group_name: updatedGroupName
            });
          }
        }
        await loadServers();
      } else {
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
      const serversToUpdate = servers.filter(s => {
        if (!s.group_name) return false;
        const serverGroups = s.group_name.split(',').map(g => g.trim());
        return serverGroups.includes(oldName);
      });
      
      for (const server of serversToUpdate) {
        const serverGroups = server.group_name.split(',').map(g => g.trim());
        const updatedGroups = serverGroups.map(g => g === oldName ? newName.trim() : g);
        const { password, ...serverWithoutPassword } = server;
        await serversAPI.update(server.id, {
          ...serverWithoutPassword,
          group_name: updatedGroups.join(', ')
        });
      }

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
        const updatedEmptyGroups = emptyGroups.filter(g => g !== deletingGroup);
        saveEmptyGroups(updatedEmptyGroups);
        await loadGroups();
      } else {
        const serversToUpdate = servers.filter(s => {
          if (!s.group_name) return false;
          const serverGroups = s.group_name.split(',').map(g => g.trim());
          return serverGroups.includes(deletingGroup);
        });
        
        for (const server of serversToUpdate) {
          const serverGroups = server.group_name.split(',').map(g => g.trim());
          const updatedGroups = serverGroups.filter(g => g !== deletingGroup);
          
          const { password, ...serverWithoutPassword } = server;
          await serversAPI.update(server.id, {
            ...serverWithoutPassword,
            group_name: updatedGroups.length > 0 ? updatedGroups.join(', ') : null
          });
        }

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
          let updatedGroupName;
          if (server.group_name) {
            const existingGroups = server.group_name.split(',').map(g => g.trim());
            if (!existingGroups.includes(targetGroup.trim())) {
              updatedGroupName = [...existingGroups, targetGroup.trim()].join(', ');
            } else {
              updatedGroupName = server.group_name;
            }
          } else {
            updatedGroupName = targetGroup.trim();
          }
          
          const { password, ...serverWithoutPassword } = server;
          await serversAPI.update(serverId, {
            ...serverWithoutPassword,
            group_name: updatedGroupName
          });
        }
      }

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

  const toggleServerSelection = (serverId, clearOthers = false) => {
    if (clearOthers) {
      setSelectedServers([serverId]);
    } else {
      setSelectedServers(prev => 
        prev.includes(serverId) ? prev.filter(id => id !== serverId) : [...prev, serverId]
      );
    }
  };

  const toggleSelectAll = (allIds = null) => {
    const ids = allIds || servers.map(s => s.id);
    const allSelected = ids.every(id => selectedServers.includes(id));
    
    if (allSelected) {
      setSelectedServers(prev => prev.filter(id => !ids.includes(id)));
    } else {
      setSelectedServers(prev => [...new Set([...prev, ...ids])]);
    }
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

  return {
    servers,
    groups,
    selectedGroup,
    setSelectedGroup,
    showCreateModal,
    setShowCreateModal,
    showEditModal,
    setShowEditModal,
    showMoveModal,
    setShowMoveModal,
    newGroupName,
    setNewGroupName,
    editingGroupName,
    setEditingGroupName,
    selectedServers,
    setSelectedServers,
    targetGroup,
    setTargetGroup,
    emptyGroups,
    expandedGroups,
    showRenameModal,
    setShowRenameModal,
    showDeleteModal,
    setShowDeleteModal,
    renamingGroup,
    setRenamingGroup,
    newRenameValue,
    setNewRenameValue,
    deletingGroup,
    setDeletingGroup,
    showError,
    loadServers,
    loadGroups,
    saveEmptyGroups,
    getGroupServers,
    getServersWithoutGroup,
    handleCreateGroup,
    handleRenameGroup,
    handleDeleteGroup,
    handleMoveServers,
    toggleServerSelection,
    toggleSelectAll,
    toggleGroupExpanded
  };
};

export default useGroups;



