/**
 * Секция команд
 */
import React from 'react';
import { FiCommand, FiCheck } from 'react-icons/fi';
import styles from '../Documentation.module.css';
import { SectionHeader } from '../components/DocComponents';

const CommandsSection = () => (
  <div className={styles.section}>
    <SectionHeader icon={<FiCommand />} title="Команды" subtitle="Центр управления ботами MoonBot" />
    
    <div className={styles.infoBlock}>
      <h4>🎮 Элементы интерфейса:</h4>
      <ul className={styles.featureList}>
        <li><FiCheck /> <strong>Поле ввода команды</strong> — с автодополнением при вводе</li>
        <li><FiCheck /> <strong>Выбор серверов</strong> — чекбоксы серверов и групп</li>
        <li><FiCheck /> <strong>Быстрые команды</strong> — панель сохранённых команд</li>
        <li><FiCheck /> <strong>Справочник</strong> — полный список команд MoonBot с примерами</li>
        <li><FiCheck /> <strong>Конструктор</strong> — визуальное создание сложных команд</li>
        <li><FiCheck /> <strong>Пресеты</strong> — наборы из нескольких команд</li>
        <li><FiCheck /> <strong>Strategy Commander</strong> — мощный редактор стратегий</li>
      </ul>
    </div>

    <div className={styles.howTo}>
      <h4>🚀 Как отправить команду:</h4>
      <ol className={styles.stepList}>
        <li>Выберите серверы галочками или выберите группу</li>
        <li>Введите команду в поле ввода (или выберите из быстрых)</li>
        <li>Нажмите <code>Отправить</code> или <code>Enter</code></li>
        <li>Результат появится в окне ответа</li>
      </ol>
    </div>

    <div className={styles.tipBox}>
      <span className={styles.tipIcon}>🔥</span>
      <div>
        <strong>Pro-функции:</strong> Используйте пресеты для сохранения наборов команд. Strategy Commander позволяет массово редактировать стратегии.
      </div>
    </div>
  </div>
);

export default CommandsSection;

