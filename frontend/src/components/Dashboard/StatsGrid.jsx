import React from 'react';
import { 
  FiServer, 
  FiCheckCircle, 
  FiXCircle, 
  FiClock, 
  FiTrendingUp 
} from 'react-icons/fi';
import styles from '../../pages/Dashboard.module.css';

/**
 * Карточка статистики
 */
const StatCard = ({ icon: Icon, value, label, color, cardColors }) => {
  return (
    <div className={styles.statCard} style={cardColors}>
      <div className={styles.statIcon}>
        <Icon style={{color}} />
      </div>
      <div className={styles.statInfo}>
        <h3>{value}</h3>
        <p>{label}</p>
      </div>
    </div>
  );
};

/**
 * Сетка статистических карточек
 */
const StatsGrid = ({ stats, onlineServers, offlineServers }) => {
  const statCards = [
    {
      icon: FiServer,
      value: stats.total_servers,
      label: 'Серверов',
      color: '#00f5ff',
      cardColors: {
        '--card-glow': 'rgba(0, 245, 255, 0.15)',
        '--icon-bg-start': 'rgba(0, 245, 255, 0.2)',
        '--icon-bg-end': 'rgba(0, 200, 255, 0.05)',
        '--icon-shadow': 'rgba(0, 245, 255, 0.4)',
        '--icon-glow': '#00f5ff'
      }
    },
    {
      icon: FiCheckCircle,
      value: onlineServers,
      label: 'Онлайн',
      color: '#00ff88',
      cardColors: {
        '--card-glow': 'rgba(0, 255, 136, 0.15)',
        '--icon-bg-start': 'rgba(0, 255, 136, 0.2)',
        '--icon-bg-end': 'rgba(0, 255, 136, 0.05)',
        '--icon-shadow': 'rgba(0, 255, 136, 0.4)',
        '--icon-glow': '#00ff88'
      }
    },
    {
      icon: FiXCircle,
      value: offlineServers,
      label: 'Оффлайн',
      color: '#ff0055',
      cardColors: {
        '--card-glow': 'rgba(255, 0, 85, 0.15)',
        '--icon-bg-start': 'rgba(255, 0, 85, 0.2)',
        '--icon-bg-end': 'rgba(255, 0, 85, 0.05)',
        '--icon-shadow': 'rgba(255, 0, 85, 0.4)',
        '--icon-glow': '#ff0055'
      }
    },
    {
      icon: FiClock,
      value: stats.total_commands_all_time,
      label: 'Всего',
      color: '#b400ff',
      cardColors: {
        '--card-glow': 'rgba(180, 0, 255, 0.15)',
        '--icon-bg-start': 'rgba(180, 0, 255, 0.2)',
        '--icon-bg-end': 'rgba(138, 101, 255, 0.05)',
        '--icon-shadow': 'rgba(138, 101, 255, 0.4)',
        '--icon-glow': '#b400ff'
      }
    },
    {
      icon: FiTrendingUp,
      value: stats.total_commands_today,
      label: 'Сегодня',
      color: '#ff6b00',
      cardColors: {
        '--card-glow': 'rgba(255, 107, 0, 0.15)',
        '--icon-bg-start': 'rgba(255, 107, 0, 0.2)',
        '--icon-bg-end': 'rgba(255, 107, 0, 0.05)',
        '--icon-shadow': 'rgba(255, 107, 0, 0.4)',
        '--icon-glow': '#ff6b00'
      }
    },
    {
      icon: FiCheckCircle,
      value: stats.successful_commands_today,
      label: 'Успешных',
      color: '#00c8ff',
      cardColors: {
        '--card-glow': 'rgba(0, 200, 255, 0.15)',
        '--icon-bg-start': 'rgba(0, 200, 255, 0.2)',
        '--icon-bg-end': 'rgba(0, 200, 255, 0.05)',
        '--icon-shadow': 'rgba(0, 200, 255, 0.4)',
        '--icon-glow': '#00c8ff'
      }
    },
    {
      icon: FiClock,
      value: stats.avg_response_time ? `${stats.avg_response_time.toFixed(0)}ms` : '-',
      label: 'Ср. время',
      color: '#ffc800',
      cardColors: {
        '--card-glow': 'rgba(255, 200, 0, 0.15)',
        '--icon-bg-start': 'rgba(255, 200, 0, 0.2)',
        '--icon-bg-end': 'rgba(255, 200, 0, 0.05)',
        '--icon-shadow': 'rgba(255, 200, 0, 0.4)',
        '--icon-glow': '#ffc800'
      }
    }
  ];

  return (
    <div className={styles.statsGrid}>
      {statCards.map((card, index) => (
        <StatCard key={index} {...card} />
      ))}
    </div>
  );
};

export default StatsGrid;



