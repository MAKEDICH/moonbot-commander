import React from 'react';
import { FiTrash2 } from 'react-icons/fi';
import Cleanup from '../../pages/Cleanup';
import styles from '../../pages/Dashboard.module.css';

/**
 * Модальное окно управления очисткой данных
 */
const CleanupModal = ({ show, onClose }) => {
  if (!show) return null;

  return (
    <div className={styles.modal} onClick={onClose}>
      <div className={styles.modalContentLarge} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2><FiTrash2 /> Управление очисткой данных</h2>
          <button onClick={onClose} className={styles.closeBtn}>×</button>
        </div>
        <div className={styles.cleanupContainer}>
          <Cleanup />
        </div>
      </div>
    </div>
  );
};

export default CleanupModal;



