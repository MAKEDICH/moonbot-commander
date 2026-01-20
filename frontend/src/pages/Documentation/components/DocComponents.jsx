/**
 * Вспомогательные компоненты для документации
 * Переиспользуемые UI элементы
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiCheck, FiChevronRight } from 'react-icons/fi';
import styles from '../Documentation.module.css';
import moonbotIcon from '../../../assets/moonbot-icon.png';

// Летящая купюра для анимации
export const FlyingBill = ({ delay, direction }) => (
  <motion.div
    className={styles.flyingBill}
    initial={{ opacity: 0, scale: 0, x: 0, y: 0, rotate: 0 }}
    animate={{ 
      opacity: [0, 1, 1, 0],
      scale: [0.3, 1, 0.8, 0.5],
      x: direction.x,
      y: direction.y,
      rotate: direction.rotate
    }}
    transition={{ 
      duration: 1.5, 
      delay: delay,
      repeat: Infinity,
      repeatDelay: 0.5
    }}
  >
    💵
  </motion.div>
);

// Анимированная иконка MoonBot с трансформацией в доллар
export const AnimatedIcon = () => {
  const [isHovered, setIsHovered] = useState(false);
  
  const billDirections = [
    { x: -80, y: -60, rotate: -30 },
    { x: 80, y: -50, rotate: 25 },
    { x: -60, y: 60, rotate: -20 },
    { x: 70, y: 70, rotate: 35 },
    { x: 0, y: -90, rotate: 15 },
    { x: -90, y: 0, rotate: -40 },
    { x: 90, y: 10, rotate: 30 },
    { x: 30, y: 80, rotate: -15 },
  ];
  
  return (
    <motion.div 
      className={styles.welcomeIconWrapper}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      animate={{ scale: [1, 1.05, 1] }}
      transition={{ duration: 2, repeat: Infinity }}
    >
      <AnimatePresence>
        {isHovered && billDirections.map((dir, i) => (
          <FlyingBill key={i} delay={i * 0.1} direction={dir} />
        ))}
      </AnimatePresence>
      
      <AnimatePresence mode="wait">
        {!isHovered ? (
          <motion.img
            key="moonbot"
            src={moonbotIcon}
            alt="MoonBot"
            className={styles.welcomeLogoIcon}
            initial={{ opacity: 0, scale: 0.5, rotate: -180 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.3, rotate: 180 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
          />
        ) : (
          <motion.div
            key="dollar"
            className={styles.dollarIcon}
            initial={{ opacity: 0, scale: 0.3, rotateY: -180 }}
            animate={{ opacity: 1, scale: 1, rotateY: 0 }}
            exit={{ opacity: 0, scale: 0.3, rotateY: 180 }}
            transition={{ duration: 0.4, ease: "backOut" }}
          >
            <motion.span 
              className={styles.dollarSymbol}
              animate={{ 
                scale: [1, 1.2, 1],
                textShadow: [
                  "0 0 20px rgba(34, 197, 94, 0.5)",
                  "0 0 40px rgba(34, 197, 94, 0.8)",
                  "0 0 20px rgba(34, 197, 94, 0.5)"
                ]
              }}
              transition={{ duration: 0.8, repeat: Infinity }}
            >
              $
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// Баннер для отчёта о багах
export const BugReportBanner = ({ onCaterpillarClick }) => (
  <motion.div 
    className={styles.bugBanner}
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.5 }}
  >
    <span 
      className={styles.bugIcon}
      onClick={onCaterpillarClick}
      style={{ 
        cursor: 'pointer', 
        fontSize: '28px',
        display: 'inline-block',
        transition: 'transform 0.3s ease, filter 0.3s ease'
      }}
      onMouseEnter={(e) => {
        e.target.style.transform = 'scale(1.3) rotate(10deg)';
        e.target.style.filter = 'drop-shadow(0 0 10px rgba(0,255,136,0.8))';
      }}
      onMouseLeave={(e) => {
        e.target.style.transform = 'scale(1) rotate(0deg)';
        e.target.style.filter = 'none';
      }}
    >
      🐛
    </span>
    <p>
      Если вы нашли баги, то <span className={styles.strikethrough}>оставьте их при себе</span> сообщите, пожалуйста, <a href="https://t.me/MAKEDICH" target="_blank" rel="noopener noreferrer" className={styles.telegramLink}>@MAKEDICH</a>
    </p>
  </motion.div>
);

// Карточка функции
export const FeatureCard = ({ icon, title, description, color }) => (
  <motion.div className={styles.featureCard} style={{ '--accent-color': color }} whileHover={{ y: -5, scale: 1.02 }}>
    <div className={styles.featureIcon}>{icon}</div>
    <h4>{title}</h4>
    <p>{description}</p>
  </motion.div>
);

// Шаг быстрого старта
export const Step = ({ number, title, description }) => (
  <div className={styles.step}>
    <div className={styles.stepNumber}>{number}</div>
    <div className={styles.stepContent}>
      <h5>{title}</h5>
      <p>{description}</p>
    </div>
  </div>
);

// Заголовок секции
export const SectionHeader = ({ icon, title, subtitle }) => (
  <div className={styles.sectionHeader}>
    <div className={styles.sectionIcon}>{icon}</div>
    <div>
      <h2>{title}</h2>
      <p>{subtitle}</p>
    </div>
  </div>
);

// Категория команд
export const CommandCategory = ({ title, commands }) => (
  <div className={styles.commandCategory}>
    <h4>{title}</h4>
    <div className={styles.commandList}>
      {commands.map((c, i) => (
        <div key={i} className={styles.commandItem}>
          <code>{c.cmd}</code>
          <span>{c.desc}</span>
        </div>
      ))}
    </div>
  </div>
);

// Карточка вкладки
export const TabCard = ({ icon, title, features }) => (
  <div className={styles.tabCard}>
    <div className={styles.tabHeader}>
      <span className={styles.tabIcon}>{icon}</span>
      <h5>{title}</h5>
    </div>
    <ul className={styles.tabFeatures}>
      {features.map((f, i) => <li key={i}><FiCheck /> {f}</li>)}
    </ul>
  </div>
);

// Карточка инструмента
export const ToolCard = ({ icon, title, description }) => (
  <div className={styles.toolCard}>
    <div className={styles.toolIcon}>{icon}</div>
    <h5>{title}</h5>
    <p>{description}</p>
  </div>
);

// Карточка совета
export const TipCard = ({ number, title, text }) => (
  <div className={styles.tipCard}>
    <div className={styles.tipNumber}>{number}</div>
    <h5>{title}</h5>
    <p>{text}</p>
  </div>
);

