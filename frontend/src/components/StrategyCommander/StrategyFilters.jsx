import React from 'react';
import styles from '../../pages/StrategyCommander.module.css';

const StrategyFilters = ({ 
  parsedItems,
  allParamNames,
  selectedItem,
  setSelectedItem,
  selectedParam,
  setSelectedParam,
  selectOptions
}) => {
  if (parsedItems.length === 0) return null;

  return (
    <div className={styles.selectorsContainer}>
      <div className={styles.selectorGroup}>
        <label>Выбор папки/стратегии:</label>
        <select 
          value={selectedItem} 
          onChange={(e) => setSelectedItem(e.target.value)}
          className={styles.select}
        >
          {selectOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      
      <div className={styles.selectorGroup}>
        <label>Параметр:</label>
        <select 
          value={selectedParam} 
          onChange={(e) => setSelectedParam(e.target.value)}
          className={styles.select}
        >
          <option value="ALL_PARAMS">Все параметры</option>
          {allParamNames.map(pName => (
            <option key={pName} value={pName}>{pName}</option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default StrategyFilters;



