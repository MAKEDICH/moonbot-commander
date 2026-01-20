/**
 * Контекст для красивых модальных уведомлений
 * 
 * Заменяет стандартные window.confirm() и alert()
 * на стилизованные модальные окна
 */
import React, { createContext, useContext, useState, useCallback } from 'react';
import ConfirmModal from '../components/ConfirmModal';

const ConfirmContext = createContext(null);

/**
 * Провайдер контекста подтверждений
 */
export const ConfirmProvider = ({ children }) => {
  const [modal, setModal] = useState(null);

  /**
   * Показать диалог подтверждения
   * @param {Object} options - Параметры диалога
   * @param {string} options.title - Заголовок
   * @param {string} options.message - Сообщение
   * @param {string} options.confirmText - Текст кнопки подтверждения
   * @param {string} options.cancelText - Текст кнопки отмены
   * @param {string} options.type - Тип: 'warning' | 'danger' | 'info' | 'success'
   * @returns {Promise<boolean>} - true если подтверждено, false если отменено
   */
  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      const handleConfirm = () => {
        setModal(null);
        resolve(true);
      };

      const handleCancel = () => {
        setModal(null);
        resolve(false);
      };

      setModal({
        ...options,
        onConfirm: handleConfirm,
        onCancel: handleCancel,
      });
    });
  }, []);

  /**
   * Показать информационное сообщение (аналог alert)
   * @param {string} message - Сообщение
   * @param {Object} options - Дополнительные параметры
   */
  const alert = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      const handleClose = () => {
        setModal(null);
        resolve(true);
      };

      setModal({
        title: options.title || 'Уведомление',
        message,
        type: options.type || 'info',
        confirmText: options.confirmText || 'OK',
        cancelText: null, // Скрываем кнопку отмены
        onConfirm: handleClose,
        onCancel: handleClose,
        hideCancel: true,
      });
    });
  }, []);

  /**
   * Показать диалог удаления (красный, опасный)
   * @param {string} message - Сообщение
   * @param {Object} options - Дополнительные параметры
   */
  const confirmDelete = useCallback((message, options = {}) => {
    return confirm({
      title: options.title || 'Удаление',
      message,
      type: 'danger',
      confirmText: options.confirmText || 'Удалить',
      cancelText: options.cancelText || 'Отмена',
    });
  }, [confirm]);

  /**
   * Показать диалог предупреждения
   * @param {string} message - Сообщение
   * @param {Object} options - Дополнительные параметры
   */
  const confirmWarning = useCallback((message, options = {}) => {
    return confirm({
      title: options.title || 'Предупреждение',
      message,
      type: 'warning',
      confirmText: options.confirmText || 'Продолжить',
      cancelText: options.cancelText || 'Отмена',
    });
  }, [confirm]);

  const value = {
    confirm,
    alert,
    confirmDelete,
    confirmWarning,
  };

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {modal && (
        <ConfirmModal
          title={modal.title}
          message={modal.message}
          type={modal.type}
          confirmText={modal.confirmText}
          cancelText={modal.hideCancel ? null : modal.cancelText}
          onConfirm={modal.onConfirm}
          onCancel={modal.onCancel}
        />
      )}
    </ConfirmContext.Provider>
  );
};

/**
 * Хук для использования диалогов подтверждения
 * @returns {Object} - { confirm, alert, confirmDelete, confirmWarning }
 */
export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within ConfirmProvider');
  }
  return context;
};

export default ConfirmContext;


