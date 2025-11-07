import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../api/api';
import { FiKey, FiUser, FiLock, FiCheck } from 'react-icons/fi';
import PasswordInput from '../components/PasswordInput';
import styles from './Auth.module.css';

const RecoverPassword = () => {
  const [username, setUsername] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [remainingCodes, setRemainingCodes] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('Новый пароль должен содержать минимум 6 символов');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    setLoading(true);

    try {
      const result = await authAPI.recoverPassword({
        username,
        recovery_code: recoveryCode,
        new_password: newPassword
      });
      
      setSuccess(true);
      setRemainingCodes(result.data.remaining_codes);
      
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Ошибка восстановления пароля');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className={styles.authContainer}>
        <div className={styles.authCard}>
          <div className={styles.authHeader}>
            <FiCheck className={styles.logoIcon} style={{ fontSize: '64px', color: '#4caf50' }} />
            <h2 className={styles.authTitle}>Пароль восстановлен!</h2>
            <p className={styles.authSubtitle}>
              Вы можете войти с новым паролем
            </p>
          </div>

          {remainingCodes !== null && (
            <div className={styles.infoBox}>
              <p>
                <strong>Оставшихся recovery кодов: {remainingCodes}</strong>
              </p>
              {remainingCodes === 0 && (
                <p style={{ color: 'var(--error)', marginTop: '8px' }}>
                  У вас не осталось recovery кодов. Сохраните новый пароль!
                </p>
              )}
            </div>
          )}

          <p style={{ textAlign: 'center', marginTop: '24px' }}>
            Перенаправление на страницу входа...
          </p>
        </div>

        <div className={styles.backgroundDecor}>
          <div className={styles.circle1}></div>
          <div className={styles.circle2}></div>
          <div className={styles.circle3}></div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.authContainer}>
      <div className={styles.authCard}>
        <div className={styles.authHeader}>
          <FiKey className={styles.logoIcon} />
          <h2 className={styles.authTitle}>Восстановление пароля</h2>
          <p className={styles.authSubtitle}>
            Используйте один из ваших recovery кодов
          </p>
        </div>

        <form className={styles.authForm} onSubmit={handleSubmit}>
          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.formGroup}>
            <label className={styles.label}>
              <FiUser />
              <span>Имя пользователя</span>
            </label>
            <input
              type="text"
              className={styles.input}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Введите имя пользователя"
              required
              autoFocus
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>
              <FiKey />
              <span>Recovery код</span>
            </label>
            <input
              type="text"
              className={styles.input}
              value={recoveryCode}
              onChange={(e) => setRecoveryCode(e.target.value)}
              placeholder="XXXX-XXXX-XXXX"
              required
              style={{ fontFamily: 'monospace', letterSpacing: '2px' }}
            />
            <small style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px', display: 'block' }}>
              Один из кодов, которые вы сохранили при регистрации
            </small>
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
            disabled={loading}
          >
            {loading ? 'Восстановление...' : 'Восстановить пароль'}
          </button>
        </form>

        <div className={styles.authFooter}>
          <p>
            <Link to="/2fa-recover" className={styles.link}>
              Восстановить через Google Authenticator
            </Link>
          </p>
          <p style={{ marginTop: '8px' }}>
            Вспомнили пароль? <Link to="/login" className={styles.link}>Войти</Link>
          </p>
        </div>
      </div>

      <div className={styles.backgroundDecor}>
        <div className={styles.circle1}></div>
        <div className={styles.circle2}></div>
        <div className={styles.circle3}></div>
      </div>
    </div>
  );
};

export default RecoverPassword;

