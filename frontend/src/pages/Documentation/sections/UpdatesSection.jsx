/**
 * Секция обновлений
 */
import React from 'react';
import { FiDownload, FiCheck } from 'react-icons/fi';
import styles from '../Documentation.module.css';
import { SectionHeader } from '../components/DocComponents';

const UpdatesSection = () => (
  <div className={styles.section}>
    <SectionHeader icon={<FiDownload />} title="Обновления" subtitle="Система обновления приложения" />
    
    <div className={styles.infoBlock}>
      <h4>🔄 Функции раздела:</h4>
      <ul className={styles.featureList}>
        <li><FiCheck /> <strong>Проверка обновлений</strong> — автоматическая проверка каждые 30 минут</li>
        <li><FiCheck /> <strong>Индикатор в меню</strong> — точка у пункта "Обновления" при наличии новой версии</li>
        <li><FiCheck /> <strong>Управление бэкапами</strong> — список и очистка старых бэкапов</li>
        <li><FiCheck /> <strong>Откат версии</strong> — восстановление из бэкапа</li>
        <li><FiCheck /> <strong>Обновление</strong> — подготовка и установка с подтверждением</li>
        <li><FiCheck /> <strong>Версии</strong> — текущая и доступная версии</li>
      </ul>
    </div>

    <div className={styles.tipBox}>
      <span className={styles.tipIcon}>💡</span>
      <div>
        <strong>Совет:</strong> Перед обновлением рекомендуется создать бэкап в разделе "Бэкап"
      </div>
    </div>
  </div>
);

export default UpdatesSection;

