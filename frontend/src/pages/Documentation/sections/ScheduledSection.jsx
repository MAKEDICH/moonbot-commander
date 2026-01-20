/**
 * Секция отложенных команд
 */
import React from 'react';
import { FiCalendar, FiCheck } from 'react-icons/fi';
import styles from '../Documentation.module.css';
import { SectionHeader } from '../components/DocComponents';

const ScheduledSection = () => (
  <div className={styles.section}>
    <SectionHeader icon={<FiCalendar />} title="Отложенные команды" subtitle="Планировщик задач по расписанию" />
    
    <div className={styles.infoBlock}>
      <h4>⏰ Типы расписаний:</h4>
      <ul className={styles.featureList}>
        <li><FiCheck /> <strong>Один раз</strong> — команда выполнится один раз в указанные дату и время</li>
        <li><FiCheck /> <strong>Ежедневно</strong> — каждый день в определённое время</li>
        <li><FiCheck /> <strong>Еженедельно</strong> — раз в 7 дней в указанное время</li>
        <li><FiCheck /> <strong>Ежемесячно</strong> — в тот же день каждого месяца</li>
        <li><FiCheck /> <strong>По дням недели</strong> — выбор конкретных дней (Пн, Вт, Ср...)</li>
      </ul>
    </div>

    <div className={styles.exampleBox}>
      <h4>📅 Примеры использования:</h4>
      <ul className={styles.useCaseList}>
        <li>🌙 <code>STOP</code> ежедневно в 23:00 — пауза на ночь</li>
        <li>☀️ <code>START</code> ежедневно в 09:00 — старт утром</li>
        <li>📊 <code>report</code> по понедельникам в 10:00 — еженедельный отчёт</li>
        <li>🔄 <code>ResetLoss</code> ежемесячно 1-го числа — сброс статистики</li>
        <li>⚠️ <code>sgStop NewsStrategy 30</code> разовая команда перед новостями</li>
      </ul>
    </div>

    <div className={styles.howTo}>
      <h4>📝 Как создать отложенную команду:</h4>
      <ol className={styles.stepList}>
        <li>Нажмите <code>+ Создать команду</code></li>
        <li>Введите текст команды (или выберите из пресета)</li>
        <li>Выберите серверы или группу для выполнения</li>
        <li>Укажите тип расписания и время</li>
        <li>Нажмите <code>Сохранить</code></li>
      </ol>
    </div>
  </div>
);

export default ScheduledSection;

