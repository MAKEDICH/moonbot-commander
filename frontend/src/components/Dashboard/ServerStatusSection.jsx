import React from 'react';
import { 
  FiServer, 
  FiCheckCircle, 
  FiXCircle, 
  FiAlertCircle, 
  FiRefreshCw, 
  FiPlay, 
  FiPause,
  FiGrid,
  FiList
} from 'react-icons/fi';
import styles from '../../pages/Dashboard.module.css';

/**
 * Карточка сервера
 */
const ServerCard = ({ server, viewMode, isTesting, onTest }) => {
  const status = server.status;
  const isOnline = status?.is_online || false;
  
  return (
    <div 
      className={`${styles.serverCard} ${isOnline ? styles.online : styles.offline} ${viewMode === 'compact' ? styles.compact : ''}`}
    >
      <div className={styles.serverHeader}>
        <div className={styles.serverName}>
          {isOnline ? <FiCheckCircle /> : <FiXCircle />}
          {server.name}
        </div>
        <div className={styles.serverHeaderRight}>
          {viewMode === 'full' && (
            <button
              onClick={() => onTest(server.id)}
              disabled={isTesting}
              className={styles.testBtn}
              title="Проверить сервер"
            >
              <FiRefreshCw className={isTesting ? styles.spinning : ''} />
              {isTesting ? 'Тест...' : 'Тест'}
            </button>
          )}
          <div className={`${styles.serverStatus} ${isOnline ? styles.statusOnline : styles.statusOffline}`}>
            {isOnline ? 'ONLINE' : 'OFFLINE'}
          </div>
        </div>
      </div>
      <div className={styles.serverDetails}>
        <div className={styles.serverDetail}>
          <span>IP:</span>
          <span>{server.host}:{server.port}</span>
        </div>
        {viewMode === 'full' && (server.bot_version !== null && server.bot_version !== undefined) && (
          <div className={styles.serverDetail}>
            <span>Версия:</span>
            <span>v{server.bot_version}</span>
          </div>
        )}
        {viewMode === 'full' && (server.bot_running !== null && server.bot_running !== undefined) && (
          <div className={styles.serverDetail}>
            <span>Состояние:</span>
            <span className={server.bot_running ? styles.botRunning : styles.botStopped}>
              {server.bot_running ? 'START' : 'STOP'}
            </span>
          </div>
        )}
        {viewMode === 'full' && server.group_name && (
          <div className={styles.serverDetail}>
            <span>Группа:</span>
            <span>{server.group_name}</span>
          </div>
        )}
        {viewMode === 'full' && status?.last_ping && (
          <div className={styles.serverDetail}>
            <span>Последняя проверка:</span>
            <span>{new Date(status.last_ping).toLocaleTimeString()}</span>
          </div>
        )}
        {viewMode === 'full' && status?.last_error && !isOnline && (
          <div className={styles.serverError}>
            <FiAlertCircle /> {status.last_error}
          </div>
        )}
        {viewMode === 'compact' && (
          <div className={styles.compactInfo}>
            {server.group_name && <span className={styles.compactGroup}>{server.group_name}</span>}
            {server.bot_version !== null && server.bot_version !== undefined && (
              <span className={styles.compactVersion}>v{server.bot_version}</span>
            )}
            {server.bot_running !== null && server.bot_running !== undefined && (
              <span className={`${styles.compactBotStatusIcon} ${server.bot_running ? styles.compactRunning : styles.compactStopped}`}>
                {server.bot_running ? '▶' : '⏸'}
              </span>
            )}
            {status?.last_ping && (
              <span className={styles.compactTime}>{new Date(status.last_ping).toLocaleTimeString()}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Секция статусов серверов с управлением
 */
const ServerStatusSection = ({ 
  servers, 
  viewMode, 
  autoPingEnabled, 
  testingServers, 
  onToggleView, 
  onToggleAutoPing, 
  onTestServer 
}) => {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2><FiServer /> Статус серверов</h2>
        <div className={styles.sectionControls}>
          <button 
            onClick={onToggleView} 
            className={styles.viewToggleBtn}
            title={viewMode === 'full' ? 'Переключить на компактный вид' : 'Переключить на полный вид'}
          >
            {viewMode === 'full' ? <><FiList /> Компактный вид</> : <><FiGrid /> Полный вид</>}
          </button>
          <button 
            onClick={onToggleAutoPing} 
            className={`${styles.autoPingBtn} ${autoPingEnabled ? styles.active : ''}`}
            title={autoPingEnabled ? 'Автопроверка включена' : 'Автопроверка выключена'}
          >
            {autoPingEnabled ? <FiPause /> : <FiPlay />}
            {autoPingEnabled ? 'Остановить автопроверку' : 'Запустить автопроверку'}
          </button>
        </div>
      </div>
      <div className={`${styles.serversGrid} ${viewMode === 'compact' ? styles.compactView : ''}`}>
        {servers.map(server => (
          <ServerCard
            key={server.id}
            server={server}
            viewMode={viewMode}
            isTesting={testingServers.has(server.id)}
            onTest={onTestServer}
          />
        ))}
      </div>
    </div>
  );
};

export default ServerStatusSection;



