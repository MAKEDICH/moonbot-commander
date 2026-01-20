import React from 'react';
import { FiUsers, FiPlus } from 'react-icons/fi';
import styles from '../../pages/Groups.module.css';
import PageHeader from '../PageHeader';

const GroupsHeader = ({ groupsCount, serversCount, onCreateClick, disabled }) => {
  return (
    <PageHeader 
      icon={<FiUsers />} 
      title="Управление группами" 
      gradient="purple"
      badge={`${groupsCount}/200 групп • ${serversCount} серверов`}
    >
      <button 
        className={styles.createBtn}
        onClick={onCreateClick}
        disabled={disabled}
      >
        <FiPlus /> Создать группу
      </button>
    </PageHeader>
  );
};

export default GroupsHeader;



