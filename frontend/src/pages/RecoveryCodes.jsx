import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiDownload, FiCopy, FiCheck, FiAlertTriangle, FiKey, FiShield } from 'react-icons/fi';
import styles from './Auth.module.css';
import { useNotification } from '../context/NotificationContext';

const RecoveryCodes = () => {
  const { warning } = useNotification();
  const navigate = useNavigate();
  const location = useLocation();
  const codes = location.state?.recovery_codes || [];
  const [copied, setCopied] = useState(false);

  if (!codes || codes.length === 0) {
    navigate('/login');
    return null;
  }

  const handleCopy = () => {
    // Копируем все коды с заголовком
    const text = `Moonbot Commander - Recovery Codes\n\n${codes.join('\n')}\n\nСохраните эти коды в безопасном месте!\nКаждый код можно использовать только один раз.`;
    
    // Проверяем доступность Clipboard API (работает только на HTTPS или localhost)
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch((err) => {
          console.error('Clipboard API failed:', err);
          fallbackCopy(text);
        });
    } else {
      // Fallback для HTTP соединений
      fallbackCopy(text);
    }
  };

  const fallbackCopy = (text) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      document.execCommand('copy');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Fallback copy failed:', err);
      warning('Не удалось скопировать. Пожалуйста, скопируйте коды вручную или скачайте файл.');
    }
    
    document.body.removeChild(textArea);
  };

  const handleDownload = () => {
    const text = `Moonbot Commander - Recovery Codes\n\n${codes.join('\n')}\n\nСохраните эти коды в безопасном месте!\nКаждый код можно использовать только один раз.`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'moonbot_recovery_codes.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.authContainer}>
      <div className={styles.authCard} style={{ maxWidth: '600px' }}>
        <div className={styles.authHeader}>
          <FiKey className={styles.logoIcon} style={{ fontSize: '48px', color: 'var(--accent)' }} />
          <h2 className={styles.authTitle}>Сохраните Recovery коды</h2>
          <p className={styles.authSubtitle}>
            Эти коды позволят восстановить доступ, если вы забудете пароль
          </p>
        </div>

        <div className={styles.warningBox}>
          <FiAlertTriangle style={{ marginRight: '12px', fontSize: '24px' }} />
          <div>
            <strong>Важно!</strong>
            <p>• Каждый код можно использовать только один раз</p>
            <p>• Храните их в безопасном месте (не в браузере!)</p>
            <p>• Эти коды больше не будут показаны</p>
          </div>
        </div>

        <div className={styles.codesContainer}>
          {codes.map((code, index) => (
            <div key={index} className={styles.codeItem}>
              <span className={styles.codeNumber}>{index + 1}.</span>
              <code className={styles.code}>{code}</code>
            </div>
          ))}
        </div>

        <div className={styles.buttonGroup}>
          <button 
            className={styles.submitBtn}
            onClick={handleDownload}
          >
            <FiDownload style={{ marginRight: '8px' }} />
            Скачать коды
          </button>

          <button 
            className={styles.cancelBtn}
            onClick={handleCopy}
            disabled={copied}
          >
            {copied ? <FiCheck style={{ marginRight: '8px' }} /> : <FiCopy style={{ marginRight: '8px' }} />}
            {copied ? 'Скопировано!' : 'Копировать'}
          </button>
        </div>

        <button 
          className={styles.continueBtn}
          onClick={() => navigate('/login')}
          style={{ marginTop: '10px' }}
        >
          Продолжить без 2FA → Вход
        </button>
        
        <div style={{ marginTop: '20px', textAlign: 'center', padding: '20px', background: '#161b22', borderRadius: '8px' }}>
          <FiShield style={{ fontSize: '32px', color: '#58a6ff', marginBottom: '10px' }} />
          <h3 style={{ color: '#c9d1d9', marginBottom: '10px' }}>Дополнительная защита</h3>
          <p style={{ color: '#8b949e', fontSize: '14px', marginBottom: '15px' }}>
            Настройте Google Authenticator для максимальной безопасности.<br />
            При входе потребуется код из приложения на телефоне.
          </p>
          <button 
            className={styles.submitBtn}
            onClick={() => navigate('/2fa-setup-register', { 
              state: { fromRegistration: true, shouldLoginAfter: true } 
            })}
            style={{ width: '100%' }}
          >
            <FiShield style={{ marginRight: '8px' }} />
            Настроить 2FA сейчас (опционально)
          </button>
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

export default RecoveryCodes;

