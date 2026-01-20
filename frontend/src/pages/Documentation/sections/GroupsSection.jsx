/**
 * Секция групп серверов
 */
import React from 'react';
import { FiUsers, FiCheck } from 'react-icons/fi';
import styles from '../Documentation.module.css';
import { SectionHeader } from '../components/DocComponents';

const GroupsSection = () => (
  <div className={styles.section}>
    <SectionHeader icon={<FiUsers />} title="Группы серверов" subtitle="Объединение серверов для массовых операций" />
    
    <div className={styles.infoBlock}>
      <h4>👥 Зачем нужны группы:</h4>
      <ul className={styles.featureList}>
        <li><FiCheck /> <strong>Массовые команды</strong> — одна команда → все серверы группы</li>
        <li><FiCheck /> <strong>Организация</strong> — логическое разделение по типам ботов</li>
        <li><FiCheck /> <strong>Быстрый выбор</strong> — вместо галочек на 20 серверах — выбор группы</li>
        <li><FiCheck /> <strong>Гибкость</strong> — один сервер может быть в нескольких группах</li>
      </ul>
    </div>

    <div className={styles.exampleBox}>
      <h4>📋 Рекомендуемые группы:</h4>
      <div className={styles.exampleGrid}>
        <div className={styles.exampleItem}><span className={styles.exampleIcon}>📈</span><span>Споты основные</span></div>
        <div className={styles.exampleItem}><span className={styles.exampleIcon}>⚡</span><span>Фьючерсы агрессивные</span></div>
        <div className={styles.exampleItem}><span className={styles.exampleIcon}>🛡️</span><span>Фьючерсы консервативные</span></div>
        <div className={styles.exampleItem}><span className={styles.exampleIcon}>🧪</span><span>Тестовые / Эмулятор</span></div>
        <div className={styles.exampleItem}><span className={styles.exampleIcon}>💎</span><span>VIP стратегии</span></div>
        <div className={styles.exampleItem}><span className={styles.exampleIcon}>🌙</span><span>Ночные боты</span></div>
      </div>
    </div>
  </div>
);

export default GroupsSection;

