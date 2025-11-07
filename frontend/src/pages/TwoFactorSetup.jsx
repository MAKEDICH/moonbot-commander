import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../api/api';
import styles from './Auth.module.css';

function TwoFactorSetup() {
  const navigate = useNavigate();
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchSetup();
  }, []);

  const fetchSetup = async () => {
    try {
      const response = await authAPI.setup2FA();
      setQrCode(response.data.qr_code);
      setSecret(response.data.secret);
      setEnabled(response.data.enabled);
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
      setEnabled(true);
      setTimeout(() => navigate('/change-password'), 2000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Неверный код');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await authAPI.disable2FA({ code });
      setSuccess('2FA отключен');
      setEnabled(false);
      setCode('');
      await fetchSetup(); // Обновляем данные
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
          <h1>🔐 Google Authenticator</h1>
          <p className={styles.subtitle}>
            {enabled ? 'Двухфакторная аутентификация включена' : 'Настройка двухфакторной аутентификации'}
          </p>
        </div>

        {error && <div className={styles.error}>{error}</div>}
        {success && <div className={styles.success}>{success}</div>}

        {!enabled ? (
          <>
            <div className={styles.infoBox}>
              <h3>Инструкция:</h3>
              <ol style={{ marginLeft: '20px', marginTop: '10px' }}>
                <li>Установите Google Authenticator на телефон</li>
                <li>Отсканируйте QR-код или введите секрет вручную</li>
                <li>Введите 6-значный код из приложения для подтверждения</li>
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
                <label>Код из Google Authenticator</label>
                <input
                  type="text"
                  maxLength="6"
                  pattern="[0-9]{6}"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
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
              </div>

              <div className={styles.buttonGroup}>
                <button type="submit" className={styles.submitBtn} disabled={loading}>
                  {loading ? 'Проверка...' : 'Включить 2FA'}
                </button>
                <button 
                  type="button" 
                  className={styles.cancelBtn}
                  onClick={() => navigate('/change-password')}
                >
                  Отмена
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <div className={styles.success} style={{ marginBottom: '20px' }}>
              ✅ Двухфакторная аутентификация активна
            </div>

            <div className={styles.warningBox}>
              <strong>⚠️ Отключение 2FA</strong>
              <p style={{ marginTop: '10px', marginBottom: '0' }}>
                Введите текущий код из Google Authenticator для отключения
              </p>
            </div>

            <form onSubmit={handleDisable}>
              <div className={styles.formGroup}>
                <label>Код из Google Authenticator</label>
                <input
                  type="text"
                  maxLength="6"
                  pattern="[0-9]{6}"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
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
              </div>

              <div className={styles.buttonGroup}>
                <button 
                  type="submit" 
                  className={styles.cancelBtn}
                  disabled={loading}
                  style={{ background: '#da3633' }}
                >
                  {loading ? 'Отключение...' : 'Отключить 2FA'}
                </button>
                <button 
                  type="button" 
                  className={styles.submitBtn}
                  onClick={() => navigate('/change-password')}
                >
                  Назад
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default TwoFactorSetup;



