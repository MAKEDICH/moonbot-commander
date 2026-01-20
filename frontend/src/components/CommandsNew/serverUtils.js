/**
 * Утилиты для работы с серверами и группами
 */

/**
 * Группировка серверов по группам
 */
export const getGroupedServers = (filteredServers) => {
  const grouped = {};
  
  filteredServers.forEach(server => {
    const group = server.group_name || '';
    if (!grouped[group]) {
      grouped[group] = [];
    }
    grouped[group].push(server);
  });
  
  return grouped;
};

/**
 * Проверка, полностью ли выбрана группа
 */
export const isGroupFullySelected = (groupName, servers, selectedServers) => {
  const groupServers = groupName === ''
    ? servers.filter(s => !s.group_name)
    : servers.filter(s => s.group_name && s.group_name.split(',').map(g => g.trim()).includes(groupName));
  return groupServers.length > 0 && groupServers.every(s => selectedServers.includes(s.id));
};

/**
 * Проверка, частично ли выбрана группа
 */
export const isGroupPartiallySelected = (groupName, servers, selectedServers) => {
  const groupServers = groupName === ''
    ? servers.filter(s => !s.group_name)
    : servers.filter(s => s.group_name && s.group_name.split(',').map(g => g.trim()).includes(groupName));
  const selectedInGroup = groupServers.filter(s => selectedServers.includes(s.id));
  return selectedInGroup.length > 0 && selectedInGroup.length < groupServers.length;
};

/**
 * Переключение выбора всех серверов в группе
 */
export const toggleGroupSelection = (groupName, servers, selectedServers, setSelectedServers) => {
  const groupServers = groupName === '' 
    ? servers.filter(s => !s.group_name).map(s => s.id)
    : servers.filter(s => s.group_name && s.group_name.split(',').map(g => g.trim()).includes(groupName)).map(s => s.id);
  
  const allSelected = groupServers.length > 0 && groupServers.every(id => selectedServers.includes(id));
  
  if (allSelected) {
    setSelectedServers(prev => prev.filter(id => !groupServers.includes(id)));
  } else {
    setSelectedServers(prev => [...new Set([...prev, ...groupServers])]);
  }
};

/**
 * Переключение выбора одного сервера
 */
export const toggleServerSelection = (serverId, selectedServers, setSelectedServers) => {
  setSelectedServers(prev => {
    if (prev.includes(serverId)) {
      return prev.filter(id => id !== serverId);
    } else {
      return [...prev, serverId];
    }
  });
};

/**
 * Выбрать все серверы
 */
export const selectAll = (filteredServers, setSelectedServers) => {
  const allIds = filteredServers.map(s => s.id);
  setSelectedServers(allIds);
};

/**
 * Снять выбор всех серверов
 */
export const deselectAll = (setSelectedServers) => {
  setSelectedServers([]);
};





