import React, { useState, useEffect } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiHome, FiServer, FiCommand, FiClock, FiLogOut, FiActivity, FiUsers, FiKey, FiCalendar, FiHeart, FiCopy, FiCheck, FiTrendingUp } from 'react-icons/fi';
import styles from './Layout.module.css';

const Layout = () => {
  const { user, logout } = useAuth();
  const [showDonateModal, setShowDonateModal] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(null);
  const [secretRevealed, setSecretRevealed] = useState(false);

  const copyToClipboard = async (text, type) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAddress(type);
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Автоматически скрывать секрет через 10 секунд после раскрытия
  useEffect(() => {
    if (secretRevealed) {
      const timer = setTimeout(() => {
        setSecretRevealed(false);
      }, 10000); // 10 секунд

      return () => clearTimeout(timer);
    }
  }, [secretRevealed]);

  const navItems = [
    { path: '/dashboard', icon: <FiHome />, label: 'Панель' },
    { path: '/servers', icon: <FiServer />, label: 'Серверы' },
    { path: '/groups', icon: <FiUsers />, label: 'Группы' },
    { path: '/commands', icon: <FiCommand />, label: 'Команды' },
    { path: '/scheduled-commands', icon: <FiCalendar />, label: 'Отложенные' },
    { path: '/history', icon: <FiClock />, label: 'История' },
    { path: '/trading/orders', icon: <FiTrendingUp />, label: 'Торговля' },
  ];

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.logoSection}>
          <div className={styles.logo}>
            <FiActivity className={styles.logoIcon} />
            <h1 className={styles.logoText}>MoonBot</h1>
          </div>
          <button 
            className={styles.donateBtn} 
            onClick={() => setShowDonateModal(true)}
            title="Помощь энтузиасту"
          >
            <FiHeart />
          </button>
        </div>

        <nav className={styles.nav}>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.active : ''}`
              }
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className={styles.userSection}>
          <div className={styles.userInfo}>
            <div className={styles.avatar}>
              {user?.username?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className={styles.userDetails}>
              <div className={styles.username}>{user?.username}</div>
              <div className={styles.userEmail}>{user?.email}</div>
            </div>
          </div>
          <NavLink 
            to="/change-password" 
            className={styles.changePasswordBtn} 
            title="Изменить пароль"
          >
            <FiKey />
          </NavLink>
          <button className={styles.logoutBtn} onClick={logout} title="Выйти">
            <FiLogOut />
          </button>
        </div>
      </aside>

      <main className={styles.main}>
        <Outlet />
      </main>

      {/* Модальное окно донатов */}
      {showDonateModal && (
        <div className={styles.modalOverlay} onClick={() => setShowDonateModal(false)}>
          <div className={styles.donateModal} onClick={(e) => e.stopPropagation()}>
            <button 
              className={styles.closeModalBtn}
              onClick={() => setShowDonateModal(false)}
            >
              ×
            </button>
            
            <div className={styles.donateHeader}>
              <FiHeart className={styles.donateIcon} />
              <h2>Помощь энтузиасту</h2>
            </div>

            <div className={styles.donateContent}>
              <p className={styles.thankYouText}>
                Спасибо за ваше доверие! 🙏
              </p>
              <p className={styles.donateDescription}>
                Если этот проект оказался полезным для вас, вы можете поддержать молодого энтузиаста.
              </p>

              <div className={styles.walletSection}>
                <div className={styles.walletItem}>
                  <div className={styles.walletLabel}>
                    <span className={styles.networkBadge}>USDT (BSC BEP20)</span>
                  </div>
                  <div className={styles.walletAddress}>
                    <code>0x0a5e8c59475469705a5ca1d34554e671fe247775</code>
                    <button
                      className={styles.copyBtn}
                      onClick={() => copyToClipboard('0x0a5e8c59475469705a5ca1d34554e671fe247775', 'bsc')}
                      title="Копировать адрес"
                    >
                      {copiedAddress === 'bsc' ? <FiCheck /> : <FiCopy />}
                    </button>
                  </div>
                </div>

                <div className={styles.walletItem}>
                  <div className={styles.walletLabel}>
                    <span className={styles.networkBadge}>USDT (TRC20)</span>
                  </div>
                  <div className={styles.walletAddress}>
                    <code>TGn7BSknJ3dFhutN3kXuMyCFjm37HeGdtL</code>
                    <button
                      className={styles.copyBtn}
                      onClick={() => copyToClipboard('TGn7BSknJ3dFhutN3kXuMyCFjm37HeGdtL', 'trc')}
                      title="Копировать адрес"
                    >
                      {copiedAddress === 'trc' ? <FiCheck /> : <FiCopy />}
                    </button>
                  </div>
                </div>
              </div>

              <p className={styles.donateFooter}>
                Ваша поддержка пойдёт на бургеры! ❤️<br />
                <span 
                  className={`${styles.secretText} ${secretRevealed ? styles.revealed : ''}`}
                  onClick={() => setSecretRevealed(true)}
                  title="Нажми, чтобы узнать правду 👀"
                >
                  {secretRevealed ? '(или покупку новой квартиры)' : '█████████████████'}
                </span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;

