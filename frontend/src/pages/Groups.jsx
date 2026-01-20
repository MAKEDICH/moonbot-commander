import React from 'react';
import { FiUsers, FiPlus } from 'react-icons/fi';
import styles from './Groups.module.css';
import {
  GroupsHeader,
  ServersWithoutGroup,
  GroupCard,
  useGroups,
  CreateGroupModal,
  MoveServersModal,
  RenameGroupModal,
  DeleteGroupModal
} from '../components/Groups';

const Groups = () => {
  const {
    servers,
    groups,
    showCreateModal,
    setShowCreateModal,
    showMoveModal,
    setShowMoveModal,
    newGroupName,
    setNewGroupName,
    selectedServers,
    setSelectedServers,
    targetGroup,
    setTargetGroup,
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
  } = useGroups();

  const groupedServers = groups.map(group => ({
    ...group,
    servers: getGroupServers(group.name)
  }));

  const serversWithoutGroup = getServersWithoutGroup();

  return (
    <div className={styles.container}>
      <GroupsHeader
        groupsCount={groups.length}
        serversCount={servers.length}
        onCreateClick={() => setShowCreateModal(true)}
        disabled={groups.length >= 200}
      />

      <div className={styles.content}>
        <ServersWithoutGroup
          servers={serversWithoutGroup}
          selectedServers={selectedServers}
          onToggleServerSelection={toggleServerSelection}
          onToggleSelectAll={toggleSelectAll}
          onShowMoveModal={() => setShowMoveModal(true)}
        />

        {groupedServers.map(group => (
          <GroupCard
            key={group.name}
            group={group}
            isExpanded={expandedGroups.has(group.name)}
            onToggleExpanded={() => toggleGroupExpanded(group.name)}
            onRename={() => {
              setRenamingGroup(group.name);
              setNewRenameValue(group.name);
              setShowRenameModal(true);
            }}
            onDelete={() => {
              setDeletingGroup(group.name);
              setShowDeleteModal(true);
            }}
            onLoadServers={loadServers}
            onSaveEmptyGroups={saveEmptyGroups}
            showError={showError}
          />
        ))}

        {groups.length === 0 && serversWithoutGroup.length === 0 && (
          <div className={styles.empty}>
            <FiUsers size={48} />
            <p>Нет групп и серверов</p>
            <p className={styles.emptyHint}>Создайте группу или добавьте серверы</p>
          </div>
        )}
      </div>

      <CreateGroupModal
        show={showCreateModal}
        newGroupName={newGroupName}
        setNewGroupName={setNewGroupName}
        servers={servers}
        selectedServers={selectedServers}
        onToggleServerSelection={toggleServerSelection}
        onToggleSelectAll={() => toggleSelectAll(servers.map(s => s.id))}
        onClose={() => {
          setShowCreateModal(false);
          setNewGroupName('');
          setSelectedServers([]);
        }}
        onCreate={handleCreateGroup}
      />

      <MoveServersModal
        show={showMoveModal}
        targetGroup={targetGroup}
        setTargetGroup={setTargetGroup}
        groups={groupedServers}
        servers={servers}
        selectedServers={selectedServers}
        onToggleServerSelection={toggleServerSelection}
        onToggleSelectAll={() => toggleSelectAll()}
        onClose={() => {
          setShowMoveModal(false);
          setSelectedServers([]);
          setTargetGroup('');
        }}
        onMove={handleMoveServers}
      />

      <RenameGroupModal
        show={showRenameModal}
        groupName={renamingGroup}
        newRenameValue={newRenameValue}
        setNewRenameValue={setNewRenameValue}
        onClose={() => {
          setShowRenameModal(false);
          setRenamingGroup(null);
          setNewRenameValue('');
        }}
        onRename={handleRenameGroup}
      />

      <DeleteGroupModal
        show={showDeleteModal}
        groupName={deletingGroup}
        getGroupServers={getGroupServers}
        onClose={() => {
          setShowDeleteModal(false);
          setDeletingGroup(null);
        }}
        onDelete={handleDeleteGroup}
      />
    </div>
  );
};

export default Groups;
