import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiActivity, FiMail, FiLock, FiUser } from 'react-icons/fi';
import PasswordInput from '../components/PasswordInput';
import styles from './Auth.module.css';

const Register = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    if (password.length < 6) {
      setError('Пароль должен содержать минимум 6 символов');
      return;
    }

    setLoading(true);

    const result = await register(username, email, password);
    
    if (result.success) {
      // Перенаправляем на страницу с recovery кодами
      navigate('/recovery-codes', { state: { recovery_codes: result.recovery_codes } });
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

  return (
    <div className={styles.authContainer}>
      <div className={styles.authCard}>
        <div className={styles.authHeader}>
          <div className={styles.logoContainer}>
            <img src={moonbotIcon} alt="Moonbot" className={styles.logoIcon} />
            <h1 className={styles.logoText}>MoonBot Commander</h1>
          </div>
          <h2 className={styles.authTitle}>Регистрация</h2>
          <p className={styles.authSubtitle}>Создайте аккаунт для управления ботами</p>
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
              minLength={3}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>
              <FiMail />
              <span>Email</span>
            </label>
            <input
              type="email"
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Введите email"
              required
            />
          </div>

          <div className={styles.formGroup}>
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Введите пароль (мин. 6 символов)"
              label="Пароль"
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
              placeholder="Повторите пароль"
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
            {loading ? 'Регистрация...' : 'Зарегистрироваться'}
          </button>
        </form>

        <div className={styles.authFooter}>
          <p>Уже есть аккаунт? <Link to="/login" className={styles.link}>Войти</Link></p>
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

export default Register;



