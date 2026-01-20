/**
 * Секция приветствия документации
 */
import React from 'react';
import { FiServer, FiCommand, FiTrendingUp, FiCalendar, FiEdit3, FiZap } from 'react-icons/fi';
import styles from '../Documentation.module.css';
import { AnimatedIcon, FeatureCard, Step } from '../components/DocComponents';

const WelcomeSection = () => (
  <div className={styles.section}>
    <div className={styles.welcomeHero}>
      <AnimatedIcon />
      <h2>Добро пожаловать в Moonbot Commander!</h2>
      <p className={styles.welcomeSubtitle}>
        Мощнейший инструмент для централизованного управления вашими торговыми ботами MoonBot
      </p>
    </div>

    <div className={styles.featureGrid}>
      <FeatureCard icon={<FiServer />} title="Централизованное управление" description="Все серверы MoonBot в одном интерфейсе с мониторингом статуса" color="#00f5ff" />
      <FeatureCard icon={<FiCommand />} title="Массовые команды" description="Отправляйте команды на десятки серверов одновременно" color="#ff6b6b" />
      <FeatureCard icon={<FiTrendingUp />} title="Глубокая аналитика" description="Статистика, графики, винрейт, анализ по стратегиям" color="#ffd93d" />
      <FeatureCard icon={<FiCalendar />} title="Планировщик" description="Отложенные команды по расписанию" color="#6bcb77" />
      <FeatureCard icon={<FiEdit3 />} title="Strategy Commander" description="Массовое редактирование параметров стратегий" color="#a855f7" />
      <FeatureCard icon={<FiZap />} title="Инструменты трейдера" description="Индексы, сессии, сравнение стратегий, листинги" color="#f472b6" />
    </div>

    <div className={styles.quickStart}>
      <h3>⚡ Быстрый старт за 5 минут</h3>
      <div className={styles.steps}>
        <Step number={1} title="Добавьте серверы" description="Раздел Серверы → Добавить сервер → IP, UDP порт и пароль из MoonBot" />
        <Step number={2} title="Создайте группы" description="Раздел Группы → Объедините серверы по типу (споты, фьючерсы)" />
        <Step number={3} title="Настройте быстрые команды" description="Раздел Команды → Добавьте часто используемые команды" />
        <Step number={4} title="Отправьте первую команду" description="Выберите серверы/группу → Введите команду → Отправить" />
      </div>
    </div>
  </div>
);

export default WelcomeSection;

