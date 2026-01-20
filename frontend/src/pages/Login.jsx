import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiLock, FiUser, FiUpload, FiShield, FiCheck, FiX, FiFile } from 'react-icons/fi';
import PasswordInput from '../components/PasswordInput';
import styles from './Auth.module.css';
import moonbotIcon from '../assets/moonbot-icon.png';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const auth = useAuth();
  const navigate = useNavigate();

  // Состояния для восстановления из файла
  const [showRestore, setShowRestore] = useState(false);
  const [restoreFile, setRestoreFile] = useState(null);
  const [restorePassword, setRestorePassword] = useState('');
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreValidation, setRestoreValidation] = useState(null);
  const [restoreSuccess, setRestoreSuccess] = useState('');
  const fileInputRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await auth.login(username, password);
      
      if (result.success) {
        if (result.requires2FA) {
          navigate('/2fa-verify', { state: { username: result.username } });
        } else {
          navigate('/dashboard');
        }
      } else {
        setError(result.error || 'Ошибка входа');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Ошибка подключения к серверу');
    } finally {
      setLoading(false);
    }
  };

  // Выбор файла для восстановления
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setRestoreFile(file);
      setRestoreValidation(null);
      setError('');
    }
  };

  // Валидация файла
  const handleValidateFile = async () => {
    if (!restoreFile || !restorePassword) {
      setError('Выберите файл и введите пароль');
      return;
    }

    setRestoreLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', restoreFile);
      formData.append('password', restorePassword);

      const response = await fetch('/api/public/data/validate', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Ошибка валидации');
      }

      setRestoreValidation(data);
    } catch (err) {
      setError(err.message);
      setRestoreValidation(null);
    } finally {
      setRestoreLoading(false);
    }
  };

  // Полное восстановление
  const handleFullRestore = async () => {
    if (!restoreFile || !restorePassword) {
      setError('Выберите файл и введите пароль');
      return;
    }

    setRestoreLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', restoreFile);
      formData.append('password', restorePassword);

      const response = await fetch('/api/public/data/full-restore', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Ошибка восстановления');
      }

      // Успешное восстановление - авторизуем пользователя
      setRestoreSuccess(`Данные восстановлены! Пользователь: ${data.user.username}`);
      
      // Сохраняем токен и данные пользователя
      if (data.token) {
        localStorage.setItem('token', data.token);
        if (auth.setToken) auth.setToken(data.token);
        if (auth.setUser) auth.setUser(data.user);
        
        // Перенаправляем на дашборд через 2 секунды
        setTimeout(() => {
          navigate('/dashboard');
          window.location.reload(); // Перезагружаем для применения нового токена
        }, 2000);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setRestoreLoading(false);
    }
  };

  // Форматирование размера файла
  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className={styles.authContainer}>
      <div className={styles.authCard}>
        <div className={styles.authHeader}>
          <div className={styles.logoContainer}>
            <img src={moonbotIcon} alt="Moonbot" className={styles.logoIcon} />
            <h1 className={styles.logoText}>Moonbot Commander</h1>
          </div>
          <h2 className={styles.authTitle}>Вход в систему</h2>
          <p className={styles.authSubtitle}>Управляйте своими торговыми ботами</p>
        </div>

        <form className={styles.authForm} onSubmit={handleSubmit}>
          {error && <div className={styles.error}>{error}</div>}
          {restoreSuccess && <div className={styles.success}>{restoreSuccess}</div>}

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

        {/* Кнопка восстановления из файла */}
        <div className={styles.restoreSection}>
          <button 
            type="button"
            className={styles.restoreToggle}
            onClick={() => setShowRestore(!showRestore)}
          >
            <FiShield />
            <span>Восстановить из резервной копии</span>
          </button>

          {showRestore && (
            <div className={styles.restorePanel}>
              <p className={styles.restoreHint}>
                Выберите файл .mbc с резервной копией данных
              </p>

              {/* Выбор файла */}
              <div 
                className={styles.dropZone}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".mbc"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
                {restoreFile ? (
                  <div className={styles.selectedFile}>
                    <FiFile />
                    <span>{restoreFile.name}</span>
                    <span className={styles.fileSize}>
                      {formatSize(restoreFile.size)}
                    </span>
                  </div>
                ) : (
                  <div className={styles.dropZoneContent}>
                    <FiUpload size={24} />
                    <span>Выберите файл .mbc</span>
                  </div>
                )}
              </div>

              {/* Пароль от файла */}
              <div className={styles.formGroup} style={{ marginTop: '12px' }}>
                <PasswordInput
                  value={restorePassword}
                  onChange={(e) => setRestorePassword(e.target.value)}
                  placeholder="Пароль от файла"
                  label="Пароль шифрования"
                  icon={FiLock}
                  inputClassName={styles.input}
                  labelClassName={styles.label}
                />
              </div>

              {/* Кнопка валидации */}
              {!restoreValidation && (
                <button
                  type="button"
                  className={styles.restoreBtn}
                  onClick={handleValidateFile}
                  disabled={restoreLoading || !restoreFile || !restorePassword}
                >
                  {restoreLoading ? 'Проверка...' : 'Проверить файл'}
                </button>
              )}

              {/* Результат валидации */}
              {restoreValidation && (
                <div className={styles.validationResult}>
                  <div className={styles.validationHeader}>
                    <FiCheck className={styles.validIcon} />
                    <span>Файл проверен</span>
                  </div>
                  <div className={styles.validationInfo}>
                    <div className={styles.validationRow}>
                      <span>Пользователь:</span>
                      <strong>{restoreValidation.user?.username}</strong>
                    </div>
                    <div className={styles.validationRow}>
                      <span>Создан:</span>
                      <span>{new Date(restoreValidation.created_at).toLocaleString('ru-RU')}</span>
                    </div>
                    <div className={styles.validationRow}>
                      <span>Таблиц:</span>
                      <span>{Object.keys(restoreValidation.tables || {}).length}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className={styles.submitBtn}
                    onClick={handleFullRestore}
                    disabled={restoreLoading}
                    style={{ marginTop: '12px' }}
                  >
                    {restoreLoading ? 'Восстановление...' : 'Восстановить и войти'}
                  </button>

                  <button
                    type="button"
                    className={styles.cancelBtn}
                    onClick={() => {
                      setRestoreValidation(null);
                      setRestoreFile(null);
                      setRestorePassword('');
                    }}
                  >
                    <FiX /> Отмена
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

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



