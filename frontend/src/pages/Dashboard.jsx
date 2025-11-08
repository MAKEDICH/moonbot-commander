import React, { useState, useEffect, useRef } from 'react';
import { dashboardAPI, serverStatusAPI, userSettingsAPI } from '../api/api';
import styles from './Dashboard.module.css';
import { FiServer, FiActivity, FiCheckCircle, FiXCircle, FiClock, FiTrendingUp, FiSettings, FiAlertCircle, FiPlay, FiPause, FiRefreshCw } from 'react-icons/fi';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [serversWithStatus, setServersWithStatus] = useState([]);
  const [commandsDaily, setCommandsDaily] = useState([]);
  const [serverUptime, setServerUptime] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [pingInterval, setPingInterval] = useState(30);
  const [autoPingEnabled, setAutoPingEnabled] = useState(false);
  const [testingServers, setTestingServers] = useState(new Set());
  const intervalRef = useRef(null);

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

    // Автоматический пинг серверов по интервалу
    intervalRef.current = setInterval(() => {
      pingAllServers();
    }, settings.ping_interval * 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [settings, autoPingEnabled, serversWithStatus]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [statsRes, serversRes, dailyRes, uptimeRes] = await Promise.all([
        dashboardAPI.getStats(),
        serverStatusAPI.getAllWithStatus(),
        dashboardAPI.getCommandsDaily(7),
        dashboardAPI.getServerUptime()
      ]);

      setStats(statsRes.data);
      setServersWithStatus(serversRes.data);
      setCommandsDaily(dailyRes.data);
      setServerUptime(uptimeRes.data);
    } catch (error) {
      console.error('Ошибка загрузки дашборда:', error);
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
    
    // Звуковое уведомление
    if (settings?.notification_sound) {
      const audio = new Audio('/notification.mp3');
      audio.play().catch(() => {});
    }
  };

  const handleSaveSettings = async () => {
    try {
      await userSettingsAPI.update({ ping_interval: pingInterval });
      await loadSettings();
      setShowSettings(false);
      alert('Настройки сохранены!');
    } catch (error) {
      console.error('Ошибка сохранения настроек:', error);
      alert('Ошибка сохранения настроек');
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
    } catch (error) {
      console.error('Ошибка теста сервера:', error);
      alert('Ошибка при проверке сервера');
    } finally {
      setTestingServers(prev => {
        const newSet = new Set(prev);
        newSet.delete(serverId);
        return newSet;
      });
    }
  };

  const toggleAutoPing = () => {
    setAutoPingEnabled(prev => !prev);
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
            <img src={require('../assets/moonbot-icon.png')} alt="Moonbot" />
          </div>
          <div className={styles.moonbotText}>
            <h3>Powered by <span className={styles.moonbotHighlight}>Moonbot</span></h3>
            <p>
              Этот проект создан благодаря мощному торговому терминалу{' '}
              <strong>Moonbot</strong> — лучшему решению для криптотрейдинга
            </p>
          </div>
          <a 
            href="https://moonbot.pro/" 
            target="_blank" 
            rel="noopener noreferrer"
            className={styles.moonbotLink}
          >
            Посетить официальный сайт →
          </a>
        </div>
      </div>

      <div className={styles.header}>
        <h1><FiActivity /> Дашборд</h1>
        <button onClick={() => setShowSettings(true)} className={styles.settingsBtn}>
          <FiSettings /> Настройки
        </button>
      </div>

      {/* Статистические карточки */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{background: 'rgba(0, 245, 255, 0.1)'}}>
            <FiServer style={{color: 'var(--accent-primary)'}} />
          </div>
          <div className={styles.statInfo}>
            <h3>{stats.total_servers}</h3>
            <p>Всего серверов</p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{background: 'rgba(0, 255, 136, 0.1)'}}>
            <FiCheckCircle style={{color: '#00ff88'}} />
          </div>
          <div className={styles.statInfo}>
            <h3>{onlineServers}</h3>
            <p>Онлайн</p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{background: 'rgba(255, 0, 85, 0.1)'}}>
            <FiXCircle style={{color: '#ff0055'}} />
          </div>
          <div className={styles.statInfo}>
            <h3>{offlineServers}</h3>
            <p>Оффлайн</p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{background: 'rgba(138, 101, 255, 0.1)'}}>
            <FiClock style={{color: '#8a65ff'}} />
          </div>
          <div className={styles.statInfo}>
            <h3>{stats.total_commands_all_time}</h3>
            <p>Всего команд</p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{background: 'rgba(255, 107, 0, 0.1)'}}>
            <FiTrendingUp style={{color: '#ff6b00'}} />
          </div>
          <div className={styles.statInfo}>
            <h3>{stats.total_commands_today}</h3>
            <p>Команд сегодня</p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{background: 'rgba(0, 200, 255, 0.1)'}}>
            <FiCheckCircle style={{color: '#00c8ff'}} />
          </div>
          <div className={styles.statInfo}>
            <h3>{stats.successful_commands_today}</h3>
            <p>Успешных</p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{background: 'rgba(255, 200, 0, 0.1)'}}>
            <FiClock style={{color: '#ffc800'}} />
          </div>
          <div className={styles.statInfo}>
            <h3>{stats.avg_response_time ? `${stats.avg_response_time.toFixed(0)}ms` : 'N/A'}</h3>
            <p>Среднее время</p>
          </div>
        </div>
      </div>

      {/* Статусы серверов */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2><FiServer /> Статус серверов</h2>
          <div className={styles.sectionControls}>
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
        <div className={styles.serversGrid}>
          {serversWithStatus.map(server => {
            const status = server.status;
            const isOnline = status?.is_online || false;
            const isTesting = testingServers.has(server.id);
            
            return (
              <div key={server.id} className={`${styles.serverCard} ${isOnline ? styles.online : styles.offline}`}>
                <div className={styles.serverHeader}>
                  <div className={styles.serverName}>
                    {isOnline ? <FiCheckCircle /> : <FiXCircle />}
                    {server.name}
                  </div>
                  <div className={styles.serverHeaderRight}>
                    <button
                      onClick={() => handleTestServer(server.id)}
                      disabled={isTesting}
                      className={styles.testBtn}
                      title="Проверить сервер"
                    >
                      <FiRefreshCw className={isTesting ? styles.spinning : ''} />
                      {isTesting ? 'Тест...' : 'Тест'}
                    </button>
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
                  {server.group_name && (
                    <div className={styles.serverDetail}>
                      <span>Группа:</span>
                      <span>{server.group_name}</span>
                    </div>
                  )}
                  {status?.response_time && (
                    <div className={styles.serverDetail}>
                      <span>Отклик:</span>
                      <span>{status.response_time.toFixed(0)}ms</span>
                    </div>
                  )}
                  {status?.uptime_percentage !== undefined && (
                    <div className={styles.serverDetail}>
                      <span>Uptime:</span>
                      <span>{status.uptime_percentage.toFixed(1)}%</span>
                    </div>
                  )}
                  {status?.last_ping && (
                    <div className={styles.serverDetail}>
                      <span>Последняя проверка:</span>
                      <span>{new Date(status.last_ping).toLocaleTimeString()}</span>
                    </div>
                  )}
                  {status?.last_error && !isOnline && (
                    <div className={styles.serverError}>
                      <FiAlertCircle /> {status.last_error}
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
                  onChange={(e) => setPingInterval(parseInt(e.target.value))}
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
    </div>
  );
};

export default Dashboard;
