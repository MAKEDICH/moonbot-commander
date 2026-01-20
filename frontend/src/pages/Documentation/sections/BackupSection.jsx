/**
 * Секция бэкапа
 */
import React from 'react';
import { FiShield, FiCheck } from 'react-icons/fi';
import styles from '../Documentation.module.css';
import { SectionHeader } from '../components/DocComponents';

const BackupSection = () => (
  <div className={styles.section}>
    <SectionHeader icon={<FiShield />} title="Бэкап и восстановление" subtitle="Резервное копирование всех настроек" />
    
    <div className={styles.infoBlock}>
      <h4>💾 Что включает бэкап (обязательно):</h4>
      <ul className={styles.featureList}>
        <li><FiCheck /> <strong>Серверы</strong> — все подключения с IP адресами и настройками</li>
        <li><FiCheck /> <strong>Группы</strong> — структура и состав групп</li>
        <li><FiCheck /> <strong>Быстрые команды</strong> — все сохранённые команды</li>
        <li><FiCheck /> <strong>Пресеты</strong> — наборы команд</li>
        <li><FiCheck /> <strong>Отложенные команды</strong> — расписания задач</li>
        <li><FiCheck /> <strong>Настройки пользователя</strong> — персональные настройки</li>
      </ul>
    </div>

    <div className={styles.infoBlock}>
      <h4>📊 Опционально (можно включить/выключить):</h4>
      <ul className={styles.featureList}>
        <li><FiCheck /> <strong>Ордера</strong> — история торговых операций</li>
        <li><FiCheck /> <strong>Графики</strong> — сохранённые тик-чарты</li>
        <li><FiCheck /> <strong>Логи</strong> — SQL логи команд</li>
      </ul>
    </div>

    <div className={styles.howTo}>
      <h4>📦 Как использовать:</h4>
      <ol className={styles.stepList}>
        <li><strong>Экспорт:</strong> Установите пароль → выберите опции → скачается зашифрованный файл</li>
        <li><strong>Импорт:</strong> Выберите файл → введите пароль → проверка → восстановление</li>
        <li><strong>Режимы:</strong> Добавить к существующим или Заменить полностью</li>
      </ol>
    </div>

    <div className={styles.warningBox}>
      <span className={styles.warningIcon}>⚠️</span>
      <div>
        <strong>Важно:</strong> Бэкапы зашифрованы паролем. Храните их в безопасном месте. Создавайте регулярно и особенно перед обновлениями!
      </div>
    </div>
  </div>
);

export default BackupSection;

