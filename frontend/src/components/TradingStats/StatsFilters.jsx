import React from 'react';
import styles from '../../pages/TradingStats.module.css';
import { getServerButtonText, getStrategyButtonText, getTimePeriodText } from './statsUtils';

/**
 * Компонент фильтров статистики
 */
const StatsFilters = ({
  emulatorFilter,
  setEmulatorFilter,
  timePeriod,
  setTimePeriod,
  customDateFrom,
  setCustomDateFrom,
  customDateTo,
  setCustomDateTo,
  selectedServers,
  selectedStrategies,
  availableServers,
  availableStrategies,
  handleServerToggle,
  handleStrategyToggle,
  onApplyCustomDates,
  // Dropdown states
  emulatorDropdownOpen,
  setEmulatorDropdownOpen,
  timeDropdownOpen,
  setTimeDropdownOpen,
  serverDropdownOpen,
  setServerDropdownOpen,
  strategyDropdownOpen,
  setStrategyDropdownOpen,
}) => {
  
  const closeAllDropdowns = () => {
    setEmulatorDropdownOpen(false);
    setTimeDropdownOpen(false);
    setServerDropdownOpen(false);
    setStrategyDropdownOpen(false);
  };
  
  const toggleDropdown = (dropdown) => {
    closeAllDropdowns();
    switch (dropdown) {
      case 'emulator':
        setEmulatorDropdownOpen(!emulatorDropdownOpen);
        break;
      case 'time':
        setTimeDropdownOpen(!timeDropdownOpen);
        break;
      case 'server':
        setServerDropdownOpen(!serverDropdownOpen);
        break;
      case 'strategy':
        setStrategyDropdownOpen(!strategyDropdownOpen);
        break;
      default:
        break;
    }
  };
  
  return (
    <div className={styles.filters}>
      {/* Эмулятор */}
      <div className={`${styles.dropdown} dropdown-container`}>
        <button 
          className={styles.dropdownButton}
          onClick={() => toggleDropdown('emulator')}
        >
          {emulatorFilter === 'all' ? '🎮 Все' : emulatorFilter === 'real' ? '💰 Реальные' : '🎮 Эмулятор'}
          <span className={styles.dropdownArrow}>{emulatorDropdownOpen ? '▲' : '▼'}</span>
        </button>
        
        {emulatorDropdownOpen && (
          <div className={styles.dropdownMenu}>
            <label className={styles.dropdownItem} onClick={() => { setEmulatorFilter('all'); setEmulatorDropdownOpen(false); }}>
              <input type="radio" checked={emulatorFilter === 'all'} onChange={() => {}} />
              <span>🎮 Все</span>
            </label>
            <label className={styles.dropdownItem} onClick={() => { setEmulatorFilter('real'); setEmulatorDropdownOpen(false); }}>
              <input type="radio" checked={emulatorFilter === 'real'} onChange={() => {}} />
              <span>💰 Реальные</span>
            </label>
            <label className={styles.dropdownItem} onClick={() => { setEmulatorFilter('emulator'); setEmulatorDropdownOpen(false); }}>
              <input type="radio" checked={emulatorFilter === 'emulator'} onChange={() => {}} />
              <span>🎮 Эмулятор</span>
            </label>
          </div>
        )}
      </div>

      {/* Период времени */}
      <div className={`${styles.dropdown} dropdown-container`}>
        <button 
          className={styles.dropdownButton}
          onClick={() => toggleDropdown('time')}
        >
          {getTimePeriodText(timePeriod, customDateFrom, customDateTo)}
          <span className={styles.dropdownArrow}>{timeDropdownOpen ? '▲' : '▼'}</span>
        </button>
        
        {timeDropdownOpen && (
          <div className={styles.dropdownMenu}>
            <label className={styles.dropdownItem} onClick={() => { setTimePeriod('today'); setTimeDropdownOpen(false); }}>
              <input type="radio" checked={timePeriod === 'today'} onChange={() => {}} />
              <span>📅 За сегодня</span>
            </label>
            <label className={styles.dropdownItem} onClick={() => { setTimePeriod('week'); setTimeDropdownOpen(false); }}>
              <input type="radio" checked={timePeriod === 'week'} onChange={() => {}} />
              <span>📅 За неделю</span>
            </label>
            <label className={styles.dropdownItem} onClick={() => { setTimePeriod('month'); setTimeDropdownOpen(false); }}>
              <input type="radio" checked={timePeriod === 'month'} onChange={() => {}} />
              <span>📅 За месяц</span>
            </label>
            <label className={styles.dropdownItem} onClick={() => { setTimePeriod('all'); setTimeDropdownOpen(false); }}>
              <input type="radio" checked={timePeriod === 'all'} onChange={() => {}} />
              <span>📅 За всё время</span>
            </label>
            <label className={styles.dropdownItem} onClick={() => { setTimePeriod('custom'); }}>
              <input type="radio" checked={timePeriod === 'custom'} onChange={() => {}} />
              <span>📅 Свой период</span>
            </label>
            
            {timePeriod === 'custom' && (
              <div className={styles.customDateInputs}>
                <div className={styles.dateInputGroup}>
                  <label>От:</label>
                  <input 
                    type="date" 
                    value={customDateFrom} 
                    onChange={(e) => setCustomDateFrom(e.target.value)}
                    className={styles.dateInput}
                  />
                </div>
                <div className={styles.dateInputGroup}>
                  <label>До:</label>
                  <input 
                    type="date" 
                    value={customDateTo} 
                    onChange={(e) => setCustomDateTo(e.target.value)}
                    className={styles.dateInput}
                  />
                </div>
                <button 
                  className={styles.applyDateBtn}
                  onClick={() => {
                    if (customDateFrom && customDateTo) {
                      setTimeDropdownOpen(false);
                      onApplyCustomDates();
                    }
                  }}
                  disabled={!customDateFrom || !customDateTo}
                >
                  Применить
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Серверы */}
      <div className={`${styles.dropdown} dropdown-container`}>
        <button 
          className={styles.dropdownButton}
          onClick={() => toggleDropdown('server')}
        >
          {getServerButtonText(selectedServers, availableServers)}
          <span className={styles.dropdownArrow}>{serverDropdownOpen ? '▲' : '▼'}</span>
        </button>
        
        {serverDropdownOpen && (
          <div className={styles.dropdownMenu}>
            <label className={styles.dropdownItem}>
              <input
                type="checkbox"
                checked={selectedServers.includes('all') || selectedServers.length === 0}
                onChange={() => handleServerToggle('all')}
              />
              <span>Все боты</span>
            </label>
            {availableServers.map(server => (
              <label key={server.id} className={styles.dropdownItem}>
                <input
                  type="checkbox"
                  checked={selectedServers.includes(server.id)}
                  onChange={() => handleServerToggle(server.id)}
                />
                <span>{server.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Стратегии */}
      <div className={`${styles.dropdown} dropdown-container`}>
        <button 
          className={styles.dropdownButton}
          onClick={() => toggleDropdown('strategy')}
        >
          {getStrategyButtonText(selectedStrategies)}
          <span className={styles.dropdownArrow}>{strategyDropdownOpen ? '▲' : '▼'}</span>
        </button>
        
        {strategyDropdownOpen && (
          <div className={styles.dropdownMenu}>
            <label className={styles.dropdownItem}>
              <input
                type="checkbox"
                checked={selectedStrategies.includes('all') || selectedStrategies.length === 0}
                onChange={() => handleStrategyToggle('all')}
              />
              <span>Все стратегии</span>
            </label>
            {availableStrategies.map(strategy => (
              <label key={strategy} className={styles.dropdownItem}>
                <input
                  type="checkbox"
                  checked={selectedStrategies.includes(strategy)}
                  onChange={() => handleStrategyToggle(strategy)}
                />
                <span>{strategy}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StatsFilters;




