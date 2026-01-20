/**
 * Фильтры для Orders
 */

import React from 'react';
import { FaFilter } from 'react-icons/fa';
import styles from '../../pages/Orders.module.css';
import commonStyles from '../../styles/common.module.css';

export default function OrdersFilters({
  statusFilter,
  symbolFilter,
  emulatorFilter,
  onFilterChange
}) {
  return (
    <div className={styles.filters}>
      <div className={styles.filterGroup}>
        <label><FaFilter /> Статус:</label>
        <select 
          value={statusFilter}
          onChange={(e) => onFilterChange(e.target.value, symbolFilter, null)}
          className={commonStyles.selectField}
        >
          <option value="">Все</option>
          <option value="Open">Открытые</option>
          <option value="Closed">Закрытые</option>
        </select>
      </div>

      <div className={styles.filterGroup}>
        <label>Символ:</label>
        <input
          type="text"
          value={symbolFilter}
          onChange={(e) => onFilterChange(statusFilter, e.target.value, null)}
          placeholder="BTC, ETH..."
          className={styles.filterInput}
        />
      </div>

      <div className={styles.filterGroup}>
        <label>🎮 Тип:</label>
        <select 
          value={emulatorFilter}
          onChange={(e) => onFilterChange(statusFilter, symbolFilter, e.target.value)}
          className={commonStyles.selectField}
        >
          <option value="all">Все</option>
          <option value="real">Реальные</option>
          <option value="emulator">Эмулятор</option>
        </select>
      </div>
    </div>
  );
}



