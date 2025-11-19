import React, { useState, useEffect, useRef } from 'react';
import { dashboardAPI, serverStatusAPI, userSettingsAPI } from '../api/api';
import styles from './Dashboard.module.css';
import { FiServer, FiActivity, FiCheckCircle, FiXCircle, FiClock, FiTrendingUp, FiSettings, FiAlertCircle, FiPlay, FiPause, FiRefreshCw, FiGrid, FiList, FiTrash2 } from 'react-icons/fi';
import moonbotIcon from '../assets/moonbot-icon.png';
import Cleanup from './Cleanup';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [serversWithStatus, setServersWithStatus] = useState([]);
  const [commandsDaily, setCommandsDaily] = useState([]);
  const [serverUptime, setServerUptime] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [pingInterval, setPingInterval] = useState(30);
  const [autoPingEnabled, setAutoPingEnabled] = useState(() => {
    // Восстанавливаем состояние автопроверки из localStorage
    const saved = localStorage.getItem('dashboardAutoPingEnabled');
    return saved === 'true';
  });
  const [testingServers, setTestingServers] = useState(new Set());
  const intervalRef = useRef(null);
  
  // ДОБАВЛЕНО: State для toast-уведомлений
  const [toast, setToast] = useState(null);
  
  // ДОБАВЛЕНО: State для модального окна очистки
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  
  // ДОБАВЛЕНО: Переключатель вида (полный/компактный)
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('dashboardViewMode') || 'full';
  });

  useEffect(() => {
    loadDashboardData();
    loadSettings();
  }, []);

  useEffect(() => {
    if (!settings || !autoPingEnabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // ИСПРАВЛЕНО: Удалили serversWithStatus из зависимостей!
    // РАЗМЫШЛЕНИЕ: serversWithStatus меняется при каждом ping →
    // это вызывало бесконечный loop: ping → update state → useEffect → ping
    
    // Автоматический пинг серверов по интервалу
    // ВАЖНО: Используем стабильный интервал который не зависит от visibility вкладки
    const startAutoPing = () => {
      // Сразу выполняем первый пинг
      pingAllServers();
      
      // Затем запускаем интервал
      intervalRef.current = setInterval(() => {
        pingAllServers();
      }, settings.ping_interval * 1000);
    };

    startAutoPing();

    // ДОБАВЛЕНО: Обработчик visibilitychange для поддержания автопроверки
    // Когда пользователь возвращается на вкладку, проверяем что интервал работает
    const handleVisibilityChange = () => {
      if (!document.hidden && autoPingEnabled && !intervalRef.current) {
        // Вкладка стала видимой, а интервал почему-то остановился - перезапускаем
        console.log('[Dashboard] Вкладка активна, перезапускаем автопроверку');
        startAutoPing();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [settings, autoPingEnabled]);  // ИСПРАВЛЕНО: Без serversWithStatus!

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // ИСПРАВЛЕНО: Promise.allSettled вместо Promise.all!
      // РАЗМЫШЛЕНИЕ: Если dailyRes упадет → весь Dashboard упадет!
      // allSettled продолжает работать даже если один запрос упал
      const [statsRes, serversRes, dailyRes, uptimeRes] = await Promise.allSettled([
        dashboardAPI.getStats(),
        serverStatusAPI.getAllWithStatus(),
        dashboardAPI.getCommandsDaily(7),
        dashboardAPI.getServerUptime()
      ]);

      // Обрабатываем результаты с проверкой статуса
      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value.data);
      } else {
        console.error('Failed to load stats:', statsRes.reason);
        // Устанавливаем дефолтные значения если не загрузилось
        setStats({
          total_servers: 0,
          total_commands_all_time: 0,
          total_commands_today: 0,
          successful_commands_today: 0,
          avg_response_time: null
        });
      }

      if (serversRes.status === 'fulfilled') {
        setServersWithStatus(serversRes.value.data);
      } else {
        console.error('Failed to load servers:', serversRes.reason);
        setServersWithStatus([]);
      }

      if (dailyRes.status === 'fulfilled') {
        setCommandsDaily(dailyRes.value.data);
      } else {
        console.error('Failed to load daily commands:', dailyRes.reason);
        setCommandsDaily([]);
      }

      if (uptimeRes.status === 'fulfilled') {
        setServerUptime(uptimeRes.value.data);
      } else {
        console.error('Failed to load uptime:', uptimeRes.reason);
        setServerUptime([]);
      }
    } catch (error) {
      console.error('Ошибка загрузки дашборда:', error);
      // Устанавливаем минимальные значения чтобы Dashboard не упал полностью
      setStats({
        total_servers: 0,
        total_commands_all_time: 0,
        total_commands_today: 0,
        successful_commands_today: 0,
        avg_response_time: null
      });
      setServersWithStatus([]);
    } finally {
      setLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      const res = await userSettingsAPI.get();
      setSettings(res.data);
      setPingInterval(res.data.ping_interval);
    } catch (error) {
      console.error('Ошибка загрузки настроек:', error);
    }
  };

  const pingAllServers = async () => {
    try {
      const pingPromises = serversWithStatus.map(server =>
        serverStatusAPI.ping(server.id).catch(err => console.error(`Ping failed for ${server.name}:`, err))
      );
      await Promise.all(pingPromises);
      
      // Обновляем статусы после пинга
      const serversRes = await serverStatusAPI.getAllWithStatus();
      setServersWithStatus(serversRes.data);
      
      // Показываем уведомление если есть оффлайн серверы
      const offlineServers = serversRes.data.filter(s => s.status && !s.status.is_online);
      if (offlineServers.length > 0 && settings?.enable_notifications) {
        showNotification(`⚠️ ${offlineServers.length} серверов оффлайн`);
      }
    } catch (error) {
      console.error('Ошибка пинга серверов:', error);
    }
  };

  const showNotification = (message) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('MoonBot Commander', {
        body: message,
        icon: '/favicon.ico'
      });
    }
    
    // ИСПРАВЛЕНО: Очищаем Audio после проигрывания
    // РАЗМЫШЛЕНИЕ: Audio объекты не очищаются автоматически!
    // При частых уведомлениях → memory leak
    if (settings?.notification_sound) {
      const audio = new Audio('/notification.mp3');
      audio.play()
        .then(() => {
          // Очищаем после проигрывания
          audio.src = '';
          audio.remove();
        })
        .catch(() => {
          // Очищаем даже при ошибке
          audio.src = '';
          audio.remove();
        });
    }
  };

  // ДОБАВЛЕНО: Функция для показа Toast вместо alert()
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSaveSettings = async () => {
    try {
      await userSettingsAPI.update({ ping_interval: pingInterval });
      await loadSettings();
      setShowSettings(false);
      // ИСПРАВЛЕНО: Toast вместо alert()!
      showToast('Настройки сохранены!', 'success');
    } catch (error) {
      console.error('Ошибка сохранения настроек:', error);
      // ИСПРАВЛЕНО: Toast вместо alert()!
      showToast('Ошибка сохранения настроек', 'error');
    }
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  };

  const handleTestServer = async (serverId) => {
    setTestingServers(prev => new Set([...prev, serverId]));
    
    try {
      await serverStatusAPI.ping(serverId);
      
      // Обновляем статус после теста
      const serversRes = await serverStatusAPI.getAllWithStatus();
      setServersWithStatus(serversRes.data);
      
      // Обновляем общую статистику
      const statsRes = await dashboardAPI.getStats();
      setStats(statsRes.data);
      
      // ДОБАВЛЕНО: Toast уведомление
      showToast('Сервер проверен!', 'success');
    } catch (error) {
      console.error('Ошибка теста сервера:', error);
      // ИСПРАВЛЕНО: Toast вместо alert()!
      showToast('Ошибка при проверке сервера', 'error');
    } finally {
      setTestingServers(prev => {
        const newSet = new Set(prev);
        newSet.delete(serverId);
        return newSet;
      });
    }
  };

  const toggleAutoPing = () => {
    setAutoPingEnabled(prev => {
      const newValue = !prev;
      // Сохраняем состояние в localStorage
      localStorage.setItem('dashboardAutoPingEnabled', newValue.toString());
      return newValue;
    });
  };

  // ДОБАВЛЕНО: Функция переключения вида
  const toggleViewMode = () => {
    const newMode = viewMode === 'full' ? 'compact' : 'full';
    setViewMode(newMode);
    localStorage.setItem('dashboardViewMode', newMode);
  };

  if (loading || !stats) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Загрузка дашборда...</p>
      </div>
    );
  }

  const onlineServers = serversWithStatus.filter(s => s.status?.is_online).length;
  const offlineServers = serversWithStatus.length - onlineServers;

  return (
    <div className={styles.dashboard}>
      {/* Информационный блок о Moonbot */}
      <div className={styles.moonbotInfo}>
        <div className={styles.moonbotContent}>
          <div className={styles.moonbotIcon}>
            <img src={moonbotIcon} alt="Moonbot" />
          </div>
          <div className={styles.moonbotText}>
            <h3>Developed for <span className={styles.moonbotHighlight}>Moonbot</span></h3>
            <p>
              Этот проект предназначен для работы с терминалами{' '}
              <strong>Moonbot</strong> - лучшему решению для криптотрейдинга
            </p>
          </div>
          <a 
            href="https://moonbot.pro/" 
            target="_blank" 
            rel="noopener noreferrer"
            className={styles.moonbotLink}
          >
            Посетить сайт Moonbot
          </a>
        </div>
      </div>

      <div className={styles.header}>
        <h1><FiActivity /> Дашборд</h1>
        <div className={styles.headerActions}>
          <button onClick={() => setShowCleanupModal(true)} className={styles.cleanupBtn} title="Управление очисткой данных">
            <FiTrash2 /> Очистка
          </button>
        <button onClick={() => setShowSettings(true)} className={styles.settingsBtn}>
          <FiSettings /> Настройки
        </button>
        </div>
      </div>

      {/* Статистические карточки */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard} style={{
          '--card-glow': 'rgba(0, 245, 255, 0.15)',
          '--icon-bg-start': 'rgba(0, 245, 255, 0.2)',
          '--icon-bg-end': 'rgba(0, 200, 255, 0.05)',
          '--icon-shadow': 'rgba(0, 245, 255, 0.4)',
          '--icon-glow': '#00f5ff'
        }}>
          <div className={styles.statIcon}>
            <FiServer style={{color: '#00f5ff'}} />
          </div>
          <div className={styles.statInfo}>
            <h3>{stats.total_servers}</h3>
            <p>Серверов</p>
          </div>
        </div>

        <div className={styles.statCard} style={{
          '--card-glow': 'rgba(0, 255, 136, 0.15)',
          '--icon-bg-start': 'rgba(0, 255, 136, 0.2)',
          '--icon-bg-end': 'rgba(0, 255, 136, 0.05)',
          '--icon-shadow': 'rgba(0, 255, 136, 0.4)',
          '--icon-glow': '#00ff88'
        }}>
          <div className={styles.statIcon}>
            <FiCheckCircle style={{color: '#00ff88'}} />
          </div>
          <div className={styles.statInfo}>
            <h3>{onlineServers}</h3>
            <p>Онлайн</p>
          </div>
        </div>

        <div className={styles.statCard} style={{
          '--card-glow': 'rgba(255, 0, 85, 0.15)',
          '--icon-bg-start': 'rgba(255, 0, 85, 0.2)',
          '--icon-bg-end': 'rgba(255, 0, 85, 0.05)',
          '--icon-shadow': 'rgba(255, 0, 85, 0.4)',
          '--icon-glow': '#ff0055'
        }}>
          <div className={styles.statIcon}>
            <FiXCircle style={{color: '#ff0055'}} />
          </div>
          <div className={styles.statInfo}>
            <h3>{offlineServers}</h3>
            <p>Оффлайн</p>
          </div>
        </div>

        <div className={styles.statCard} style={{
          '--card-glow': 'rgba(180, 0, 255, 0.15)',
          '--icon-bg-start': 'rgba(180, 0, 255, 0.2)',
          '--icon-bg-end': 'rgba(138, 101, 255, 0.05)',
          '--icon-shadow': 'rgba(138, 101, 255, 0.4)',
          '--icon-glow': '#b400ff'
        }}>
          <div className={styles.statIcon}>
            <FiClock style={{color: '#b400ff'}} />
          </div>
          <div className={styles.statInfo}>
            <h3>{stats.total_commands_all_time}</h3>
            <p>Всего</p>
          </div>
        </div>

        <div className={styles.statCard} style={{
          '--card-glow': 'rgba(255, 107, 0, 0.15)',
          '--icon-bg-start': 'rgba(255, 107, 0, 0.2)',
          '--icon-bg-end': 'rgba(255, 107, 0, 0.05)',
          '--icon-shadow': 'rgba(255, 107, 0, 0.4)',
          '--icon-glow': '#ff6b00'
        }}>
          <div className={styles.statIcon}>
            <FiTrendingUp style={{color: '#ff6b00'}} />
          </div>
          <div className={styles.statInfo}>
            <h3>{stats.total_commands_today}</h3>
            <p>Сегодня</p>
          </div>
        </div>

        <div className={styles.statCard} style={{
          '--card-glow': 'rgba(0, 200, 255, 0.15)',
          '--icon-bg-start': 'rgba(0, 200, 255, 0.2)',
          '--icon-bg-end': 'rgba(0, 200, 255, 0.05)',
          '--icon-shadow': 'rgba(0, 200, 255, 0.4)',
          '--icon-glow': '#00c8ff'
        }}>
          <div className={styles.statIcon}>
            <FiCheckCircle style={{color: '#00c8ff'}} />
          </div>
          <div className={styles.statInfo}>
            <h3>{stats.successful_commands_today}</h3>
            <p>Успешных</p>
          </div>
        </div>

        <div className={styles.statCard} style={{
          '--card-glow': 'rgba(255, 200, 0, 0.15)',
          '--icon-bg-start': 'rgba(255, 200, 0, 0.2)',
          '--icon-bg-end': 'rgba(255, 200, 0, 0.05)',
          '--icon-shadow': 'rgba(255, 200, 0, 0.4)',
          '--icon-glow': '#ffc800'
        }}>
          <div className={styles.statIcon}>
            <FiClock style={{color: '#ffc800'}} />
          </div>
          <div className={styles.statInfo}>
            <h3>{stats.avg_response_time ? `${stats.avg_response_time.toFixed(0)}ms` : '-'}</h3>
            <p>Ср. время</p>
          </div>
        </div>
      </div>

      {/* Статусы серверов */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2><FiServer /> Статус серверов</h2>
          <div className={styles.sectionControls}>
            <button 
              onClick={toggleViewMode} 
              className={styles.viewToggleBtn}
              title={viewMode === 'full' ? 'Переключить на компактный вид' : 'Переключить на полный вид'}
            >
              {viewMode === 'full' ? <><FiList /> Компактный вид</> : <><FiGrid /> Полный вид</>}
            </button>
            <button 
              onClick={toggleAutoPing} 
              className={`${styles.autoPingBtn} ${autoPingEnabled ? styles.active : ''}`}
              title={autoPingEnabled ? 'Автопроверка включена' : 'Автопроверка выключена'}
            >
              {autoPingEnabled ? <FiPause /> : <FiPlay />}
              {autoPingEnabled ? 'Остановить автопроверку' : 'Запустить автопроверку'}
            </button>
          </div>
        </div>
        <div className={`${styles.serversGrid} ${viewMode === 'compact' ? styles.compactView : ''}`}>
          {serversWithStatus.map(server => {
            const status = server.status;
            const isOnline = status?.is_online || false;
            const isTesting = testingServers.has(server.id);
            
            return (
              <div key={server.id} className={`${styles.serverCard} ${isOnline ? styles.online : styles.offline} ${viewMode === 'compact' ? styles.compact : ''}`}>
                <div className={styles.serverHeader}>
                  <div className={styles.serverName}>
                    {isOnline ? <FiCheckCircle /> : <FiXCircle />}
                    {server.name}
                  </div>
                  <div className={styles.serverHeaderRight}>
                    {viewMode === 'full' && (
                      <button
                        onClick={() => handleTestServer(server.id)}
                        disabled={isTesting}
                        className={styles.testBtn}
                        title="Проверить сервер"
                      >
                        <FiRefreshCw className={isTesting ? styles.spinning : ''} />
                        {isTesting ? 'Тест...' : 'Тест'}
                      </button>
                    )}
                    <div className={`${styles.serverStatus} ${isOnline ? styles.statusOnline : styles.statusOffline}`}>
                      {isOnline ? 'ONLINE' : 'OFFLINE'}
                    </div>
                  </div>
                </div>
                <div className={styles.serverDetails}>
                  <div className={styles.serverDetail}>
                    <span>IP:</span>
                    <span>{server.host}:{server.port}</span>
                  </div>
                  {viewMode === 'full' && server.group_name && (
                    <div className={styles.serverDetail}>
                      <span>Группа:</span>
                      <span>{server.group_name}</span>
                    </div>
                  )}
                  {viewMode === 'full' && status?.last_ping && (
                    <div className={styles.serverDetail}>
                      <span>Последняя проверка:</span>
                      <span>{new Date(status.last_ping).toLocaleTimeString()}</span>
                    </div>
                  )}
                  {viewMode === 'full' && status?.last_error && !isOnline && (
                    <div className={styles.serverError}>
                      <FiAlertCircle /> {status.last_error}
                    </div>
                  )}
                  {viewMode === 'compact' && (
                    <div className={styles.compactInfo}>
                      {server.group_name && <span className={styles.compactGroup}>{server.group_name}</span>}
                      {status?.last_ping && (
                        <span className={styles.compactTime}>{new Date(status.last_ping).toLocaleTimeString()}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Модальное окно настроек */}
      {showSettings && (
        <div 
          className={styles.modal}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              e.preventDefault();
              setShowSettings(false);
            }
          }}
        >
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2><FiSettings /> Настройки дашборда</h2>
              <button onClick={() => setShowSettings(false)} className={styles.closeBtn}>×</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label>Интервал опроса серверов (секунды)</label>
                <input
                  type="number"
                  min="5"
                  max="3600"
                  value={pingInterval}
                  onChange={(e) => {
                    // FIXED: Allow free editing, no validation during typing
                    // User can delete all digits, type any number, etc.
                    const value = e.target.value;
                    
                    if (value === '' || value === null || value === undefined) {
                      // Allow empty field during editing
                      setPingInterval('');
                    } else {
                      const parsed = parseInt(value);
                      if (!isNaN(parsed)) {
                        // Accept any number during typing, validate only on blur
                        setPingInterval(parsed);
                      }
                    }
                  }}
                  onBlur={(e) => {
                    // Final validation when user finishes editing
                    const value = e.target.value;
                    
                    if (value === '' || value === null || value === undefined) {
                      // Empty field -> set to minimum (5)
                      setPingInterval(5);
                      return;
                    }
                    
                    const parsed = parseInt(value);
                    if (isNaN(parsed) || parsed < 5) {
                      setPingInterval(5); // Below minimum -> set to minimum (5)
                    } else if (parsed > 3600) {
                      setPingInterval(3600); // Above maximum -> clamp to max
                    }
                    // If 5-3600, keep as is
                  }}
                  className={styles.input}
                />
                <small>От 5 до 3600 секунд</small>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button onClick={handleSaveSettings} className={styles.saveBtn}>
                Сохранить
              </button>
              <button onClick={() => setShowSettings(false)} className={styles.cancelBtn}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Модальное окно очистки */}
      {showCleanupModal && (
        <div className={styles.modal} onClick={() => setShowCleanupModal(false)}>
          <div className={styles.modalContentLarge} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2><FiTrash2 /> Управление очисткой данных</h2>
              <button onClick={() => setShowCleanupModal(false)} className={styles.closeBtn}>×</button>
            </div>
            <div className={styles.cleanupContainer}>
              <Cleanup />
            </div>
          </div>
        </div>
      )}
      
      {/* ДОБАВЛЕНО: Toast notification component */}
      {toast && (
        <div className={`${styles.toast} ${styles[toast.type]}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
