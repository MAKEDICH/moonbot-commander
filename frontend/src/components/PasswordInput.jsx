import React, { useState, useEffect } from 'react';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import styles from './PasswordInput.module.css';

const PasswordInput = ({ 
  value, 
  onChange, 
  placeholder = 'Введите пароль',
  name,
  required = false,
  autoFocus = false,
  label,
  icon: LabelIcon,
  inputClassName = '',
  labelClassName = ''
}) => {
  const [showPassword, setShowPassword] = useState(false);

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  // Автоматически скрывать пароль через 5 секунд после показа
  useEffect(() => {
    if (showPassword) {
      const timer = setTimeout(() => {
        setShowPassword(false);
      }, 5000); // 5 секунд

      return () => clearTimeout(timer);
    }
  }, [showPassword]);

  return (
    <div className={styles.passwordWrapper}>
      {label && (
        <label className={labelClassName}>
          {LabelIcon && <LabelIcon />}
          <span>{label}</span>
        </label>
      )}
      <div className={styles.inputWrapper}>
        <input
          type={showPassword ? 'text' : 'password'}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          autoFocus={autoFocus}
          className={inputClassName}
        />
        <button
          type="button"
          className={styles.eyeButton}
          onClick={togglePasswordVisibility}
          aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
        >
          {showPassword ? <FiEyeOff /> : <FiEye />}
        </button>
      </div>
    </div>
  );
};

export default PasswordInput;



