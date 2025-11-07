import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../api/api';
import PasswordInput from '../components/PasswordInput';
import styles from './Auth.module.css';

function Recover2FAPassword() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    totp_code: '',
    new_password: '',
    confirm_password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (formData.new_password !== formData.confirm_password) {
      setError('Пароли не совпадают');
      return;
    }

    if (formData.new_password.length < 6) {
      setError('Пароль должен быть минимум 6 символов');
      return;
    }

    setLoading(true);

    try {
      const response = await authAPI.recover2FAPassword({
        username: formData.username,
        totp_code: formData.totp_code,
        new_password: formData.new_password
      });
      
      setSuccess(response.data.message);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Ошибка восстановления пароля');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.authCard}>
        <div className={styles.header}>
          <h1>🔐 Восстановление через 2FA</h1>
          <p className={styles.subtitle}>
            Используйте Google Authenticator для восстановления доступа
          </p>
        </div>

        {error && <div className={styles.error}>{error}</div>}
        {success && <div className={styles.success}>{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label>Имя пользователя или почта</label>
            <input
              type="text"
              name="username"
              placeholder="Введите username или email"
              value={formData.username}
              onChange={handleChange}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label>Код из Google Authenticator</label>
            <input
              type="text"
              name="totp_code"
              maxLength="6"
              pattern="[0-9]{6}"
              placeholder="000000"
              value={formData.totp_code}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                totp_code: e.target.value.replace(/\D/g, '') 
              }))}
              required
              style={{
                color: '#000000',
                backgroundColor: '#ffffff',
                border: '2px solid #00f5ff',
                padding: '12px',
                fontSize: '18px',
                borderRadius: '8px',
                width: '100%',
                textAlign: 'center',
                letterSpacing: '4px'
              }}
            />
            <small style={{ color: '#8b949e' }}>
              6-значный код из приложения
            </small>
          </div>

          <div className={styles.formGroup}>
            <PasswordInput
              value={formData.new_password}
              onChange={handleChange}
              name="new_password"
              placeholder="Минимум 6 символов"
              label="Новый пароль"
              required
            />
          </div>

          <div className={styles.formGroup}>
            <PasswordInput
              value={formData.confirm_password}
              onChange={handleChange}
              name="confirm_password"
              placeholder="Повторите новый пароль"
              label="Подтвердите новый пароль"
              required
            />
          </div>

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? 'Восстановление...' : 'Восстановить пароль'}
          </button>
        </form>

        <div className={styles.footer}>
          <Link to="/recover-password">← Использовать recovery код</Link>
          <Link to="/login">Вход</Link>
        </div>
      </div>
    </div>
  );
}

export default Recover2FAPassword;

