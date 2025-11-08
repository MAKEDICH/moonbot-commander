import React, { useState, useEffect } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiHome, FiServer, FiCommand, FiClock, FiLogOut, FiUsers, FiKey, FiCalendar, FiHeart, FiCopy, FiCheck, FiTrendingUp, FiMenu, FiX } from 'react-icons/fi';
import styles from './Layout.module.css';
import moonbotIcon from '../assets/moonbot-icon.png';

const Layout = () => {
  const { user, logout } = useAuth();
  const [showDonateModal, setShowDonateModal] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(null);
  const [secretRevealed, setSecretRevealed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    { path: '/trading/logs', icon: <FiTrendingUp />, label: 'Торговля' },
  ];

  // Закрытие меню при клике на ссылку (для мобильных)
  const handleNavClick = () => {
    setMobileMenuOpen(false);
  };

  // Закрытие меню по нажатию Escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [mobileMenuOpen]);

  // Блокировка скролла body когда меню открыто
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  return (
    <div className={styles.layout}>
      {/* Кнопка гамбургер-меню для мобильных */}
      <button 
        className={styles.mobileMenuToggle} 
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        aria-label="Открыть меню"
      >
        {mobileMenuOpen ? <FiX /> : <FiMenu />}
      </button>

      {/* Оверлей для мобильного меню */}
      {mobileMenuOpen && (
        <div 
          className={styles.mobileOverlay} 
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside className={`${styles.sidebar} ${mobileMenuOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.logoSection}>
          <div className={styles.logo}>
            <img src={moonbotIcon} alt="Moonbot" className={styles.logoIcon} />
            <div className={styles.logoTextContainer}>
              <h1 className={styles.logoText}>Moonbot</h1>
              <span className={styles.logoSubtext}>Commander</span>
            </div>
          </div>
        </div>

        <nav className={styles.nav}>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.active : ''}`
              }
              onClick={handleNavClick}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Блок поддержки проекта */}
        <div 
          className={styles.supportSection}
          onClick={() => setShowDonateModal(true)}
          role="button"
          tabIndex={0}
          onKeyPress={(e) => e.key === 'Enter' && setShowDonateModal(true)}
        >
          <div className={styles.supportTitle}>
            Поддержка проекта 💖
          </div>
          <div className={styles.supportWallet}>
            <div className={styles.supportBadge}>EVM Networks</div>
            <div className={styles.supportAddress}>0x374c083106189a364a3412dfb66297a4dc991af4</div>
          </div>
          <div className={styles.supportNote}>
            BSC, Ethereum, Polygon, Arbitrum и другие
          </div>
        </div>

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
                    <span className={styles.networkBadge}>EVM Networks (одинадрес для всех сетей)</span>
                  </div>
                  <div className={styles.walletAddress}>
                    <code>0x374c083106189a364a3412dfb66297a4dc991af4</code>
                    <button
                      className={styles.copyBtn}
                      onClick={() => copyToClipboard('0x374c083106189a364a3412dfb66297a4dc991af4', 'evm')}
                      title="Копировать адрес"
                    >
                      {copiedAddress === 'evm' ? <FiCheck /> : <FiCopy />}
                    </button>
                  </div>
                  <div className={styles.networksList}>
                    <p><strong>Поддерживаемые сети:</strong></p>
                    <ul>
                      <li><strong>BSC (BNB Smart Chain)</strong> - USDT (BEP20), USDC, BNB | Комиссия: ~$0.20 ⭐</li>
                      <li><strong>Polygon</strong> - USDT, USDC, MATIC | Комиссия: ~$0.01</li>
                      <li><strong>Arbitrum</strong> - USDT, USDC, ETH | Комиссия: ~$0.10</li>
                      <li><strong>Optimism</strong> - USDT, USDC, ETH | Комиссия: ~$0.10</li>
                      <li><strong>Base</strong> - USDT, USDC, ETH | Комиссия: ~$0.10</li>
                      <li><strong>Ethereum</strong> - USDT (ERC20), USDC, ETH | Комиссия: ~$10-50</li>
                      <li><strong>Avalanche C-Chain</strong> - USDT, USDC, AVAX | Комиссия: ~$0.50</li>
                      <li><strong>Fantom</strong> - USDT, USDC, FTM | Комиссия: ~$0.05</li>
                    </ul>
                    <p className={styles.warningText}>⚠️ <strong>Важно:</strong> При отправке обязательно выберите правильную сеть! Один адрес работает во всех EVM-сетях, но токены отправленные не в ту сеть могут быть потеряны.</p>
                    <p className={styles.recommendText}>💡 <strong>Рекомендуем:</strong> USDT через BSC (BEP20) - самые низкие комиссии и быстрое подтверждение.</p>
                  </div>
                </div>
              </div>

              <p className={styles.donateFooter}>
                Ваша поддержка пойдёт на развитие новых проектов<br />
                <span 
                  className={`${styles.secretText} ${secretRevealed ? styles.revealed : ''}`}
                  onClick={() => setSecretRevealed(true)}
                  title="Нажми, чтобы узнать правду 👀"
                >
                  {secretRevealed ? 'или покупку бургеров 😄❤️' : '█████████████████'}
                </span>
                <br />
                <span className={styles.trademark}>MAKEDICH tm</span>
                <br />
                <a 
                  href="https://t.me/MAKEDICH" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className={styles.telegramLink}
                >
                  <span className={styles.telegramIcon}>✈️</span>
                  Связаться в Telegram
                </a>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;

