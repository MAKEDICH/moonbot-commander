import React from 'react';
import { FiBarChart2 } from 'react-icons/fi';
import styles from '../../pages/Dashboard.module.css';

/**
 * График команд за неделю
 */
const CommandsChart = ({ commandsDaily, loading }) => {
  if (loading) {
    return (
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2><FiBarChart2 /> Команды за неделю</h2>
        </div>
        <div className={styles.loadingSection}>Загрузка...</div>
      </div>
    );
  }

  if (!commandsDaily || commandsDaily.length === 0) {
    return (
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2><FiBarChart2 /> Команды за неделю</h2>
        </div>
        <div className={styles.emptySection}>
          <FiBarChart2 size={32} />
          <p>Нет данных за последнюю неделю</p>
        </div>
      </div>
    );
  }

  // Находим максимальное значение для масштабирования
  const maxCommands = Math.max(...commandsDaily.map(d => d.count || 0), 1);
  
  // Форматируем дату - парсим напрямую без конвертации часового пояса
  const formatDate = (dateStr) => {
    // Парсим YYYY-MM-DD
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return '';
    const [, year, month, day] = match.map(Number);
    // Создаём дату в UTC чтобы избежать смещения
    const date = new Date(Date.UTC(year, month - 1, day));
    const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    return days[date.getUTCDay()];
  };

  const formatFullDate = (dateStr) => {
    // Парсим YYYY-MM-DD напрямую
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return dateStr;
    const [, , month, day] = match;
    const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    return `${parseInt(day, 10)} ${months[parseInt(month, 10) - 1]}`;
  };

  // Считаем общую статистику
  const totalCommands = commandsDaily.reduce((sum, d) => sum + (d.count || 0), 0);
  const avgCommands = Math.round(totalCommands / commandsDaily.length);

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2><FiBarChart2 /> Команды за неделю</h2>
        <div className={styles.chartStats}>
          <span className={styles.chartStatItem}>
            Всего: <strong>{totalCommands}</strong>
          </span>
          <span className={styles.chartStatItem}>
            В среднем: <strong>{avgCommands}/день</strong>
          </span>
        </div>
      </div>
      
      <div className={styles.commandsChart}>
        {commandsDaily.map((day, index) => {
          const height = ((day.count || 0) / maxCommands) * 100;
          const isToday = index === commandsDaily.length - 1;
          
          return (
            <div key={day.date} className={styles.chartBar}>
              <div className={styles.barContainer}>
                <div 
                  className={`${styles.bar} ${isToday ? styles.barToday : ''}`}
                  style={{ height: `${Math.max(height, 5)}%` }}
                >
                  <span className={styles.barValue}>{day.count || 0}</span>
                </div>
              </div>
              <div className={styles.barLabel}>
                <span className={styles.barDay}>{formatDate(day.date)}</span>
                <span className={styles.barDate}>{formatFullDate(day.date)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CommandsChart;



