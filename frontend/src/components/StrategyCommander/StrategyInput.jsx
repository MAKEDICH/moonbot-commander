import React from 'react';
import { FiUpload, FiX } from 'react-icons/fi';
import styles from '../../pages/StrategyCommander.module.css';
import ServerLoadSection from './ServerLoadSection';

const StrategyInput = ({ 
  strategyInput, 
  setStrategyInput,
  servers,
  selectedServer,
  setSelectedServer,
  loadingStrategies,
  loadingProgress,
  onLoadStrategies,
  onParse,
  onClear 
}) => {
  return (
    <div className={styles.inputSection}>
      <ServerLoadSection 
        servers={servers}
        selectedServer={selectedServer}
        setSelectedServer={setSelectedServer}
        loadingStrategies={loadingStrategies}
        loadingProgress={loadingProgress}
        onLoadStrategies={onLoadStrategies}
      />
      <label>Вставьте сюда текст стратегий:</label>
      <textarea
        className={styles.strategyInput}
        value={strategyInput}
        onChange={(e) => setStrategyInput(e.target.value)}
        placeholder="Вставьте сюда текст стратегий..."
      />
      <div className={styles.inputActions}>
        <button className={styles.parseButton} onClick={onParse}>
          <FiUpload /> Разобрать
        </button>
        <button 
          className={styles.clearInputButton} 
          onClick={onClear}
          disabled={!strategyInput.trim()}
          title="Очистить текст стратегий"
        >
          <FiX /> Очистить
        </button>
      </div>
    </div>
  );
};

export default StrategyInput;



