import React from 'react';
import { FiArrowLeft, FiZap } from 'react-icons/fi';
import styles from '../../pages/StrategyCommander.module.css';
import PageHeader from '../PageHeader';

const StrategyHeader = ({ onClose }) => {
  return (
    <PageHeader 
      icon={<FiZap />} 
      title="MoonBot Commander Pro" 
      gradient="gold"
    >
      <button className={styles.backButton} onClick={onClose}>
        <FiArrowLeft /> Вернуться к командам
      </button>
    </PageHeader>
  );
};

export default StrategyHeader;



