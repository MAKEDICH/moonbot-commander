import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../api/api';
import { FiLock, FiCheck, FiShield } from 'react-icons/fi';
import PasswordInput from '../components/PasswordInput';
import styles from './Auth.module.css';

const ChangePassword = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    // Валидация
    if (newPassword.length < 6) {
      setError('Новый пароль должен содержать минимум 6 символов');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Новый пароль и подтверждение не совпадают');
      return;
    }

    if (currentPassword === newPassword) {
      setError('Новый пароль должен отличаться от текущего');
      return;
    }

    setLoading(true);

    try {
      await authAPI.changePassword({
        current_password: currentPassword,
        new_password: newPassword
      });
      
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      // Перенаправляем на dashboard через 2 секунды
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Ошибка изменения пароля');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.authContainer}>
      <div className={styles.authCard}>
        <div className={styles.authHeader}>
          <h2 className={styles.authTitle}>Изменение пароля</h2>
          <p className={styles.authSubtitle}>Установите новый пароль для вашего аккаунта</p>
        </div>

        <form className={styles.authForm} onSubmit={handleSubmit}>
          {error && <div className={styles.error}>{error}</div>}
          {success && (
            <div className={styles.success}>
              <FiCheck style={{ marginRight: '8px' }} />
              Пароль успешно изменен! Перенаправление...
            </div>
          )}

          <div className={styles.formGroup}>
            <PasswordInput
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Введите текущий пароль"
              label="Текущий пароль"
              icon={FiLock}
              required
              autoFocus
              inputClassName={styles.input}
              labelClassName={styles.label}
            />
          </div>

          <div className={styles.formGroup}>
            <PasswordInput
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Введите новый пароль (мин. 6 символов)"
              label="Новый пароль"
              icon={FiLock}
              required
              inputClassName={styles.input}
              labelClassName={styles.label}
            />
          </div>

          <div className={styles.formGroup}>
            <PasswordInput
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Повторите новый пароль"
              label="Подтверждение пароля"
              icon={FiLock}
              required
              inputClassName={styles.input}
              labelClassName={styles.label}
            />
          </div>

          <button 
            type="submit" 
            className={styles.submitBtn}
            disabled={loading || success}
          >
            {loading ? 'Изменение...' : success ? 'Готово!' : 'Изменить пароль'}
          </button>

          <button 
            type="button"
            className={styles.cancelBtn}
            onClick={() => navigate('/dashboard')}
            disabled={loading}
          >
            Отмена
          </button>
          
          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <button 
              type="button"
              className={styles.linkBtn}
              onClick={() => navigate('/2fa-setup')}
              style={{ 
                background: 'transparent',
                color: '#58a6ff',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'underline',
                fontSize: '14px'
              }}
            >
              <FiShield style={{ marginRight: '5px' }} />
              Настроить Google Authenticator (2FA)
            </button>
          </div>
        </form>
      </div>

      <div className={styles.backgroundDecor}>
        <div className={styles.circle1}></div>
        <div className={styles.circle2}></div>
        <div className={styles.circle3}></div>
      </div>
    </div>
  );
};

export default ChangePassword;

