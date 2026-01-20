import React from 'react';
import { FiCheck, FiX, FiAlertCircle, FiInfo } from 'react-icons/fi';
import styles from '../../pages/StrategyCommander.module.css';

const Notifications = ({ toasts, showConfirm, onConfirm }) => {
  return (
    <>
      {/* Toast уведомления */}
      <div className={styles.toastsContainer}>
        {toasts.map(toast => (
          <div key={toast.id} className={`${styles.toast} ${styles[toast.type]}`}>
            <div className={styles.toastIcon}>
              {toast.type === 'success' && <FiCheck />}
              {toast.type === 'error' && <FiX />}
              {toast.type === 'warning' && <FiAlertCircle />}
              {toast.type === 'info' && <FiInfo />}
            </div>
            <span>{toast.message}</span>
          </div>
        ))}
      </div>

      {/* Confirm Dialog */}
      {showConfirm && (
        <div className={styles.confirmOverlay} onClick={() => onConfirm(false)}>
          <div className={styles.confirmDialog} onClick={(e) => e.stopPropagation()}>
            <div className={styles.confirmHeader}>
              <FiAlertCircle className={styles.confirmIcon} />
              <h3>Подтверждение</h3>
            </div>
            <div className={styles.confirmBody}>
              <p>{showConfirm.message}</p>
            </div>
            <div className={styles.confirmActions}>
              <button 
                className={styles.confirmCancel} 
                onClick={() => onConfirm(false)}
              >
                Отмена
              </button>
              <button 
                className={styles.confirmOk} 
                onClick={() => onConfirm(true)}
              >
                Подтвердить
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Notifications;



