import React from 'react';
import { useNetworkStatus } from '../hooks/usePWA';
import styles from './NetworkStatus.module.css';
import { FiWifiOff, FiWifi } from 'react-icons/fi';

const NetworkStatus = () => {
  const isOnline = useNetworkStatus();
  const [showOffline, setShowOffline] = React.useState(false);

  React.useEffect(() => {
    if (!isOnline) {
      setShowOffline(true);
    } else {
      // Показываем "Подключено" на 3 секунды при восстановлении связи
      if (showOffline) {
        const timer = setTimeout(() => {
          setShowOffline(false);
        }, 3000);
        return () => clearTimeout(timer);
      }
    }
  }, [isOnline, showOffline]);

  if (!showOffline) return null;

  return (
    <div className={`${styles.banner} ${isOnline ? styles.online : styles.offline}`}>
      {isOnline ? (
        <>
          <FiWifi className={styles.icon} />
          <span>Подключено</span>
        </>
      ) : (
        <>
          <FiWifiOff className={styles.icon} />
          <span>Нет подключения к интернету</span>
        </>
      )}
    </div>
  );
};

export default NetworkStatus;





