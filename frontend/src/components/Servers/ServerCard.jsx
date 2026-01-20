import React from 'react';
import { 
  FiServer, 
  FiCheckCircle, 
  FiXCircle, 
  FiRadio, 
  FiEdit2, 
  FiTrash2,
  FiAlertCircle,
  FiRefreshCw
} from 'react-icons/fi';
import styles from '../../pages/Servers.module.css';
import { formatServerTimeOnly } from '../../utils/dateUtils';

/**
 * Карточка сервера
 */
const ServerCard = ({
  server,
  viewMode,
  isTesting,
  listenerStatus,
  actionLoading,
  hideAddresses,
  onTest,
  onEdit,
  onDelete,
  onListenerStart,
  onListenerStop
}) => {
  const isListenerRunning = listenerStatus?.is_running;
  const status = server.status;
  const isOnline = status?.is_online || false;

  /**
   * Маскирует IP адрес, оставляя только первый октет
   */
  const maskAddress = (host, port) => {
    if (!hideAddresses) return `${host}:${port}`;
    
    // Проверяем, является ли это IP адресом
    const ipMatch = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (ipMatch) {
      return `${ipMatch[1]}.***.***.**:****`;
    }
    
    // Для доменных имён скрываем часть
    if (host.includes('.')) {
      const parts = host.split('.');
      if (parts.length >= 2) {
        return `${parts[0].substring(0, 2)}***.***.***:****`;
      }
    }
    
    return `***:****`;
  };

  return (
    <div className={`${styles.serverCard} ${viewMode === 'compact' ? styles.compact : ''} ${isOnline ? styles.online : styles.offline}`}>
      <div className={styles.serverHeader}>
        <div className={styles.serverName}>
          {isOnline ? <FiCheckCircle className={styles.onlineIcon} /> : <FiXCircle className={styles.offlineIcon} />}
          <span>{server.name}</span>
        </div>
        <div className={`${styles.serverStatus} ${isOnline ? styles.statusOnline : styles.statusOffline}`}>
          {isOnline ? 'ONLINE' : 'OFFLINE'}
        </div>
      </div>
      
      <div className={`${styles.serverAddress} ${hideAddresses ? styles.addressHidden : ''}`}>
        {maskAddress(server.host, server.port)}
      </div>
      
      {viewMode === 'full' && (server.bot_version !== null && server.bot_version !== undefined) && (
        <div className={styles.serverVersion}>
          Версия: v{server.bot_version}
        </div>
      )}
      
      {viewMode === 'full' && (server.bot_running !== null && server.bot_running !== undefined) && (
        <div className={`${styles.serverBotStatus} ${server.bot_running ? styles.botRunning : styles.botStopped}`}>
          {server.bot_running ? 'START' : 'STOP'}
        </div>
      )}
      
      {viewMode === 'compact' && (
        <div className={styles.compactBotInfo}>
          {(server.bot_version !== null && server.bot_version !== undefined) && (
            <span className={styles.compactVersion}>v{server.bot_version}</span>
          )}
          {(server.bot_running !== null && server.bot_running !== undefined) && (
            <span className={`${styles.compactBotStatus} ${server.bot_running ? styles.compactRunning : styles.compactStopped}`}>
              {server.bot_running ? '▶' : '⏸'}
            </span>
          )}
        </div>
      )}
      
      {server.group_name && (
        <div className={styles.groupBadges}>
          {server.group_name.split(',').map((g, idx) => (
            <span key={idx} className={styles.groupBadge}>{g.trim()}</span>
          ))}
        </div>
      )}
      
      {viewMode === 'full' && server.description && (
        <p className={styles.serverDescription}>{server.description}</p>
      )}

      {viewMode === 'full' && status?.last_ping && (
        <div className={styles.serverDetail}>
          <span>Последняя проверка:</span>
          <span>{formatServerTimeOnly(status.last_ping, true)}</span>
        </div>
      )}

      {viewMode === 'full' && status?.last_error && !isOnline && (
        <div className={styles.serverError}>
          <FiAlertCircle /> {status.last_error}
        </div>
      )}

      {viewMode === 'full' && (
        <div className={styles.listenerSection}>
          <div className={styles.listenerHeader}>
            <FiRadio className={isListenerRunning ? styles.listenerIconActive : styles.listenerIconInactive} />
            <span className={styles.listenerLabel}>
              UDP Listener: {isListenerRunning ? 'Работает' : 'Остановлен'}
            </span>
          </div>
          
          {listenerStatus && isListenerRunning && (
            <div className={styles.listenerStats}>
              <small>Получено: {listenerStatus.messages_received || 0} пакетов</small>
              {listenerStatus.last_message_at && (
                <small>Последний: {formatServerTimeOnly(listenerStatus.last_message_at, true)}</small>
              )}
            </div>
          )}
          
          <div className={styles.listenerActions}>
            {isListenerRunning ? (
              <button 
                className={`${styles.listenerBtn} ${styles.stopBtn}`}
                onClick={() => onListenerStop(server.id)}
                disabled={actionLoading[`stop-${server.id}`]}
                title="Остановить listener"
              >
                {actionLoading[`stop-${server.id}`] ? '...' : 'Стоп'}
              </button>
            ) : (
              <button 
                className={`${styles.listenerBtn} ${styles.startBtn}`}
                onClick={() => onListenerStart(server.id)}
                disabled={actionLoading[`start-${server.id}`]}
                title="Запустить listener"
              >
                {actionLoading[`start-${server.id}`] ? '...' : 'Старт'}
              </button>
            )}
          </div>
        </div>
      )}

      {viewMode === 'compact' && (
        <div className={styles.compactInfo}>
          <div className={styles.compactListener}>
            <FiRadio className={isListenerRunning ? styles.listenerIconActive : styles.listenerIconInactive} />
            <span className={styles.compactListenerText}>
              {isListenerRunning ? 'UDP: ВКЛ' : 'UDP: ВЫКЛ'}
            </span>
          </div>
          {status?.last_ping && (
            <span className={styles.compactTime}>{formatServerTimeOnly(status.last_ping, true)}</span>
          )}
        </div>
      )}

      <div className={styles.serverActions}>
        <button 
          className={styles.actionBtn}
          onClick={() => onTest(server.id)}
          disabled={isTesting}
        >
          {isTesting ? 'Проверка...' : 'Тест'}
        </button>
        <button 
          className={styles.actionBtn}
          onClick={() => onEdit(server)}
        >
          <FiEdit2 />
        </button>
        <button 
          className={`${styles.actionBtn} ${styles.deleteBtn}`}
          onClick={() => onDelete(server.id)}
        >
          <FiTrash2 />
        </button>
      </div>
    </div>
  );
};

export default ServerCard;



