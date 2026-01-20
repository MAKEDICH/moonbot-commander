import React from 'react';
import { FiActivity, FiSettings, FiTrash2 } from 'react-icons/fi';
import moonbotIcon from '../../assets/moonbot-icon.png';
import styles from '../../pages/Dashboard.module.css';
import PageHeader from '../PageHeader';

/**
 * Шапка дашборда с информацией о Moonbot
 */
const DashboardHeader = ({ onShowSettings, onShowCleanup }) => {
  return (
    <>
      <div className={styles.moonbotInfo}>
        <div className={styles.moonbotContent}>
          <div className={styles.moonbotIcon}>
            <img src={moonbotIcon} alt="Moonbot" />
          </div>
          <div className={styles.moonbotText}>
            <h3>Developed for <span className={styles.moonbotHighlight}>Moonbot</span></h3>
            <p>
              Этот проект предназначен для работы с терминалами{' '}
              <strong>Moonbot</strong> - лучшему решению для криптотрейдинга
            </p>
          </div>
          <a 
            href="https://moonbot.pro/" 
            target="_blank" 
            rel="noopener noreferrer"
            className={styles.moonbotLink}
          >
            Посетить сайт Moonbot
          </a>
        </div>
      </div>

      <PageHeader 
        icon={<FiActivity />} 
        title="Дашборд" 
        gradient="cyan"
      >
        <button 
          onClick={onShowCleanup} 
          className={styles.cleanupBtn} 
          title="Управление очисткой данных"
        >
          <FiTrash2 /> Очистка
        </button>
        <button onClick={onShowSettings} className={styles.settingsBtn}>
          <FiSettings /> Настройки
        </button>
      </PageHeader>
    </>
  );
};

export default DashboardHeader;



