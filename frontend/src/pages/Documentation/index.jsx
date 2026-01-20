/**
 * Документация - Главный компонент
 * Модульная структура с разбиением на секции и компоненты
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiHome, FiServer, FiUsers, FiCommand, FiCalendar, FiClock, 
  FiTrendingUp, FiDownload, FiShield, FiZap, 
  FiBookOpen, FiChevronRight, FiStar, FiAward, FiCpu,
  FiList, FiEdit3, FiTrash2, FiLock
} from 'react-icons/fi';
import styles from './Documentation.module.css';
import moonbotIcon from '../../assets/moonbot-icon.png';

// Компоненты
import RocketAnimation from './components/RocketAnimation';
import { BugReportBanner } from './components/DocComponents';

// Секции
import {
  WelcomeSection,
  DashboardSection,
  ServersSection,
  GroupsSection,
  CommandsSection,
  CommandsRefSection,
  StrategyCmdSection,
  ScheduledSection,
  HistorySection,
  TradingSection,
  UsefulSection,
  UpdatesSection,
  BackupSection,
  CleanupSection,
  SecuritySection,
  TipsSection
} from './sections';

/**
 * Конфигурация секций навигации
 */
const sections = [
  { id: 'welcome', icon: <FiStar />, title: 'Добро пожаловать' },
  { id: 'dashboard', icon: <FiHome />, title: 'Панель управления' },
  { id: 'servers', icon: <FiServer />, title: 'Серверы' },
  { id: 'groups', icon: <FiUsers />, title: 'Группы' },
  { id: 'commands', icon: <FiCommand />, title: 'Команды' },
  { id: 'commandsRef', icon: <FiList />, title: 'Справочник команд' },
  { id: 'strategyCmd', icon: <FiEdit3 />, title: 'Strategy Commander' },
  { id: 'scheduled', icon: <FiCalendar />, title: 'Отложенные команды' },
  { id: 'history', icon: <FiClock />, title: 'История' },
  { id: 'trading', icon: <FiTrendingUp />, title: 'Торговля' },
  { id: 'useful', icon: <FiZap />, title: 'Полезные инструменты' },
  { id: 'updates', icon: <FiDownload />, title: 'Обновления' },
  { id: 'backup', icon: <FiShield />, title: 'Бэкап' },
  { id: 'cleanup', icon: <FiTrash2 />, title: 'Очистка данных' },
  { id: 'security', icon: <FiLock />, title: 'Безопасность' },
  { id: 'tips', icon: <FiAward />, title: 'Советы' },
];

/**
 * Маппинг секций на компоненты
 */
const sectionComponents = {
  welcome: WelcomeSection,
  dashboard: DashboardSection,
  servers: ServersSection,
  groups: GroupsSection,
  commands: CommandsSection,
  commandsRef: CommandsRefSection,
  strategyCmd: StrategyCmdSection,
  scheduled: ScheduledSection,
  history: HistorySection,
  trading: TradingSection,
  useful: UsefulSection,
  updates: UpdatesSection,
  backup: BackupSection,
  cleanup: CleanupSection,
  security: SecuritySection,
  tips: TipsSection,
};

/**
 * Главный компонент документации
 */
const Documentation = () => {
  const [activeSection, setActiveSection] = useState('welcome');
  const [rocketAnimationData, setRocketAnimationData] = useState(null);

  const renderContent = () => {
    const SectionComponent = sectionComponents[activeSection] || WelcomeSection;
    return <SectionComponent />;
  };

  const handleCaterpillarClick = (e) => {
    const rect = e.target.getBoundingClientRect();
    setRocketAnimationData({
      startPos: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    });
  };

  return (
    <div className={styles.container}>
      {/* Анимированный фон */}
      <div className={styles.backgroundEffects}>
        <div className={styles.gradientOrb1} />
        <div className={styles.gradientOrb2} />
        <div className={styles.gradientOrb3} />
        <div className={styles.gridPattern} />
      </div>

      {/* Шапка */}
      <motion.header 
        className={styles.header}
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className={styles.headerContent}>
          <div className={styles.logoSection}>
            <motion.img 
              src={moonbotIcon} 
              alt="Moonbot" 
              className={styles.headerLogo}
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            />
            <div className={styles.headerText}>
              <h1>Moonbot Commander</h1>
              <p className={styles.headerSubtitle}>Полное руководство пользователя</p>
            </div>
          </div>
          <div className={styles.versionBadge}>
            <FiCpu />
            <span>v3.0</span>
          </div>
        </div>
      </motion.header>

      {/* Основной layout */}
      <div className={styles.mainLayout}>
        {/* Навигация */}
        <motion.nav 
          className={styles.sidebar}
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className={styles.navTitle}>
            <FiBookOpen />
            <span>Содержание</span>
          </div>
          <div className={styles.navItems}>
            {sections.map((section, index) => (
              <motion.button
                key={section.id}
                className={`${styles.navItem} ${activeSection === section.id ? styles.navItemActive : ''}`}
                onClick={() => setActiveSection(section.id)}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.05 * index }}
                whileHover={{ x: 5 }}
              >
                <span className={styles.navIcon}>{section.icon}</span>
                <span className={styles.navText}>{section.title}</span>
                <FiChevronRight className={styles.navArrow} />
              </motion.button>
            ))}
          </div>
        </motion.nav>

        {/* Контент */}
        <motion.main 
          className={styles.content}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </motion.main>
      </div>
      
      {/* Баннер баг-репорта */}
      <BugReportBanner onCaterpillarClick={handleCaterpillarClick} />
      
      {/* Пасхалка - анимация ракеты */}
      {rocketAnimationData && (
        <RocketAnimation 
          startPos={rocketAnimationData.startPos}
          onComplete={() => setRocketAnimationData(null)} 
        />
      )}
    </div>
  );
};

export default Documentation;

