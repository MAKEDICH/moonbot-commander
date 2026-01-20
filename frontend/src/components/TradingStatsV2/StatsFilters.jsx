import React from 'react';
import styles from '../../pages/TradingStats.module.css';
import { 
  getEmulatorText, 
  getTimePeriodText, 
  getServerButtonText, 
  getStrategyButtonText 
} from './statsUtils';

/**
 * Панель фильтров для статистики торговли
 */
const StatsFilters = ({
  emulatorFilter,
  setEmulatorFilter,
  timePeriod,
  setTimePeriod,
  selectedServers,
  selectedStrategies,
  availableServers,
  availableStrategies,
  onServerToggle,
  onStrategyToggle,
  dropdownStates,
  setDropdownStates
}) => {
  const toggleDropdown = (name) => {
    setDropdownStates({
      emulator: false,
      time: false,
      servers: false,
      strategies: false,
      [name]: !dropdownStates[name]
    });
  };

  return (
    <div className={styles.filters}>
      {/* Эмулятор */}
      <div className={`${styles.dropdown} dropdown-container`}>
        <button 
          className={styles.dropdownButton}
          onClick={() => toggleDropdown('emulator')}
        >
          {getEmulatorText(emulatorFilter)}
          <span className={styles.dropdownArrow}>
            {dropdownStates.emulator ? '▲' : '▼'}
          </span>
        </button>
        
        {dropdownStates.emulator && (
          <div className={styles.dropdownMenu}>
            <label 
              className={styles.dropdownItem} 
              onClick={() => { 
                setEmulatorFilter('all'); 
                setDropdownStates({ ...dropdownStates, emulator: false }); 
              }}
            >
              <input type="radio" checked={emulatorFilter === 'all'} onChange={() => {}} />
              <span>🎮 Все</span>
            </label>
            <label 
              className={styles.dropdownItem} 
              onClick={() => { 
                setEmulatorFilter('real'); 
                setDropdownStates({ ...dropdownStates, emulator: false }); 
              }}
            >
              <input type="radio" checked={emulatorFilter === 'real'} onChange={() => {}} />
              <span>💰 Реальные</span>
            </label>
            <label 
              className={styles.dropdownItem} 
              onClick={() => { 
                setEmulatorFilter('emulator'); 
                setDropdownStates({ ...dropdownStates, emulator: false }); 
              }}
            >
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
          {getTimePeriodText(timePeriod)}
          <span className={styles.dropdownArrow}>
            {dropdownStates.time ? '▲' : '▼'}
          </span>
        </button>
        
        {dropdownStates.time && (
          <div className={styles.dropdownMenu}>
            <label 
              className={styles.dropdownItem} 
              onClick={() => { 
                setTimePeriod('today'); 
                setDropdownStates({ ...dropdownStates, time: false }); 
              }}
            >
              <input type="radio" checked={timePeriod === 'today'} onChange={() => {}} />
              <span>📅 За сегодня</span>
            </label>
            <label 
              className={styles.dropdownItem} 
              onClick={() => { 
                setTimePeriod('week'); 
                setDropdownStates({ ...dropdownStates, time: false }); 
              }}
            >
              <input type="radio" checked={timePeriod === 'week'} onChange={() => {}} />
              <span>📅 За неделю</span>
            </label>
            <label 
              className={styles.dropdownItem} 
              onClick={() => { 
                setTimePeriod('month'); 
                setDropdownStates({ ...dropdownStates, time: false }); 
              }}
            >
              <input type="radio" checked={timePeriod === 'month'} onChange={() => {}} />
              <span>📅 За месяц</span>
            </label>
            <label 
              className={styles.dropdownItem} 
              onClick={() => { 
                setTimePeriod('all'); 
                setDropdownStates({ ...dropdownStates, time: false }); 
              }}
            >
              <input type="radio" checked={timePeriod === 'all'} onChange={() => {}} />
              <span>📅 За всё время</span>
            </label>
          </div>
        )}
      </div>

      {/* Серверы */}
      <div className={`${styles.dropdown} dropdown-container`}>
        <button 
          className={styles.dropdownButton}
          onClick={() => toggleDropdown('servers')}
        >
          {getServerButtonText(selectedServers, availableServers)}
          <span className={styles.dropdownArrow}>
            {dropdownStates.servers ? '▲' : '▼'}
          </span>
        </button>
        
        {dropdownStates.servers && (
          <div className={styles.dropdownMenu}>
            <label className={styles.dropdownItem}>
              <input
                type="checkbox"
                checked={selectedServers.includes('all') || selectedServers.length === 0}
                onChange={() => onServerToggle('all')}
              />
              <span>Все боты</span>
            </label>
            {availableServers.map(server => (
              <label key={server.id} className={styles.dropdownItem}>
                <input
                  type="checkbox"
                  checked={selectedServers.includes(server.id)}
                  onChange={() => onServerToggle(server.id)}
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
          onClick={() => toggleDropdown('strategies')}
        >
          {getStrategyButtonText(selectedStrategies)}
          <span className={styles.dropdownArrow}>
            {dropdownStates.strategies ? '▲' : '▼'}
          </span>
        </button>
        
        {dropdownStates.strategies && (
          <div className={styles.dropdownMenu}>
            <label className={styles.dropdownItem}>
              <input
                type="checkbox"
                checked={selectedStrategies.includes('all') || selectedStrategies.length === 0}
                onChange={() => onStrategyToggle('all')}
              />
              <span>Все стратегии</span>
            </label>
            {availableStrategies.map(strategy => (
              <label key={strategy} className={styles.dropdownItem}>
                <input
                  type="checkbox"
                  checked={selectedStrategies.includes(strategy)}
                  onChange={() => onStrategyToggle(strategy)}
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



