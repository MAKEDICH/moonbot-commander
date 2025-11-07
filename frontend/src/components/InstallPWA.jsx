import React, { useState, useEffect } from 'react';
import styles from './InstallPWA.module.css';
import { FiDownload, FiX } from 'react-icons/fi';

const InstallPWA = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      // Предотвращаем стандартный промпт
      e.preventDefault();
      // Сохраняем событие для последующего использования
      setDeferredPrompt(e);
      // Показываем нашу кнопку установки
      setShowInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Проверяем, не установлено ли уже приложение
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowInstallBanner(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    // Показываем промпт установки
    deferredPrompt.prompt();

    // Ждем выбора пользователя
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('✅ Пользователь принял установку');
    } else {
      console.log('❌ Пользователь отклонил установку');
    }

    // Очищаем промпт
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  const handleClose = () => {
    setShowInstallBanner(false);
    // Сохраняем в localStorage, чтобы не показывать снова
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  // Проверяем, был ли баннер закрыт ранее
  useEffect(() => {
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed && showInstallBanner) {
      setShowInstallBanner(false);
    }
  }, [showInstallBanner]);

  if (!showInstallBanner) return null;

  return (
    <div className={styles.installBanner}>
      <div className={styles.content}>
        <FiDownload className={styles.icon} />
        <div className={styles.text}>
          <h3>Установите приложение</h3>
          <p>Быстрый доступ с главного экрана</p>
        </div>
        <button onClick={handleInstall} className={styles.installBtn}>
          Установить
        </button>
        <button onClick={handleClose} className={styles.closeBtn}>
          <FiX />
        </button>
      </div>
    </div>
  );
};

export default InstallPWA;





