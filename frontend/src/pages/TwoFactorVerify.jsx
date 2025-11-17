import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authAPI } from '../api/api';
import styles from './Auth.module.css';

function TwoFactorVerify() {
  const navigate = useNavigate();
  const location = useLocation();
  const username = location.state?.username || '';
  
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authAPI.verify2FA({ code }, username);
      localStorage.setItem('token', response.data.access_token);
      navigate('/dashboard');
      window.location.reload(); // Обновляем для загрузки пользователя
    } catch (err) {
      setError(err.response?.data?.detail || 'Неверный код');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.authCard}>
        <div className={styles.header}>
          <h1>🔐 Двухфакторная аутентификация</h1>
          <p className={styles.subtitle}>
            Введите 6-значный код из Google Authenticator
          </p>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Код из приложения</label>
            <input
              type="text"
              className={styles.input}
              maxLength="6"
              pattern="[0-9]{6}"
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              autoFocus
              required
              style={{
                textAlign: 'center',
                letterSpacing: '4px',
                fontSize: '18px'
              }}
            />
            <small style={{ color: '#8b949e', marginTop: '8px', display: 'block' }}>
              Код обновляется каждые 30 секунд
            </small>
          </div>

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? 'Проверка...' : 'Войти'}
          </button>
        </form>

        <div className={styles.footer}>
          <a href="/recover-password">Забыли пароль?</a>
        </div>
      </div>
    </div>
  );
}

export default TwoFactorVerify;



