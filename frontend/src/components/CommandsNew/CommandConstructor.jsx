import React from 'react';
import { FiTool } from 'react-icons/fi';
import { CONSTRUCTOR_COMMANDS, STRATEGY_PARAMS } from './constants';
import styles from '../../pages/CommandsNew.module.css';

/**
 * Конструктор команд с автокомплитом параметров
 */
const CommandConstructor = ({
  selectedConstructor,
  setSelectedConstructor,
  constructorValues,
  setConstructorValues,
  buildCommandFromConstructor,
  showParamAutocomplete,
  setShowParamAutocomplete,
  filteredParams,
  setFilteredParams,
  selectParam
}) => {
  const handleConstructorValueChange = (fieldName, value) => {
    setConstructorValues(prev => ({
      ...prev,
      [fieldName]: value
    }));
    
    // Автокомплит для поля 'param' в SetParam
    if (fieldName === 'param' && selectedConstructor?.id === 'SetParam') {
      if (value.length > 0) {
        const filtered = STRATEGY_PARAMS.filter(param => 
          param.toLowerCase().includes(value.toLowerCase())
        ).slice(0, 10);
        setFilteredParams(filtered);
        setShowParamAutocomplete(true);
      } else {
        setShowParamAutocomplete(false);
        setFilteredParams([]);
      }
    } else {
      setShowParamAutocomplete(false);
    }
  };

  return (
    <div className={styles.constructor}>
      <h4><FiTool /> Конструктор команд</h4>
      
      <div className={styles.constructorButtons}>
        {CONSTRUCTOR_COMMANDS.map((cmd) => (
          <button
            key={cmd.id}
            onClick={() => {
              setSelectedConstructor(cmd);
              setConstructorValues({});
            }}
            className={`${styles.constructorBtn} ${selectedConstructor?.id === cmd.id ? styles.active : ''}`}
            title={cmd.desc}
          >
            {cmd.name}
          </button>
        ))}
      </div>

      {selectedConstructor && (
        <div className={styles.constructorForm}>
          <div className={styles.constructorHeader}>
            <strong>{selectedConstructor.name}</strong>
            <span>{selectedConstructor.desc}</span>
          </div>

          <div className={styles.constructorFields}>
            {selectedConstructor.fields.map((field) => (
              <div key={field.name} className={styles.constructorField}>
                <label>
                  {field.label}
                  {field.optional && <span className={styles.optional}> (опционально)</span>}
                </label>
                <div className={styles.autocompleteWrapper}>
                  <input
                    type="text"
                    value={constructorValues[field.name] || ''}
                    onChange={(e) => handleConstructorValueChange(field.name, e.target.value)}
                    onFocus={() => {
                      if (field.name === 'param' && selectedConstructor?.id === 'SetParam' && constructorValues[field.name]) {
                        const filtered = STRATEGY_PARAMS.filter(param => 
                          param.toLowerCase().includes(constructorValues[field.name].toLowerCase())
                        ).slice(0, 10);
                        if (filtered.length > 0) {
                          setFilteredParams(filtered);
                          setShowParamAutocomplete(true);
                        }
                      }
                    }}
                    placeholder={field.placeholder}
                    className={styles.input}
                  />
                  {field.name === 'param' && selectedConstructor?.id === 'SetParam' && showParamAutocomplete && filteredParams.length > 0 && (
                    <div className={styles.autocompleteDropdown}>
                      {filteredParams.map((param, index) => (
                        <div
                          key={index}
                          className={styles.autocompleteItem}
                          onClick={() => selectParam(param)}
                        >
                          {param}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={buildCommandFromConstructor}
            className={styles.constructorAddBtn}
          >
            ➕ Добавить команду
          </button>
        </div>
      )}
    </div>
  );
};

export default CommandConstructor;





