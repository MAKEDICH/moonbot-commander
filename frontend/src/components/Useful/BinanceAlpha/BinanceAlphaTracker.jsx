/**
 * Binance Alpha Tracker
 * 
 * Отображает актуальные данные о монетах Binance Alpha.
 * Требует запущенный api_server.py на порту 5000.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FiRefreshCw, FiCopy, FiCheck, FiSearch, FiX } from 'react-icons/fi';
import api from '../../../api/api';
import styles from './BinanceAlphaTracker.module.css';
import { formatServerDateCompact, formatServerDateTime } from '../../../utils/dateUtils';

/**
 * Карточка статистики
 */
const StatCard = ({ label, value }) => (
    <div className={styles.statCard}>
        <span className={styles.statLabel}>{label}</span>
        <span className={styles.statValue}>{value}</span>
    </div>
);

/**
 * Карточка монеты
 */
const CoinCard = ({ coin, onCopy }) => (
    <div 
        className={styles.coinCard}
        onClick={() => onCopy(coin.symbol)}
        title="Клик для копирования"
    >
        <div className={styles.coinSymbol}>{coin.symbol}</div>
        <div className={styles.coinName}>{coin.name}</div>
        {coin.chain && <div className={styles.coinChain}>{coin.chain}</div>}
    </div>
);

/**
 * Главный компонент
 */
const BinanceAlphaTracker = () => {
    const [coins, setCoins] = useState([]);
    const [originalCoins, setOriginalCoins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [error, setError] = useState(null);
    const [lastUpdate, setLastUpdate] = useState(null);
    // Монеты отображаются в порядке листинга (как на сайте)
    const [chainFilter, setChainFilter] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [copiedText, setCopiedText] = useState(null);
    const [serverStatus, setServerStatus] = useState('checking');
    const [progress, setProgress] = useState({ percent: 0, stage: '', chain: '' });
    const [totalCount, setTotalCount] = useState(0);

    /**
     * Загрузка монет с сервера
     */
    const fetchCoins = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            
            const params = chainFilter !== 'ALL' ? { chain: chainFilter } : {};
            const response = await api.get('/api/binance-alpha/coins', { params });
            const data = response.data;
            
            if (data.success) {
                setOriginalCoins(data.coins || []);
                setCoins(data.coins || []);
                // При фильтре по сети показываем count (для сети), иначе total_count (все)
                const displayCount = chainFilter === 'ALL' 
                    ? (data.total_count || data.coins?.length || 0)
                    : (data.count || data.coins?.length || 0);
                setTotalCount(displayCount);
                setLastUpdate(data.updated || null);
                setServerStatus('connected');
                
                // Если нет данных и не обновляется - предлагаем обновить
                if (data.coins.length === 0 && !data.is_updating) {
                    setError('Нет данных. Нажмите "Обновить" для загрузки.');
                }
            } else {
                setError('Не удалось загрузить данные');
                setServerStatus('error');
            }
        } catch (err) {
            console.error('Error fetching coins:', err);
            setError('Ошибка загрузки данных');
            setServerStatus('error');
        } finally {
            setLoading(false);
        }
    }, [chainFilter]);

    /**
     * Принудительное обновление
     */
    const forceUpdate = async () => {
        if (updating) return;
        
        try {
            setUpdating(true);
            setError(null);
            const response = await api.post('/api/binance-alpha/update');
            const data = response.data;
            
            if (data.success) {
                if (data.coins && data.coins.length > 0) {
                    // Данные уже получены
                    setOriginalCoins(data.coins);
                    setCoins(data.coins);
                    setLastUpdate(data.updated);
                    setServerStatus('connected');
                    setUpdating(false);
                } else if (data.is_updating) {
                    // Парсинг запущен - будем периодически проверять
                    pollForUpdates();
                }
            } else {
                setError(data.message || 'Ошибка обновления');
                setUpdating(false);
            }
        } catch (err) {
            console.error('Error updating:', err);
            setError('Ошибка обновления данных');
            setUpdating(false);
        }
    };

    /**
     * Периодическая проверка статуса обновления
     */
    const pollForUpdates = useCallback(() => {
        const interval = setInterval(async () => {
            try {
                const response = await api.get('/api/binance-alpha/coins');
                const data = response.data;
                
                // Обновляем прогресс
                if (data.progress) {
                    setProgress(data.progress);
                }
                
                if (!data.is_updating) {
                    // Обновление завершено
                    clearInterval(interval);
                    setUpdating(false);
                    setProgress({ percent: 100, stage: 'Готово', chain: '' });
                    
                    if (data.coins && data.coins.length > 0) {
                        setOriginalCoins(data.coins);
                        setCoins(data.coins);
                        setTotalCount(data.total_count || data.coins.length);
                        setLastUpdate(data.updated || null);
                        setServerStatus('connected');
                        setError(null);
                    } else {
                        setError('Не удалось получить данные');
                    }
                }
            } catch (err) {
                console.error('Error polling:', err);
                clearInterval(interval);
                setUpdating(false);
                setError('Ошибка при проверке статуса');
            }
        }, 1500); // Проверяем каждые 1.5 секунды
        
        // Остановить через 2 минуты
        setTimeout(() => {
            clearInterval(interval);
            setUpdating(false);
        }, 120000);
    }, []);

    /**
     * Копирование в буфер обмена
     */
    const copyToClipboard = async (text, type = null) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedText(type || text);
            setTimeout(() => setCopiedText(null), 2000);
        } catch (err) {
            // Fallback
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            setCopiedText(type || text);
            setTimeout(() => setCopiedText(null), 2000);
        }
    };

    /**
     * Копирование всех монет
     */
    const copyAllCoins = (format) => {
        const symbols = filteredCoins.map(c => c.symbol);
        const text = format === 'comma' ? symbols.join(',') : symbols.join('\n');
        copyToClipboard(text, format);
    };

    /**
     * Загрузка данных при монтировании и смене фильтра
     */
    useEffect(() => {
        fetchCoins();
    }, [fetchCoins]);

    /**
     * Отфильтрованные и отсортированные монеты (по алфавиту)
     */
    const filteredCoins = useMemo(() => {
        let result = [...coins];
        
        // Поиск
        if (searchQuery) {
            const query = searchQuery.toUpperCase();
            result = result.filter(coin => 
                coin.symbol.toUpperCase().includes(query) ||
                coin.name.toUpperCase().includes(query)
            );
        }
        
        // Сортировка по алфавиту
        result.sort((a, b) => a.symbol.localeCompare(b.symbol));
        
        return result;
    }, [coins, searchQuery]);

    /**
     * Очистка поиска
     */
    const clearSearch = () => {
        setSearchQuery('');
    };

    /**
     * Изменение фильтра сети
     */
    const handleChainChange = (chain) => {
        setChainFilter(chain);
        setSearchQuery('');
    };

    return (
        <div className={styles.container}>
            {/* Заголовок */}
            <div className={styles.header}>
                <h2 className={styles.title}>Binance Alpha Tracker</h2>
                <button 
                    className={`${styles.refreshBtn} ${updating ? styles.spinning : ''}`}
                    onClick={forceUpdate}
                    disabled={updating || loading}
                    title="Обновить данные"
                >
                    <FiRefreshCw />
                </button>
            </div>

            {/* Статус */}
            {serverStatus === 'connected' && (
                <div className={styles.statusBanner}>
                    ✅ Подключено к серверу
                </div>
            )}

            {error && (
                <div className={styles.error}>{error}</div>
            )}

            {/* Фильтр по сетям */}
            <div className={styles.filterSection}>
                <span className={styles.filterLabel}>Сеть:</span>
                <div className={styles.filterButtons}>
                    {['ALL', 'BSC', 'SOLANA', 'BASE'].map(chain => (
                        <button
                            key={chain}
                            className={`${styles.filterBtn} ${chainFilter === chain ? styles.active : ''}`}
                            onClick={() => handleChainChange(chain)}
                        >
                            {chain === 'ALL' && '🌐 Все'}
                            {chain === 'BSC' && '🔶 BSC'}
                            {chain === 'SOLANA' && '🟣 Solana'}
                            {chain === 'BASE' && '🔵 BASE'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Поиск */}
            <div className={styles.searchSection}>
                <div className={styles.searchWrapper}>
                    <FiSearch className={styles.searchIcon} />
                    <input
                        type="text"
                        className={styles.searchInput}
                        placeholder="Поиск монеты..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button className={styles.clearBtn} onClick={clearSearch}>
                            <FiX />
                        </button>
                    )}
                </div>
                {searchQuery && (
                    <span className={styles.searchInfo}>
                        Найдено: {filteredCoins.length}
                    </span>
                )}
            </div>

            {/* Статистика */}
            <div className={styles.stats}>
                <StatCard 
                    label={chainFilter === 'ALL' ? 'Всего монет' : `Монет ${chainFilter}`} 
                    value={totalCount || '—'} 
                />
                <StatCard 
                    label="Обновлено" 
                    value={lastUpdate ? formatServerDateCompact(lastUpdate) : '—'} 
                />
            </div>

            {/* Кнопки копирования */}
            <div className={styles.copySection}>
                <button 
                    className={`${styles.copyBtn} ${copiedText === 'comma' ? styles.copied : ''}`}
                    onClick={() => copyAllCoins('comma')}
                    disabled={filteredCoins.length === 0}
                >
                    {copiedText === 'comma' ? <FiCheck /> : <FiCopy />}
                    {copiedText === 'comma' ? 'Скопировано!' : 'Копировать через запятую'}
                </button>
                <button 
                    className={`${styles.copyBtn} ${copiedText === 'column' ? styles.copied : ''}`}
                    onClick={() => copyAllCoins('column')}
                    disabled={filteredCoins.length === 0}
                >
                    {copiedText === 'column' ? <FiCheck /> : <FiCopy />}
                    {copiedText === 'column' ? 'Скопировано!' : 'Копировать в столбик'}
                </button>
            </div>

            {/* Прогресс бар при обновлении */}
            {updating && (
                <div className={styles.progressSection}>
                    <div className={styles.progressHeader}>
                        <span className={styles.progressStage}>
                            {progress.stage || 'Загрузка...'}
                            {progress.chain && ` — ${progress.chain}`}
                        </span>
                        <span className={styles.progressPercent}>{progress.percent || 0}%</span>
                    </div>
                    <div className={styles.progressBar}>
                        <div 
                            className={styles.progressFill} 
                            style={{ width: `${progress.percent || 0}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Список монет */}
            <div className={styles.coinsGrid}>
                {loading ? (
                    <div className={styles.loading}>
                        <span>Загрузка...</span>
                    </div>
                ) : updating ? (
                    <div className={styles.loading}>
                        <span>Парсинг Binance Alpha...</span>
                    </div>
                ) : filteredCoins.length > 0 ? (
                    filteredCoins.map((coin, index) => (
                        <CoinCard 
                            key={`${coin.symbol}-${index}`} 
                            coin={coin} 
                            onCopy={copyToClipboard}
                        />
                    ))
                ) : (
                    <div className={styles.empty}>
                        {searchQuery ? 'Ничего не найдено' : 'Нажмите "Обновить" для загрузки данных'}
                    </div>
                )}
            </div>

            {/* Последнее обновление */}
            {lastUpdate && (
                <div className={styles.lastUpdate}>
                    Последнее обновление: {formatServerDateTime(lastUpdate)}
                </div>
            )}
        </div>
    );
};

export default BinanceAlphaTracker;

