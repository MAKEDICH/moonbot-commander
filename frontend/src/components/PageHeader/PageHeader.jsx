import React from 'react';
import styles from './PageHeader.module.css';

/**
 * Универсальный компонент заголовка страницы
 * 
 * @param {ReactNode} icon - Иконка заголовка
 * @param {string} title - Текст заголовка
 * @param {string} gradient - Тип градиента: 'cyan', 'purple', 'green', 'orange', 'pink', 'blue'
 * @param {ReactNode} children - Дополнительные элементы (кнопки и т.д.)
 * @param {ReactNode} badge - Бейдж рядом с заголовком
 */
const PageHeader = ({ 
  icon, 
  title, 
  gradient = 'cyan',
  children,
  badge
}) => {
  return (
    <div className={styles.header}>
      <div className={styles.titleSection}>
        <span className={`${styles.icon} ${styles[`icon${gradient.charAt(0).toUpperCase() + gradient.slice(1)}`]}`}>
          {icon}
        </span>
        <h1 className={`${styles.title} ${styles[`title${gradient.charAt(0).toUpperCase() + gradient.slice(1)}`]}`}>
          {title}
        </h1>
        {badge && <span className={styles.badge}>{badge}</span>}
      </div>
      {children && (
        <div className={styles.actions}>
          {children}
        </div>
      )}
    </div>
  );
};

export default PageHeader;


