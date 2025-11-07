import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiActivity, FiMail, FiLock, FiUser } from 'react-icons/fi';
import PasswordInput from '../components/PasswordInput';
import styles from './Auth.module.css';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(username, password);
    
    if (result.success) {
      if (result.requires2FA) {
        // Перенаправляем на страницу ввода 2FA кода
        navigate('/2fa-verify', { state: { username: result.username } });
      } else {
        navigate('/dashboard');
      }
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
            <FiActivity className={styles.logoIcon} />
            <h1 className={styles.logoText}>MoonBot Commander</h1>
          </div>
          <h2 className={styles.authTitle}>Вход в систему</h2>
          <p className={styles.authSubtitle}>Управляйте своими торговыми ботами</p>
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
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Введите пароль"
              label="Пароль"
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
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>

        <div className={styles.authFooter}>
          <p>Нет аккаунта? <Link to="/register" className={styles.link}>Зарегистрироваться</Link></p>
          <p style={{ marginTop: '8px' }}>
            <Link to="/recover-password" className={styles.link}>Забыли пароль?</Link>
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

export default Login;



