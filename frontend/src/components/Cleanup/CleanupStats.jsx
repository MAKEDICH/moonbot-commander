import React from 'react';
import { FiDatabase } from 'react-icons/fi';
import styles from '../../pages/Cleanup.module.css';
import { 
  formatBytes, 
  getFileIcon, 
  getDisplayName, 
  shouldHideFile,
  getSizeClass,
  getDiskPercentClass,
  sortFiles,
  calculateTotalSize
} from './cleanupUtils';

/**
 * Секция статистики БД и диска
 */
const CleanupStats = ({ stats }) => {
  return (
    <div className={styles.section}>
      <h2><FiDatabase /> Статистика</h2>
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <h3>📄 Записи в таблицах</h3>
          {stats && stats.tables ? (
            <>
              <div className={styles.statItem}>
                <span>SQL логи:</span>
                <strong>{stats.tables.sql_logs || 0}</strong>
              </div>
              <div className={styles.statItem}>
                <span>История команд:</span>
                <strong>{stats.tables.command_history || 0}</strong>
              </div>
              <div className={styles.statItem}>
                <span>Ордера:</span>
                <strong className={styles.protected}>
                  {stats.tables.orders || 0} 
                  {stats.tables.orders > 0 && <span style={{marginLeft: '0.3rem'}}>🔒</span>}
                </strong>
              </div>
            </>
          ) : (
            <p className={styles.help}>Загрузка...</p>
          )}
        </div>

        <div className={styles.statCard}>
          <h3>📋 Размер файлов</h3>
          {stats && stats.files ? (
            <>
              {sortFiles(stats.files)
                .filter(([key, size]) => size > 0)
                .map(([key, size]) => {
                  if (shouldHideFile(key)) return null;
                  
                  return (
                    <div key={key} className={styles.statItem}>
                      <span>{getFileIcon(key)} {getDisplayName(key)}:</span>
                      <strong className={getSizeClass(size, styles)}>
                        {formatBytes(size)}
                      </strong>
                    </div>
                  );
                })
                .filter(Boolean)}
              
              <div className={styles.statItem} style={{
                marginTop: '0.75rem', 
                paddingTop: '0.75rem', 
                borderTop: '2px solid rgba(255, 255, 255, 0.1)'
              }}>
                <span style={{fontWeight: 600, fontSize: '0.95rem'}}>💾 ВСЕГО:</span>
                <strong style={{fontSize: '1.1rem', color: '#00f5ff'}}>
                  {formatBytes(calculateTotalSize(stats.files))}
                </strong>
              </div>
            </>
          ) : (
            <p className={styles.help}>Нет данных о файлах</p>
          )}
        </div>

        <div className={styles.statCard}>
          <h3>💾 Диск</h3>
          {stats && stats.disk ? (
            <>
              <div className={styles.statItem}>
                <span>Всего:</span>
                <strong>{formatBytes(stats.disk.total)}</strong>
              </div>
              <div className={styles.statItem}>
                <span>Использовано:</span>
                <strong>{formatBytes(stats.disk.used)}</strong>
              </div>
              <div className={styles.statItem}>
                <span>Свободно:</span>
                <strong className={styles.success}>{formatBytes(stats.disk.free)}</strong>
              </div>
              <div className={styles.statItem}>
                <span>Заполнение:</span>
                <strong className={getDiskPercentClass(stats.disk.percent, styles)}>
                  {stats.disk.percent?.toFixed(1)}%
                </strong>
              </div>
            </>
          ) : (
            <p className={styles.help}>Загрузка...</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CleanupStats;



