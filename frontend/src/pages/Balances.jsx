import { useState, useEffect } from 'react';
import { FiRefreshCw, FiDollarSign, FiServer, FiActivity } from 'react-icons/fi';
import api from '../api/api';
import styles from './Balances.module.css';

function Balances() {
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(() => {
    const saved = localStorage.getItem('balances_auto_refresh');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [refreshing, setRefreshing] = useState(false);

  // Сохраняем состояние автообновления в localStorage
  useEffect(() => {
    localStorage.setItem('balances_auto_refresh', JSON.stringify(autoRefresh));
  }, [autoRefresh]);

  const fetchBalances = async () => {
    try {
      setError(null);
      const response = await api.get('/api/servers/balances');
      
      if (Array.isArray(response.data)) {
        setBalances(response.data);
      } else {
        console.error('Invalid response format:', response.data);
        setBalances([]);
        setError('Invalid response format from server');
      }
    } catch (err) {
      console.error('Error fetching balances:', err);
      setBalances([]);
      
      if (err.response?.data?.detail) {
        if (typeof err.response.data.detail === 'string') {
          setError(err.response.data.detail);
        } else if (Array.isArray(err.response.data.detail)) {
          const errorMessages = err.response.data.detail.map(e => {
            if (typeof e === 'object' && e.msg) {
              return `${e.loc?.join('.') || 'field'}: ${e.msg}`;
            }
            return String(e);
          }).join(', ');
          setError(errorMessages);
        } else {
          setError('Failed to load balances');
        }
      } else {
        setError(err.message || 'Failed to load balances');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (refreshing) return;
    
    setRefreshing(true);
    setError(null);
    
    try {
      // Отправляем lst на все активные серверы
      const activeServers = balances.filter(b => b.is_active);
      
      if (activeServers.length === 0) {
        setError('No active servers to refresh');
        return;
      }
      
      // Отправляем lst параллельно на все серверы
      const lstPromises = activeServers.map(server => 
        api.post(`/api/servers/${server.server_id}/ping`).catch(err => {
          console.error(`Failed to ping server ${server.server_id}:`, err);
          return null;
        })
      );
      
      await Promise.all(lstPromises);
      
      // Ждем 1 секунду для получения обновленных данных
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Обновляем балансы
      await fetchBalances();
    } catch (err) {
      console.error('Error refreshing servers:', err);
      setError('Failed to refresh servers');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBalances();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchBalances();
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const formatBalance = (value) => {
    if (value === null || value === undefined) return '0.00';
    return parseFloat(value).toFixed(2);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Никогда';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${day}.${month}.${year}, ${hours}:${minutes}:${seconds}`;
  };

  const getStatusClass = (isActive, updatedAt) => {
    if (!isActive) return styles.statusInactive;
    if (!updatedAt) return styles.statusNoData;
    
    const lastUpdate = new Date(updatedAt);
    const now = new Date();
    const diffSeconds = (now - lastUpdate) / 1000;
    
    if (diffSeconds < 60) return styles.statusOnline; // < 1 минуты
    if (diffSeconds < 300) return styles.statusRecent; // < 5 минут
    return styles.statusStale;
  };

  const getStatusText = (isActive, updatedAt) => {
    if (!isActive) return 'Inactive';
    if (!updatedAt) return 'No Data';
    
    const lastUpdate = new Date(updatedAt);
    const now = new Date();
    const diffSeconds = Math.floor((now - lastUpdate) / 1000);
    
    if (diffSeconds < 10) return 'Online';
    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    return `${diffHours}h ago`;
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <FiRefreshCw className={styles.spinner} />
          <p>Загрузка балансов...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h1 className={styles.title}>
            <FiDollarSign className={styles.titleIcon} />
            Балансы серверов
          </h1>
          <p className={styles.subtitle}>
            Актуальные балансы всех MoonBot серверов
          </p>
        </div>
        <div className={styles.controls}>
          <label className={styles.autoRefreshToggle}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            <span>Автообновление (5с)</span>
          </label>
          <button 
            className={styles.refreshButton}
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <FiRefreshCw className={refreshing ? styles.spinning : ''} />
            {refreshing ? 'Обновление...' : 'Обновить'}
          </button>
        </div>
      </div>

      {error && (
        <div className={styles.error}>
          <p>⚠️ {error}</p>
        </div>
      )}

      {balances.length === 0 ? (
        <div className={styles.empty}>
          <FiServer className={styles.emptyIcon} />
          <p>Серверы не найдены</p>
          <small>Добавьте серверы во вкладке "Серверы"</small>
        </div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Сервер</th>
                <th>Бот</th>
                <th>Host:Port</th>
                <th>Доступно</th>
                <th>Всего</th>
                <th>Обновлено</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {balances.map((balance) => (
                <tr 
                  key={balance.server_id}
                  className={!balance.is_active ? styles.inactiveRow : ''}
                >
                  <td className={styles.serverName}>
                    <FiServer className={styles.serverIcon} />
                    <span>{balance.server_name}</span>
                  </td>
                  <td className={styles.botName}>
                    {balance.bot_name || <span className={styles.noData}>—</span>}
                  </td>
                  <td className={styles.hostPort}>
                    <code>{balance.host}:{balance.port}</code>
                  </td>
                  <td className={styles.balance}>
                    <span className={styles.balanceValue}>
                      ${formatBalance(balance.available)}
                    </span>
                  </td>
                  <td className={styles.balance}>
                    <span className={styles.balanceValue}>
                      ${formatBalance(balance.total)}
                    </span>
                  </td>
                  <td className={styles.lastUpdate}>
                    <small>{formatDate(balance.updated_at)}</small>
                  </td>
                  <td>
                    <span className={`${styles.status} ${getStatusClass(balance.is_active, balance.updated_at)}`}>
                      <FiActivity className={styles.statusIcon} />
                      {getStatusText(balance.is_active, balance.updated_at)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className={styles.footer}>
        <div className={styles.legend}>
          <span className={styles.legendItem}>
            <span className={styles.dot} style={{ backgroundColor: '#10b981' }}></span>
            Online
          </span>
          <span className={styles.legendItem}>
            <span className={styles.dot} style={{ backgroundColor: '#f59e0b' }}></span>
            Recent (&lt;5m)
          </span>
          <span className={styles.legendItem}>
            <span className={styles.dot} style={{ backgroundColor: '#6b7280' }}></span>
            Stale (&gt;5m)
          </span>
        </div>
        <div className={styles.totalServers}>
          Всего: {balances.length} ({balances.filter(b => b.is_active).length} активных)
        </div>
      </div>
    </div>
  );
}

export default Balances;
