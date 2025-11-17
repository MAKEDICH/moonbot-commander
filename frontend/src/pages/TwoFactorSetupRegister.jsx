import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authAPI } from '../api/api';
import PasswordInput from '../components/PasswordInput';
import styles from './Auth.module.css';

function TwoFactorSetupRegister() {
  const navigate = useNavigate();
  const location = useLocation();
  const fromRegistration = location.state?.fromRegistration || false;
  const shouldLoginAfter = location.state?.shouldLoginAfter || false;
  
  const [tempCredentials, setTempCredentials] = useState({
    username: '',
    password: ''
  });
  const [step, setStep] = useState(1); // 1: login, 2: setup
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authAPI.login(tempCredentials.username, tempCredentials.password);
      localStorage.setItem('token', response.data.access_token);
      await fetchSetup();
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.detail || 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  const fetchSetup = async () => {
    try {
      const response = await authAPI.setup2FA();
      setQrCode(response.data.qr_code);
      setSecret(response.data.secret);
    } catch (err) {
      setError(err.response?.data?.detail || 'Ошибка загрузки настроек');
    }
  };

  const handleEnable = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await authAPI.enable2FA({ code });
      setSuccess('2FA успешно включен!');
      setTimeout(() => {
        localStorage.removeItem('token');
        navigate('/login');
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Неверный код');
    } finally {
      setLoading(false);
    }
  };

  if (!fromRegistration) {
    navigate('/login');
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.authCard}>
        <div className={styles.header}>
          <h1>🔐 Настройка 2FA</h1>
          <p className={styles.subtitle}>
            {step === 1 ? 'Войдите для настройки Google Authenticator' : 'Отсканируйте QR-код'}
          </p>
        </div>

        {error && <div className={styles.error}>{error}</div>}
        {success && <div className={styles.success}>{success}</div>}

        {step === 1 ? (
          <form onSubmit={handleLogin}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Имя пользователя или почта</label>
              <input
                type="text"
                className={styles.input}
                placeholder="Введите username или email"
                value={tempCredentials.username}
                onChange={(e) => setTempCredentials({...tempCredentials, username: e.target.value})}
                required
                autoFocus
              />
            </div>

            <div className={styles.formGroup}>
              <PasswordInput
                value={tempCredentials.password}
                onChange={(e) => setTempCredentials({...tempCredentials, password: e.target.value})}
                placeholder="Введите пароль"
                label="Пароль"
                required
              />
            </div>

            <div className={styles.buttonGroup}>
              <button type="submit" className={styles.submitBtn} disabled={loading}>
                {loading ? 'Вход...' : 'Продолжить'}
              </button>
              <button 
                type="button" 
                className={styles.cancelBtn}
                onClick={() => navigate('/login')}
              >
                Пропустить
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className={styles.infoBox}>
              <h3>Инструкция:</h3>
              <ol style={{ marginLeft: '20px', marginTop: '10px' }}>
                <li>Установите Google Authenticator на телефон</li>
                <li>Отсканируйте QR-код или введите секрет вручную</li>
                <li>Введите 6-значный код из приложения</li>
              </ol>
            </div>

            {qrCode && (
              <div style={{ textAlign: 'center', margin: '20px 0' }}>
                <img src={qrCode} alt="QR Code" style={{ maxWidth: '250px' }} />
                <div style={{ marginTop: '15px' }}>
                  <small style={{ color: '#8b949e' }}>
                    Секрет (для ручного ввода):<br />
                    <code style={{ 
                      background: '#161b22', 
                      padding: '5px 10px', 
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}>
                      {secret}
                    </code>
                  </small>
                </div>
              </div>
            )}

            <form onSubmit={handleEnable}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Код из Google Authenticator</label>
                <input
                  type="text"
                  className={styles.input}
                  maxLength="6"
                  pattern="[0-9]{6}"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  required
                  style={{
                    textAlign: 'center',
                    letterSpacing: '4px',
                    fontSize: '18px'
                  }}
                />
              </div>

              <div className={styles.buttonGroup}>
                <button type="submit" className={styles.submitBtn} disabled={loading}>
                  {loading ? 'Проверка...' : 'Включить 2FA'}
                </button>
                <button 
                  type="button" 
                  className={styles.cancelBtn}
                  onClick={() => {
                    localStorage.removeItem('token');
                    navigate('/login');
                  }}
                >
                  Пропустить
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default TwoFactorSetupRegister;

