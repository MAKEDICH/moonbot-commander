import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaDownload, FaTimes, FaExclamationTriangle, FaInfoCircle } from 'react-icons/fa';

// Определяем API URL в зависимости от окружения
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const UpdateNotification = ({ token }) => {
  const [updateInfo, setUpdateInfo] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Проверка обновлений
  const checkForUpdates = async (force = false) => {
    if (isChecking || (!force && dismissed)) return;
    
    setIsChecking(true);
    try {
      const response = await fetch(`${API_URL}/api/check-updates${force ? '?force=true' : ''}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) return;
      
      const data = await response.json();
      
      if (data.update_available && data.notification) {
        setUpdateInfo(data);
        setIsVisible(true);
        
        // Сохраняем в localStorage чтобы не показывать слишком часто
        const lastDismissed = localStorage.getItem('update_dismissed_version');
        if (lastDismissed === data.latest_version) {
          setDismissed(true);
          setIsVisible(false);
        }
      }
    } catch (error) {
      console.error('Failed to check updates:', error);
    } finally {
      setIsChecking(false);
    }
  };

  // Проверяем при монтировании компонента
  useEffect(() => {
    if (token) {
      // Проверяем через 10 секунд после загрузки
      const timer = setTimeout(() => {
        checkForUpdates();
      }, 10000);
      
      return () => clearTimeout(timer);
    }
  }, [token]);

  // Слушаем WebSocket уведомления
  useEffect(() => {
    const handleMessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'update_available') {
          setUpdateInfo({
            update_available: true,
            current_version: data.current_version,
            latest_version: data.new_version,
            notification: data
          });
          setIsVisible(true);
        }
      } catch (error) {
        // Ignore non-JSON messages
      }
    };

    // Подписываемся на WebSocket если есть
    if (window.ws) {
      window.ws.addEventListener('message', handleMessage);
      return () => {
        window.ws.removeEventListener('message', handleMessage);
      };
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    setDismissed(true);
    
    // Запоминаем версию которую пользователь закрыл
    if (updateInfo?.latest_version) {
      localStorage.setItem('update_dismissed_version', updateInfo.latest_version);
    }
  };

  const handleDownload = () => {
    if (updateInfo?.notification?.download_url) {
      window.open(updateInfo.notification.download_url, '_blank');
    }
  };

  const getSeverityIcon = () => {
    const severity = updateInfo?.notification?.severity || 'info';
    if (severity === 'critical') {
      return <FaExclamationTriangle className="text-red-400" />;
    }
    return <FaInfoCircle className="text-blue-400" />;
  };

  const getSeverityColor = () => {
    const severity = updateInfo?.notification?.severity || 'info';
    if (severity === 'critical') {
      return 'border-red-500 bg-red-900/20';
    }
    return 'border-blue-500 bg-blue-900/20';
  };

  return (
    <AnimatePresence>
      {isVisible && updateInfo && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          transition={{ duration: 0.3 }}
          className="fixed top-4 right-4 z-50 max-w-md"
        >
          <div className={`${getSeverityColor()} border rounded-lg shadow-lg backdrop-blur-sm p-4`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-2">
                {getSeverityIcon()}
                <h3 className="text-lg font-semibold text-white">
                  Доступно обновление
                </h3>
              </div>
              <button
                onClick={handleDismiss}
                className="text-gray-400 hover:text-gray-200 transition-colors"
              >
                <FaTimes />
              </button>
            </div>

            <div className="mb-3">
              <p className="text-gray-300 text-sm mb-1">
                Версия {updateInfo.current_version} → {updateInfo.latest_version}
              </p>
              {updateInfo.notification?.release_name && (
                <p className="text-white font-medium mb-2">
                  {updateInfo.notification.release_name}
                </p>
              )}
              {updateInfo.notification?.release_notes && (
                <div className="text-gray-400 text-sm space-y-1">
                  {updateInfo.notification.release_notes.split('\n').map((line, idx) => (
                    <p key={idx}>• {line}</p>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-500">
                Используйте {updateInfo.notification?.update_command || 'UPDATE-SAFE.bat'} для обновления
              </div>
              <button
                onClick={handleDownload}
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-md transition-colors"
              >
                <FaDownload className="text-sm" />
                <span className="text-sm">Скачать</span>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default UpdateNotification;
