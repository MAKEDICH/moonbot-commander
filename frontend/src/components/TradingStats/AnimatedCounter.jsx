import React, { useState, useEffect, useRef } from 'react';

/**
 * Компонент анимированного счётчика
 */
const AnimatedCounter = ({ value, decimals = 0, suffix = '', className = '' }) => {
  const [displayValue, setDisplayValue] = useState(0);
  const prevValueRef = useRef(0);
  
  useEffect(() => {
    const startValue = prevValueRef.current;
    const endValue = parseFloat(value) || 0;
    const duration = 800;
    const steps = 30;
    const stepDuration = duration / steps;
    const increment = (endValue - startValue) / steps;
    
    let currentStep = 0;
    const timer = setInterval(() => {
      currentStep++;
      if (currentStep >= steps) {
        setDisplayValue(endValue);
        prevValueRef.current = endValue;
        clearInterval(timer);
      } else {
        setDisplayValue(startValue + (increment * currentStep));
      }
    }, stepDuration);
    
    return () => clearInterval(timer);
  }, [value]);
  
  return (
    <span className={className}>
      {displayValue.toFixed(decimals)}{suffix}
    </span>
  );
};

export default AnimatedCounter;





