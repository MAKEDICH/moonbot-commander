import { useState, useEffect } from 'react';
import { FiRefreshCw, FiDollarSign, FiServer, FiActivity, FiChevronUp, FiChevronDown, FiEye, FiEyeOff } from 'react-icons/fi';
import api from '../api/api';
import styles from './Balances.module.css';
import PageHeader from '../components/PageHeader';
import CurrencySelector from '../components/CurrencySelector';
import { formatServerDateTime, parseServerTimeToMs } from '../utils/dateUtils';

function Balances() {
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(() => {
    const saved = localStorage.getItem('balances_auto_refresh');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState('server_name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [currencyFilter, setCurrencyFilter] = useState('all');
  // Используем тот же ключ что и на странице серверов
  const [hideAddresses, setHideAddresses] = useState(() => {
    const saved = localStorage.getItem('serversHideAddresses');
    return saved === 'true';
  });

  // Слушаем изменения в localStorage (если изменили на странице серверов)
  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem('serversHideAddresses');
      setHideAddresses(saved === 'true');
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const toggleHideAddresses = () => {
    const newValue = !hideAddresses;
    setHideAddresses(newValue);
    localStorage.setItem('serversHideAddresses', newValue.toString());
  };

  /**
   * Маскирует IP адрес
   */
  const maskAddress = (host, port) => {
    if (!hideAddresses) return `${host}:${port}`;
    
    const ipMatch = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (ipMatch) {
      return `${ipMatch[1]}.***.***.**:****`;
    }
    
    if (host.includes('.')) {
      const parts = host.split('.');
      if (parts.length >= 2) {
        return `${parts[0].substring(0, 2)}***.***.***:****`;
      }
    }
    
    return `***:****`;
  };

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
      // Отправляем lst на все активные серверы с валидным server_id
      const activeServers = balances.filter(b => b.is_active && b.server_id != null);
      
      if (activeServers.length === 0) {
        setError('No active servers to refresh');
        return;
      }
      
      // Отправляем lst параллельно на все серверы
      const lstPromises = activeServers.map(server => 
        api.post(`/api/servers/${Number(server.server_id)}/ping`).catch(err => {
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
    // Форматируем число с разделителями тысяч
    const num = parseFloat(value);
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Функция для обработки клика по заголовку для сортировки
  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  // Функция сортировки данных
  const sortedBalances = [...balances].sort((a, b) => {
    let aValue = a[sortBy];
    let bValue = b[sortBy];

    // Преобразуем значения для правильной сортировки
    if (sortBy === 'available' || sortBy === 'total') {
      aValue = parseFloat(aValue) || 0;
      bValue = parseFloat(bValue) || 0;
    } else if (sortBy === 'server_name' || sortBy === 'bot_name' || sortBy === 'host') {
      aValue = (aValue || '').toString().toLowerCase();
      bValue = (bValue || '').toString().toLowerCase();
    } else if (sortBy === 'updated_at') {
      aValue = parseServerTimeToMs(aValue) || 0;
      bValue = parseServerTimeToMs(bValue) || 0;
    }

    if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  // Фильтрация по валюте
  const filteredBalances = currencyFilter === 'all' 
    ? sortedBalances 
    : sortedBalances.filter(balance => (balance.default_currency || 'USDT') === currencyFilter);

  // Получаем уникальные валюты для фильтра
  const uniqueCurrencies = [...new Set(balances.map(b => b.default_currency || 'USDT'))].sort();

  const formatDate = (dateString) => {
    if (!dateString) return 'Никогда';
    return formatServerDateTime(dateString);
  };

  const getStatusClass = (isActive, isOnline, lastPing) => {
    if (!isActive) return styles.statusInactive;
    if (isOnline) return styles.statusOnline;
    if (!lastPing) return styles.statusNoData;
    
    // Парсим время сервера и сравниваем с текущим UTC временем
    const lastUpdateMs = parseServerTimeToMs(lastPing);
    const nowMs = Date.now();
    const diffSeconds = (nowMs - lastUpdateMs) / 1000;
    
    if (diffSeconds < 300) return styles.statusRecent; // < 5 минут
    return styles.statusStale;
  };

  const getStatusText = (isActive, isOnline, lastPing) => {
    if (!isActive) return 'Inactive';
    if (isOnline) return 'Online';
    if (!lastPing) return 'No Data';
    
    // Парсим время сервера и сравниваем с текущим UTC временем
    const lastUpdateMs = parseServerTimeToMs(lastPing);
    const nowMs = Date.now();
    const diffSeconds = Math.floor((nowMs - lastUpdateMs) / 1000);
    
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
      <PageHeader 
        icon={<FiDollarSign />} 
        title="Балансы серверов" 
        gradient="green"
      >
        <button 
          onClick={toggleHideAddresses}
          className={`${styles.hideAddressBtn} ${hideAddresses ? styles.hideAddressActive : ''}`}
          title={hideAddresses ? 'Показать IP и порты' : 'Скрыть IP и порты'}
        >
          {hideAddresses ? <FiEyeOff /> : <FiEye />}
        </button>
        {uniqueCurrencies.length > 1 && (
          <CurrencySelector
            currencies={uniqueCurrencies}
            value={currencyFilter}
            onChange={(e) => setCurrencyFilter(e.target.value)}
          />
        )}
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
      </PageHeader>

      {error && (
        <div className={styles.error}>
          <p>⚠️ {error}</p>
        </div>
      )}

      {filteredBalances.length === 0 ? (
        <div className={styles.empty}>
          <FiServer className={styles.emptyIcon} />
          <p>Серверы не найдены</p>
          <small>
            {balances.length > 0 
              ? `Нет серверов с валютой ${currencyFilter}` 
              : 'Добавьте серверы во вкладке "Серверы"'
            }
          </small>
        </div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th 
                  className={styles.sortable}
                  onClick={() => handleSort('server_name')}
                >
                  Сервер
                  {sortBy === 'server_name' && (
                    sortOrder === 'asc' ? <FiChevronUp className={styles.sortIcon} /> : <FiChevronDown className={styles.sortIcon} />
                  )}
                </th>
                <th 
                  className={styles.sortable}
                  onClick={() => handleSort('bot_name')}
                >
                  Бот
                  {sortBy === 'bot_name' && (
                    sortOrder === 'asc' ? <FiChevronUp className={styles.sortIcon} /> : <FiChevronDown className={styles.sortIcon} />
                  )}
                </th>
                <th>Host:Port</th>
                <th 
                  className={styles.sortable}
                  onClick={() => handleSort('available')}
                >
                  Доступно
                  {sortBy === 'available' && (
                    sortOrder === 'asc' ? <FiChevronUp className={styles.sortIcon} /> : <FiChevronDown className={styles.sortIcon} />
                  )}
                </th>
                <th 
                  className={styles.sortable}
                  onClick={() => handleSort('total')}
                >
                  Всего
                  {sortBy === 'total' && (
                    sortOrder === 'asc' ? <FiChevronUp className={styles.sortIcon} /> : <FiChevronDown className={styles.sortIcon} />
                  )}
                </th>
                <th 
                  className={styles.sortable}
                  onClick={() => handleSort('updated_at')}
                >
                  Обновлено
                  {sortBy === 'updated_at' && (
                    sortOrder === 'asc' ? <FiChevronUp className={styles.sortIcon} /> : <FiChevronDown className={styles.sortIcon} />
                  )}
                </th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {filteredBalances.map((balance) => (
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
                  <td className={`${styles.hostPort} ${hideAddresses ? styles.addressHidden : ''}`}>
                    <code>{maskAddress(balance.host, balance.port)}</code>
                  </td>
                  <td className={styles.balance}>
                    <div className={styles.balanceWrapper}>
                      <span className={styles.balanceAmount}>{formatBalance(balance.available)}</span>
                      <span className={styles.balanceCurrency}>{balance.default_currency || 'USDT'}</span>
                    </div>
                  </td>
                  <td className={styles.balance}>
                    <div className={styles.balanceWrapper}>
                      <span className={styles.balanceAmount}>{formatBalance(balance.total)}</span>
                      <span className={styles.balanceCurrency}>{balance.default_currency || 'USDT'}</span>
                    </div>
                  </td>
                  <td className={styles.lastUpdate}>
                    <small>{formatDate(balance.updated_at)}</small>
                  </td>
                  <td>
                    <span className={`${styles.status} ${getStatusClass(balance.is_active, balance.is_online, balance.last_ping)}`}>
                      <FiActivity className={styles.statusIcon} />
                      {getStatusText(balance.is_active, balance.is_online, balance.last_ping)}
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
          {currencyFilter !== 'all' && filteredBalances.length !== balances.length && (
            <>
              Показано: {filteredBalances.length} из {balances.length} серверов • 
            </>
          )}
          Всего: {balances.length} ({balances.filter(b => b.is_active).length} активных)
        </div>
      </div>
    </div>
  );
}

export default Balances;
