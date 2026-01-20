/**
 * Чип ключа в списке дубликатов
 */
import React from 'react';
import styles from '../styles/chips.module.css';

const KeyChip = ({ num, count, isActive, isSolo, flags, onToggle }) => {
    const { hasLaunch, hasBL, hasByKey } = flags;
    
    let className = `${styles.chip}`;
    if (isActive) className += ` ${styles.chipActive}`;
    if (isSolo) className += ` ${styles.chipSolo}`;
    if (hasBL && !hasLaunch) className += ` ${styles.chipBlOnly}`;
    if (hasLaunch && !hasBL) className += ` ${styles.chipLaunchOnly}`;
    if (hasByKey) className += ` ${styles.chipByKey}`;
    
    const tooltipParts = [`Ключ ${num}: используется ${count} раз`];
    if (hasBL && !hasLaunch) tooltipParts.push('🔵 Только BL-параметры без Launch');
    if (hasLaunch && !hasBL) tooltipParts.push('🔴 Только Launch-параметры без BL');
    if (hasByKey) tooltipParts.push('🟢 Используется в TriggerByKey');
    if (hasBL && hasLaunch) tooltipParts.push('🟡 Используется и в Launch, и в BL');
    
    const handleClick = (e) => {
        onToggle(num, !(e.ctrlKey || e.shiftKey || e.altKey));
    };
    
    return (
        <span
            className={className}
            title={tooltipParts.join('\n')}
            onClick={handleClick}
        >
            {num}({count})
        </span>
    );
};

export default KeyChip;

