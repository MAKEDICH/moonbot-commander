/**
 * Чип номера в ячейке таблицы
 */
import React from 'react';
import styles from '../styles/chips.module.css';

const NumberChip = ({ num, type, isAdded, isRemoved, onToggleGlobal }) => {
    let className = `${styles.chip} ${styles.chipActive} ${styles.chipCompact}`;
    
    if (type === 'Launch') className += ` ${styles.chipRLaunch}`;
    else if (type === 'ByKey') className += ` ${styles.chipRByKey}`;
    else className += ` ${styles.chipRBl}`;
    
    if (isAdded) className += ` ${styles.chipAdded}`;
    if (isRemoved) className += ` ${styles.chipRemoved}`;
    
    return (
        <span
            className={className}
            onClick={() => onToggleGlobal(num)}
        >
            {num}
        </span>
    );
};

export default NumberChip;

