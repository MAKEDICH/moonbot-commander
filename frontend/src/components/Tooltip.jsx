import React, { useState } from 'react';
import { FiHelpCircle, FiInfo } from 'react-icons/fi';
import styles from './Tooltip.module.css';

const Tooltip = ({ 
  children, 
  text, 
  position = 'top', // top, bottom, left, right
  icon = 'help', // help, info, none
  delay = 200 
}) => {
  const [show, setShow] = useState(false);
  const [timeoutId, setTimeoutId] = useState(null);

  const handleMouseEnter = () => {
    const id = setTimeout(() => {
      setShow(true);
    }, delay);
    setTimeoutId(id);
  };

  const handleMouseLeave = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
    setShow(false);
  };

  const getIcon = () => {
    if (icon === 'none') return null;
    
    const IconComponent = icon === 'info' ? FiInfo : FiHelpCircle;
    return <IconComponent className={styles.icon} />;
  };

  return (
    <div 
      className={styles.tooltipContainer}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children || getIcon()}
      {show && (
        <div className={`${styles.tooltip} ${styles[position]}`}>
          <div className={styles.tooltipContent}>
            {text}
          </div>
          <div className={`${styles.arrow} ${styles[`arrow-${position}`]}`}></div>
        </div>
      )}
    </div>
  );
};

export default Tooltip;






