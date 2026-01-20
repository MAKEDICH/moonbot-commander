/**
 * TickCharts - Страница тиковых графиков
 * 
 * Графики приходят автоматически при активном UDP Listener.
 * Подписка на графики происходит автоматически при запуске listener.
 */

import React, { useState, useEffect } from 'react';
import { 
  FiRefreshCw, 
  FiMaximize2, 
  FiMinimize2,
  FiTrash2,
  FiDownload
} from 'react-icons/fi';
import { chartsAPI, serversAPI } from '../api/api';
import TradingChart from '../components/TradingChart';
import { useConfirm } from '../context/ConfirmContext';
import styles from './TickCharts.module.css';

/**
 * Страница тиковых графиков
 */
const TickCharts = () => {
  const { confirmDelete } = useConfirm();
  const [servers, setServers] = useState([]);
  const [selectedServer, setSelectedServer] = useState(null);
  const [charts, setCharts] = useState([]);
  const [selectedChart, setSelectedChart] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingChart, setLoadingChart] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false); // Взаимодействие с графиком (ЛКМ/ПКМ зажаты)
  const [listenerStatus, setListenerStatus] = useState({});

  // Загрузка статуса listener
  const loadListenerStatus = async (serverId) => {
    try {
      const response = await fetch(`/api/servers/${serverId}/listener/status`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setListenerStatus(prev => ({ ...prev, [serverId]: data }));
      }
    } catch (error) {
      console.error('Error loading listener status:', error);
    }
  };

  // Загрузка серверов
  useEffect(() => {
    const loadServers = async () => {
      try {
        const response = await serversAPI.getAll();
        setServers(response.data);
        // По умолчанию выбираем "Все"
        setSelectedServer('all');
      } catch (error) {
        console.error('Error loading servers:', error);
      } finally {
        setLoading(false);
      }
    };
    loadServers();
  }, []);

  // Загрузка графиков и статуса listener при выборе сервера
  useEffect(() => {
    if (!selectedServer) return;
    
    const loadCharts = async () => {
      try {
        console.log('[TickCharts] Loading charts for server:', selectedServer);
        let newCharts = [];
        
        if (selectedServer === 'all') {
          // Загружаем графики со всех серверов
          const response = await chartsAPI.getAllCharts(100);
          // API возвращает { total, charts }, извлекаем charts
          newCharts = response.data?.charts || [];
        } else {
          const response = await chartsAPI.getAll(selectedServer, 100);
          newCharts = response.data || [];
        }
        
        console.log('[TickCharts] Charts loaded:', newCharts.length);
        setCharts(newCharts);
        
        // Сохраняем выбранный график при обновлении списка
        setSelectedChart(prevSelected => {
          if (!prevSelected) {
            // Если ничего не выбрано - выбираем первый
            return newCharts.length > 0 ? newCharts[0] : null;
          }
          // Ищем ранее выбранный график по ID в новом списке
          const stillExists = newCharts.find(c => c.id === prevSelected.id);
          if (stillExists) {
            // График всё ещё существует - обновляем его данные
            return stillExists;
          }
          // График был удалён - выбираем первый из списка
          return newCharts.length > 0 ? newCharts[0] : null;
        });
      } catch (error) {
        console.error('[TickCharts] Error loading charts:', error);
        setCharts([]);
      }
    };
    
    // Загружаем только если не в fullscreen режиме и не взаимодействуем с графиком
    if (!isFullscreen && !isInteracting) {
      loadCharts();
      // Listener status только для конкретного сервера
      if (selectedServer !== 'all') {
        loadListenerStatus(selectedServer);
      }
    }
    
    // Автообновление каждые 10 секунд (только если не fullscreen и не взаимодействуем)
    let interval = null;
    if (!isFullscreen && !isInteracting) {
      interval = setInterval(loadCharts, 10000);
    }
    
    // Слушаем WebSocket для новых графиков (только если не fullscreen и не взаимодействуем)
    const handleWsMessage = (event) => {
      if (isFullscreen || isInteracting) return; // Игнорируем обновления
      
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'chart_update' && data.data?.server_id === selectedServer) {
          console.log('[TickCharts] New chart received via WebSocket:', data.data);
          loadCharts();
        }
      } catch (e) {
        // Игнорируем ошибки парсинга
      }
    };
    
    // Подключаемся к существующему WebSocket если он есть
    if (!isFullscreen && !isInteracting && window.ws && window.ws.readyState === WebSocket.OPEN) {
      window.ws.addEventListener('message', handleWsMessage);
    }
    
    return () => {
      if (interval) clearInterval(interval);
      if (window.ws) {
        window.ws.removeEventListener('message', handleWsMessage);
      }
    };
  }, [selectedServer, isFullscreen, isInteracting]);

  // Загрузка данных выбранного графика
  useEffect(() => {
    if (!selectedChart || !selectedServer) return;
    
    const loadChartData = async () => {
      setLoadingChart(true);
      try {
        // Если выбрано "Все", используем server_id из самого графика
        const serverId = selectedServer === 'all' ? selectedChart.server_id : selectedServer;
        const response = await chartsAPI.getChart(serverId, selectedChart.order_db_id);
        setChartData(response.data);
      } catch (error) {
        console.error('Error loading chart data:', error);
        setChartData(null);
      } finally {
        setLoadingChart(false);
      }
    };
    loadChartData();
  }, [selectedChart, selectedServer]);

  // Очистка графиков
  const handleClearCharts = async () => {
    if (!selectedServer) return;
    
    const message = selectedServer === 'all' 
      ? 'Удалить все графики со всех серверов?' 
      : 'Удалить все графики этого сервера?';
    const confirmed = await confirmDelete(message);
    if (!confirmed) return;
    
    try {
      if (selectedServer === 'all') {
        await chartsAPI.clearAll();
      } else {
        await chartsAPI.clear(selectedServer);
      }
      setCharts([]);
      setSelectedChart(null);
      setChartData(null);
    } catch (error) {
      console.error('Error clearing charts:', error);
    }
  };

  const handleRefresh = async () => {
    if (!selectedServer) return;
    setLoading(true);
    try {
      const response = await chartsAPI.getAll(selectedServer, 100);
      const newCharts = response.data || [];
      setCharts(newCharts);
      
      // Сохраняем выбранный график при ручном обновлении
      setSelectedChart(prevSelected => {
        if (!prevSelected) {
          return newCharts.length > 0 ? newCharts[0] : null;
        }
        const stillExists = newCharts.find(c => c.id === prevSelected.id);
        return stillExists || (newCharts.length > 0 ? newCharts[0] : null);
      });
      
      loadListenerStatus(selectedServer);
    } catch (error) {
      console.error('Error refreshing charts:', error);
    } finally {
      setLoading(false);
    }
  };

  // Экспорт графика в JSON
  const handleExportChart = () => {
    if (!chartData) return;
    
    const blob = new Blob([JSON.stringify(chartData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chart_${selectedChart?.market_name || 'unknown'}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Импортируем утилиту вверху файла - используется ниже
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    // Парсим ISO строку напрямую, без конвертации в часовой пояс браузера
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!match) return dateStr;
    const [, , month, day, hours, minutes] = match;
    return `${day}.${month}, ${hours}:${minutes}`;
  };

  // Преобразование данных для TradingChart
  const tradingChartData = chartData ? {
    historical_prices: chartData.data?.history_prices || chartData.historical_prices || [],
    orders: chartData.data?.orders || chartData.orders || [],
    trades: chartData.data?.trades || chartData.trades || [],
    closest_prices: chartData.data?.closest_prices || chartData.closest_prices || [],
    stats: {
      // Берём deltas из данных графика
      ...(chartData.data?.deltas || chartData.stats || {}),
      // Но session_profit ВСЕГДА берём из API (profit_btc из ордера)
      session_profit: chartData.session_profit ?? 0,
      // Fallback для остальных полей
      last_1m_delta: chartData.data?.deltas?.last_1m_delta ?? 0,
      last_5m_delta: chartData.data?.deltas?.last_5m_delta ?? 0,
      last_1h_delta: chartData.data?.deltas?.last_1h_delta ?? 0,
      last_24h_delta: chartData.data?.deltas?.last_24h_delta ?? 0,
      pump_delta_1h: chartData.data?.deltas?.pump_delta_1h ?? 0,
      dump_delta_1h: chartData.data?.deltas?.dump_delta_1h ?? 0,
      hvol: chartData.data?.deltas?.hvol ?? 0,
      hvol_fast: chartData.data?.deltas?.hvol_fast ?? 0,
      is_moonshot: chartData.data?.deltas?.is_moonshot ?? false,
    },
    market_name: chartData.market_name || chartData.data?.market_name || 'Unknown',
    market_currency: chartData.market_currency || chartData.data?.market_currency || 'USDT',
    strategy_name: chartData.strategy_name || chartData.data?.strategy_name || null,
    start_time: chartData.start_time || chartData.data?.start_time || null,
    end_time: chartData.end_time || chartData.data?.end_time || null,
  } : null;

  if (loading) {
    return (
      <div className={styles.loading}>
        <FiRefreshCw className={styles.spinner} />
        <p>Загрузка...</p>
      </div>
    );
  }

  const isListenerActive = listenerStatus[selectedServer]?.is_running;

  return (
    <div className={styles.container}>
      {/* Sidebar */}
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h3>📈 Графики</h3>
          <div className={styles.headerActions}>
            <button onClick={handleRefresh} className={styles.iconBtn} title="Обновить">
              <FiRefreshCw />
            </button>
            <button onClick={handleClearCharts} className={styles.iconBtn} title="Очистить">
              <FiTrash2 />
            </button>
          </div>
        </div>

        {/* Выбор сервера */}
        <div className={styles.serverSelect}>
          <label>Сервер</label>
          <select 
            value={selectedServer || ''} 
            onChange={(e) => {
              const value = e.target.value;
              setSelectedServer(value === 'all' ? 'all' : parseInt(value));
              setSelectedChart(null);
              setChartData(null);
            }}
          >
            <option value="all">Все</option>
            {servers.map(server => (
              <option key={server.id} value={server.id}>{server.name}</option>
            ))}
          </select>
          {selectedServer && selectedServer !== 'all' && (
            <div className={styles.listenerInfo}>
              {isListenerActive ? (
                <span className={styles.listenerOnline}>● Listener активен (графики приходят автоматически)</span>
              ) : (
                <span className={styles.listenerOffline}>○ Listener не запущен</span>
              )}
            </div>
          )}
        </div>

        {/* Список графиков */}
        <div className={styles.chartsList}>
          {charts.length === 0 ? (
            <div className={styles.noCharts}>
              <p>Нет графиков</p>
              <small>
                {isListenerActive ? (
                  <>
                    ✅ Listener активен<br/>
                    ⏳ Ожидание новых сделок от MoonBot...<br/>
                    <span style={{color: 'var(--text-muted)', fontSize: '0.85em'}}>
                      Графики появятся автоматически при совершении сделок
                    </span>
                  </>
                ) : (
                  <>
                    Запустите UDP Listener на странице Серверы,<br/>
                    чтобы получать графики автоматически
                  </>
                )}
              </small>
            </div>
          ) : (
            charts.map((chart) => (
              <div 
                key={chart.id}
                className={`${styles.chartItem} ${selectedChart?.id === chart.id ? styles.active : ''}`}
                onClick={() => setSelectedChart(chart)}
              >
                <div className={styles.chartItemHeader}>
                  <span className={styles.chartSymbol}>{chart.market_name || 'Unknown'}</span>
                  <span className={`${styles.chartProfit} ${(chart.session_profit || 0) >= 0 ? styles.positive : styles.negative}`}>
                    {(chart.session_profit || 0) >= 0 ? '+' : ''}{(chart.session_profit || 0).toFixed(4)}
                  </span>
                </div>
                <div className={styles.chartItemInfo}>
                  {selectedServer === 'all' && chart.server_name && (
                    <span style={{ color: 'var(--accent-primary)', fontWeight: '500' }}>{chart.server_name}</span>
                  )}
                  <span>ID: {chart.order_db_id}</span>
                  <span>{formatDate(chart.received_at)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chart Area */}
      <div className={`${styles.mainArea} ${isFullscreen ? styles.fullscreen : ''}`}>
        {loadingChart ? (
          <div className={styles.loading}>
            <FiRefreshCw className={styles.spinner} />
            <p>Загрузка графика...</p>
          </div>
        ) : tradingChartData ? (
          <div className={styles.chartWrapper}>
            <div className={styles.chartActions}>
              <button onClick={handleExportChart} className={styles.iconBtn} title="Экспорт JSON">
                <FiDownload />
              </button>
              <button onClick={() => setIsFullscreen(!isFullscreen)} className={styles.iconBtn} title={isFullscreen ? 'Свернуть' : 'Развернуть'}>
                {isFullscreen ? <FiMinimize2 /> : <FiMaximize2 />}
              </button>
            </div>
            <TradingChart 
              chartData={tradingChartData} 
              isFullscreen={isFullscreen} 
              onInteractionChange={setIsInteracting}
            />
          </div>
        ) : (
          <div className={styles.emptyChart}>
            <p>Выберите график для отображения</p>
            <small>Графики приходят автоматически при активном Listener</small>
          </div>
        )}
      </div>
    </div>
  );
};

export default TickCharts;
