/**
 * Секция истории команд
 */
import React from 'react';
import { FiClock, FiCheck } from 'react-icons/fi';
import styles from '../Documentation.module.css';
import { SectionHeader } from '../components/DocComponents';

const HistorySection = () => (
  <div className={styles.section}>
    <SectionHeader icon={<FiClock />} title="История команд" subtitle="Полный лог всех отправленных команд" />
    
    <div className={styles.infoBlock}>
      <h4>📜 Что сохраняется:</h4>
      <ul className={styles.featureList}>
        <li><FiCheck /> <strong>Команда</strong> — текст отправленной команды</li>
        <li><FiCheck /> <strong>Сервер</strong> — куда была отправлена</li>
        <li><FiCheck /> <strong>Время</strong> — точная дата и время</li>
        <li><FiCheck /> <strong>Статус</strong> — успех / ошибка</li>
        <li><FiCheck /> <strong>Ответ</strong> — что вернул MoonBot</li>
      </ul>
    </div>

    <div className={styles.infoBlock}>
      <h4>🔍 Возможности:</h4>
      <ul className={styles.featureList}>
        <li><FiCheck /> <strong>Фильтрация по серверу</strong> — показать команды конкретного бота</li>
        <li><FiCheck /> <strong>Поиск по команде</strong> — найти команду по тексту с автоподсказками</li>
        <li><FiCheck /> <strong>Поиск по параметру</strong> — фильтр по параметрам стратегии</li>
        <li><FiCheck /> <strong>Очистка</strong> — удаление старых записей</li>
      </ul>
    </div>
  </div>
);

export default HistorySection;

