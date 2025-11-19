import { createContext, useContext, useState, useCallback } from 'react';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';

const NotificationContext = createContext(null);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [confirmConfig, setConfirmConfig] = useState(null);

  // Генератор уникальных ID
  const generateId = () => `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // ==================
  // TOAST NOTIFICATIONS
  // ==================

  const showToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = generateId();
    const toast = { id, message, type, duration };
    
    setToasts(prev => [...prev, toast]);

    // Автоматическое удаление
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }

    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  // Удобные методы для разных типов
  const success = useCallback((message, duration) => {
    return showToast(message, 'success', duration);
  }, [showToast]);

  const error = useCallback((message, duration) => {
    return showToast(message, 'error', duration);
  }, [showToast]);

  const warning = useCallback((message, duration) => {
    return showToast(message, 'warning', duration);
  }, [showToast]);

  const info = useCallback((message, duration) => {
    return showToast(message, 'info', duration);
  }, [showToast]);

  // ==================
  // CONFIRM MODALS
  // ==================

  const confirm = useCallback((config) => {
    return new Promise((resolve) => {
      setConfirmConfig({
        ...config,
        onConfirm: () => {
          setConfirmConfig(null);
          resolve(true);
        },
        onCancel: () => {
          setConfirmConfig(null);
          resolve(false);
        }
      });
    });
  }, []);

  // ==================
  // PROGRESS NOTIFICATIONS
  // ==================

  const [progressNotifications, setProgressNotifications] = useState([]);

  const showProgress = useCallback((message, id) => {
    const progressId = id || generateId();
    setProgressNotifications(prev => [
      ...prev,
      { id: progressId, message, progress: 0 }
    ]);
    return progressId;
  }, []);

  const updateProgress = useCallback((id, progress, message) => {
    setProgressNotifications(prev =>
      prev.map(item =>
        item.id === id
          ? { ...item, progress, message: message || item.message }
          : item
      )
    );
  }, []);

  const hideProgress = useCallback((id) => {
    setProgressNotifications(prev => prev.filter(item => item.id !== id));
  }, []);

  const value = {
    // Toast methods
    showToast,
    success,
    error,
    warning,
    info,
    removeToast,
    
    // Confirm modal
    confirm,
    
    // Progress
    showProgress,
    updateProgress,
    hideProgress,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      
      {/* Toast Container */}
      <div
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          maxWidth: '400px',
        }}
      >
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>

      {/* Progress Notifications */}
      {progressNotifications.length > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            maxWidth: '400px',
          }}
        >
          {progressNotifications.map(item => (
            <div
              key={item.id}
              style={{
                background: 'rgba(30, 30, 40, 0.95)',
                backdropFilter: 'blur(12px)',
                borderRadius: '12px',
                padding: '16px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              <div style={{ color: '#fff', marginBottom: '8px', fontSize: '14px' }}>
                {item.message}
              </div>
              <div
                style={{
                  width: '100%',
                  height: '4px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '2px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${item.progress}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
              <div style={{ color: '#999', marginTop: '4px', fontSize: '12px' }}>
                {Math.round(item.progress)}%
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirm Modal */}
      {confirmConfig && <ConfirmModal {...confirmConfig} />}
    </NotificationContext.Provider>
  );
};




