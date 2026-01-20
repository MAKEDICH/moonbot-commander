import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FiAlertTriangle, 
  FiArrowLeft, 
  FiRefreshCw, 
  FiTrash2, 
  FiFilter,
  FiServer,
  FiClock,
  FiHash,
  FiX
} from 'react-icons/fi';
import { apiErrorsAPI } from '../api/api';
import { useConfirm } from '../context/ConfirmContext';
import styles from './APIErrors.module.css';
import PageHeader from '../components/PageHeader';

function APIErrors() {
  const navigate = useNavigate();
  const { confirmDelete } = useConfirm();
  const [errors, setErrors] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Фильтры
  const [selectedBot, setSelectedBot] = useState('all');
  const [selectedCode, setSelectedCode] = useState('all');
  const [selectedSymbol, setSelectedSymbol] = useState('all');
  const [hoursFilter, setHoursFilter] = useState(24);
  
  // Загрузка данных
  const loadData = async () => {
    try {
      const [errorsRes, statsRes] = await Promise.all([
        apiErrorsAPI.getAll({ hours: hoursFilter, limit: 500 }),
        apiErrorsAPI.getStats(hoursFilter)
      ]);
      setErrors(errorsRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Error loading API errors:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Отметить ошибки как просмотренные при открытии страницы
  const markErrorsAsViewed = async () => {
    try {
      await apiErrorsAPI.markViewed();
    } catch (error) {
      console.error('Error marking errors as viewed:', error);
    }
  };

  useEffect(() => {
    loadData();
    // Отмечаем ошибки как просмотренные при открытии страницы
    markErrorsAsViewed();
  }, [hoursFilter]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleClearAll = async () => {
    const confirmed = await confirmDelete('Очистить все ошибки API?', {
      title: 'Очистка ошибок',
      confirmText: 'Очистить'
    });
    if (!confirmed) return;
    
    try {
      await apiErrorsAPI.clear();
      loadData();
    } catch (error) {
      console.error('Error clearing errors:', error);
    }
  };

  // Получаем уникальные значения для фильтров
  const uniqueBots = useMemo(() => {
    const bots = new Set(errors.map(e => e.bot_name).filter(Boolean));
    return Array.from(bots).sort();
  }, [errors]);

  const uniqueCodes = useMemo(() => {
    const codes = new Set(errors.map(e => e.error_code).filter(Boolean));
    return Array.from(codes).sort((a, b) => a - b);
  }, [errors]);

  const uniqueSymbols = useMemo(() => {
    const symbols = new Set(errors.map(e => e.symbol).filter(Boolean));
    return Array.from(symbols).sort();
  }, [errors]);

  // Фильтрация ошибок
  const filteredErrors = useMemo(() => {
    return errors.filter(error => {
      if (selectedBot !== 'all' && error.bot_name !== selectedBot) return false;
      if (selectedCode !== 'all' && error.error_code !== parseInt(selectedCode)) return false;
      if (selectedSymbol !== 'all' && error.symbol !== selectedSymbol) return false;
      return true;
    });
  }, [errors, selectedBot, selectedCode, selectedSymbol]);

  // Группировка по ботам для статистики
  const errorsByBot = useMemo(() => {
    const grouped = {};
    filteredErrors.forEach(error => {
      const bot = error.bot_name || 'Unknown';
      if (!grouped[bot]) {
        grouped[bot] = { count: 0, codes: new Set(), symbols: new Set() };
      }
      grouped[bot].count++;
      if (error.error_code) grouped[bot].codes.add(error.error_code);
      if (error.symbol) grouped[bot].symbols.add(error.symbol);
    });
    return grouped;
  }, [filteredErrors]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getCodeColor = (code) => {
    if (!code) return styles.codeUnknown;
    if (code >= 500) return styles.code5xx;
    if (code >= 400) return styles.code4xx;
    return styles.codeOther;
  };

  const resetFilters = () => {
    setSelectedBot('all');
    setSelectedCode('all');
    setSelectedSymbol('all');
  };

  const hasActiveFilters = selectedBot !== 'all' || selectedCode !== 'all' || selectedSymbol !== 'all';

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <FiRefreshCw className={styles.spinner} />
          <p>Загрузка ошибок API...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <PageHeader 
        icon={<FiAlertTriangle />} 
        title="Ошибки API MoonBot" 
        gradient="red"
        badge={`${stats?.total_errors || 0} за ${hoursFilter}ч`}
      >
        <button className={styles.backBtn} onClick={() => navigate('/servers')}>
          <FiArrowLeft />
        </button>
        <select 
          className={styles.hoursSelect}
          value={hoursFilter}
          onChange={(e) => setHoursFilter(parseInt(e.target.value))}
        >
          <option value={1}>1 час</option>
          <option value={6}>6 часов</option>
          <option value={12}>12 часов</option>
          <option value={24}>24 часа</option>
          <option value={48}>48 часов</option>
          <option value={168}>7 дней</option>
        </select>
        <button 
          className={styles.refreshBtn} 
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <FiRefreshCw className={refreshing ? styles.spinning : ''} />
        </button>
        <button 
          className={styles.clearBtn} 
          onClick={handleClearAll}
          disabled={errors.length === 0}
        >
          <FiTrash2 />
          Очистить
        </button>
      </PageHeader>

      {/* Stats Cards */}
      {stats && (
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statIcon}><FiAlertTriangle /></div>
            <div className={styles.statInfo}>
              <span className={styles.statValue}>{stats.total_errors}</span>
              <span className={styles.statLabel}>Всего ошибок</span>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon}><FiServer /></div>
            <div className={styles.statInfo}>
              <span className={styles.statValue}>{stats.by_server?.length || 0}</span>
              <span className={styles.statLabel}>Серверов с ошибками</span>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon}><FiHash /></div>
            <div className={styles.statInfo}>
              <span className={styles.statValue}>{stats.by_code?.length || 0}</span>
              <span className={styles.statLabel}>Типов ошибок</span>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon}><FiClock /></div>
            <div className={styles.statInfo}>
              <span className={styles.statValue}>{hoursFilter}ч</span>
              <span className={styles.statLabel}>Период</span>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className={styles.filtersSection}>
        <div className={styles.filtersHeader}>
          <FiFilter />
          <span>Фильтры</span>
          {hasActiveFilters && (
            <button className={styles.resetFiltersBtn} onClick={resetFilters}>
              <FiX /> Сбросить
            </button>
          )}
        </div>
        <div className={styles.filtersGrid}>
          <div className={styles.filterGroup}>
            <label>Бот</label>
            <select 
              value={selectedBot} 
              onChange={(e) => setSelectedBot(e.target.value)}
            >
              <option value="all">Все боты ({uniqueBots.length})</option>
              {uniqueBots.map(bot => (
                <option key={bot} value={bot}>{bot}</option>
              ))}
            </select>
          </div>
          <div className={styles.filterGroup}>
            <label>Код ошибки</label>
            <select 
              value={selectedCode} 
              onChange={(e) => setSelectedCode(e.target.value)}
            >
              <option value="all">Все коды ({uniqueCodes.length})</option>
              {uniqueCodes.map(code => (
                <option key={code} value={code}>[{code}]</option>
              ))}
            </select>
          </div>
          <div className={styles.filterGroup}>
            <label>Символ</label>
            <select 
              value={selectedSymbol} 
              onChange={(e) => setSelectedSymbol(e.target.value)}
            >
              <option value="all">Все символы ({uniqueSymbols.length})</option>
              {uniqueSymbols.map(symbol => (
                <option key={symbol} value={symbol}>{symbol}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Bot Summary */}
      {Object.keys(errorsByBot).length > 0 && (
        <div className={styles.botSummary}>
          <h3>По ботам</h3>
          <div className={styles.botCards}>
            {Object.entries(errorsByBot).map(([bot, data]) => (
              <div 
                key={bot} 
                className={`${styles.botCard} ${selectedBot === bot ? styles.botCardActive : ''}`}
                onClick={() => setSelectedBot(selectedBot === bot ? 'all' : bot)}
              >
                <div className={styles.botName}>{bot}</div>
                <div className={styles.botStats}>
                  <span className={styles.botCount}>{data.count} ошибок</span>
                  <span className={styles.botCodes}>
                    {Array.from(data.codes).map(c => `[${c}]`).join(' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Errors Table */}
      {filteredErrors.length === 0 ? (
        <div className={styles.empty}>
          <FiAlertTriangle className={styles.emptyIcon} />
          <p>Ошибок не найдено</p>
          <small>
            {hasActiveFilters 
              ? 'Попробуйте изменить фильтры' 
              : 'MoonBot работает без ошибок API'}
          </small>
        </div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Время</th>
                <th>Бот</th>
                <th>Код</th>
                <th>Символ</th>
                <th>Сообщение</th>
              </tr>
            </thead>
            <tbody>
              {filteredErrors.map((error) => (
                <tr key={error.id}>
                  <td className={styles.timeCell}>
                    <div className={styles.timeReceived}>{formatDate(error.received_at)}</div>
                    {error.error_time && (
                      <div className={styles.timeError}>{formatDate(error.error_time)}</div>
                    )}
                  </td>
                  <td className={styles.botCell}>
                    <span className={styles.botBadge}>{error.bot_name || '—'}</span>
                  </td>
                  <td className={styles.codeCell}>
                    <span className={`${styles.codeBadge} ${getCodeColor(error.error_code)}`}>
                      {error.error_code ? `[${error.error_code}]` : '—'}
                    </span>
                  </td>
                  <td className={styles.symbolCell}>
                    {error.symbol || '—'}
                  </td>
                  <td className={styles.messageCell}>
                    <div className={styles.errorText}>{error.error_text}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      <div className={styles.footer}>
        <span>Показано: {filteredErrors.length} из {errors.length} ошибок</span>
      </div>
    </div>
  );
}

export default APIErrors;



