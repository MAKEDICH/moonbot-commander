import React from 'react';
import styles from '../../pages/StrategyCommander.module.css';

const ServerLoadSection = ({ 
  servers, 
  selectedServer, 
  setSelectedServer, 
  loadingStrategies, 
  loadingProgress,
  onLoadStrategies 
}) => {
  return (
    <div className={styles.serverLoadSection}>
      <label>Загрузить стратегии с сервера:</label>
      <div className={styles.serverControls}>
        <select 
          value={selectedServer || ''} 
          onChange={(e) => setSelectedServer(parseInt(e.target.value))}
          className={styles.serverSelect}
          disabled={loadingStrategies}
        >
          <option value="">Выберите сервер...</option>
          {servers.map(server => (
            <option key={server.id} value={server.id}>
              {server.name} ({server.host}:{server.port})
            </option>
          ))}
        </select>
        
        <button 
          onClick={() => onLoadStrategies('GetStrategiesFull')}
          disabled={!selectedServer || loadingStrategies}
          className={styles.loadButton}
        >
          {loadingStrategies ? '⏳' : '📋'} Все стратегии
        </button>
        
        <button 
          onClick={() => onLoadStrategies('GetStrategiesActive')}
          disabled={!selectedServer || loadingStrategies}
          className={styles.loadButton}
        >
          {loadingStrategies ? '⏳' : '✅'} Только активные
        </button>
      </div>
      
      {loadingStrategies && loadingProgress.max > 0 && (
        <div className={styles.loadingProgressContainer}>
          <div className={styles.loadingProgressBar}>
            <div 
              className={styles.loadingProgressFill}
              style={{ width: `${(loadingProgress.current / loadingProgress.max) * 100}%` }}
            />
          </div>
          <div className={styles.loadingProgressText}>
            {loadingProgress.message}
            <span className={styles.loadingProgressPercent}>
              {Math.round((loadingProgress.current / loadingProgress.max) * 100)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServerLoadSection;



