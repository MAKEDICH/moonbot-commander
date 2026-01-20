import React from 'react';
import { FiServer, FiPlus } from 'react-icons/fi';
import styles from '../../pages/Servers.module.css';

/**
 * Пустое состояние когда нет серверов
 */
const EmptyState = ({ onAddServer }) => {
  return (
    <div className={styles.emptyState}>
      <FiServer />
      <p>У вас пока нет серверов</p>
      <p className={styles.emptySubtext}>Добавьте свой первый сервер для начала работы</p>
      <button className={styles.addBtnLarge} onClick={onAddServer}>
        <FiPlus />
        Добавить первый сервер
      </button>
    </div>
  );
};

export default EmptyState;



