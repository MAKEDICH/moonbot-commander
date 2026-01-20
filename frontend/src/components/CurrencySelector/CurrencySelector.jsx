import React from 'react';
import commonStyles from '../../styles/common.module.css';

const CurrencySelector = ({ 
  currencies = [], 
  value = 'all', 
  onChange, 
  showAllOption = true,
  allOptionText = 'Все валюты',
  label = 'Валюта:',
  showLabel = true,
  className = '',
  ...props 
}) => {
  return (
    <div className={`${commonStyles.currencyFilterContainer} ${className}`}>
      {showLabel && (
        <label className={commonStyles.currencyFilterLabel}>
          {label}
        </label>
      )}
      <select 
        value={value} 
        onChange={onChange}
        className={commonStyles.currencySelect}
        {...props}
      >
        {showAllOption && (
          <option value="all">{allOptionText}</option>
        )}
        {currencies.map(currency => (
          <option key={currency} value={currency}>
            {currency}
          </option>
        ))}
      </select>
    </div>
  );
};

export default CurrencySelector;



