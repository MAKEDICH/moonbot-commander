import React, { useState, useEffect } from 'react';
import api from '../api/api';
import { FiRefreshCw, FiClock, FiActivity } from 'react-icons/fi';
import styles from './ActivityHeatmap.module.css';

const ActivityHeatmap = ({ emulatorFilter, setEmulatorFilter, currencyFilter }) => {
  const [servers, setServers] = useState([]);
  const [selectedServer, setSelectedServer] = useState('all');
  const [heatmapData, setHeatmapData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [metric, setMetric] = useState('profit'); // profit, count, avg_profit

  useEffect(() => {
    loadServers();
  }, [currencyFilter]);

  useEffect(() => {
    if (servers.length > 0) {
      loadHeatmap();
    }
  }, [selectedServer, servers, emulatorFilter]);

  const loadServers = async () => {
    try {
      const response = await api.get('/api/servers');
      // Фильтруем серверы по валюте
      const filteredServers = currencyFilter === 'all' 
        ? response.data 
        : response.data.filter(server => server.default_currency === currencyFilter);
      setServers(filteredServers);
      
      // Если выбранный сервер больше не доступен, сбрасываем на 'all'
      if (selectedServer !== 'all' && !filteredServers.find(s => s.id === parseInt(selectedServer))) {
        setSelectedServer('all');
      }
    } catch (error) {
      console.error('Error loading servers:', error);
    }
  };

  const loadHeatmap = async () => {
    setLoading(true);
    try {
      let response;
      const params = new URLSearchParams();
      
      // Добавляем фильтр эмулятора
      if (emulatorFilter !== 'all') {
        params.append('emulator', emulatorFilter === 'emulator' ? 'true' : 'false');
      }
      
      const queryString = params.toString();
      const urlSuffix = queryString ? `?${queryString}` : '';
      
      if (selectedServer === 'all') {
        // Фильтруем данные только по серверам с нужной валютой
        const serverIds = servers.map(s => s.id).join(',');
        if (serverIds) {
          response = await api.get(`/api/heatmap-all${urlSuffix}${queryString ? '&' : '?'}server_ids=${serverIds}`);
        } else {
          // Если нет серверов с нужной валютой
          response = { data: { data: [] } };
        }
        setHeatmapData(response.data.data || []);
      } else {
        response = await api.get(`/api/servers/${selectedServer}/heatmap${urlSuffix}`);
        setHeatmapData(response.data.data || []);
      }
    } catch (error) {
      console.error('Error loading heatmap:', error);
      setHeatmapData([]);
    } finally {
      setLoading(false);
    }
  };

  // Определяем min/max значения для нормализации цвета
  const getMinMax = () => {
    if (heatmapData.length === 0) return { min: 0, max: 0 };
    
    const values = heatmapData.map(d => d[metric]);
    return {
      min: Math.min(...values),
      max: Math.max(...values)
    };
  };

  const { min, max } = getMinMax();

  // Цветовая функция: красный (убыток) -> серый (ноль) -> зелёный (прибыль)
  const getColor = (value) => {
    if (value === 0) return 'rgba(50, 50, 50, 0.3)'; // Серый для нулевых значений
    
    const range = max - min;
    if (range === 0) return 'rgba(50, 50, 50, 0.3)';
    
    const normalized = (value - min) / range; // 0 to 1
    
    if (value < 0) {
      // Красный для убытков
      const intensity = Math.abs(value) / Math.abs(min);
      return `rgba(255, 99, 71, ${0.2 + intensity * 0.8})`;
    } else {
      // Зелёный для прибыли
      const intensity = value / max;
      return `rgba(0, 255, 136, ${0.2 + intensity * 0.8})`;
    }
  };

  const formatValue = (value) => {
    if (metric === 'count') return Math.round(value);
    return parseFloat(value).toFixed(2);
  };

  const dayNames = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Группируем данные по дням и часам
  const getDataPoint = (day, hour) => {
    return heatmapData.find(d => d.day === day && d.hour === hour);
  };

  // Находим самое прибыльное время
  const getMostProfitable = () => {
    if (heatmapData.length === 0) return null;
    return heatmapData.reduce((best, current) => 
      current.profit > (best?.profit || -Infinity) ? current : best
    , null);
  };

  const mostProfitable = getMostProfitable();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>🌡️ Тепловая карта активности</h1>
          <p className={styles.subtitle}>Анализ прибыльности по времени суток и дням недели</p>
        </div>
        <div className={styles.controls}>
          <select
            value={emulatorFilter}
            onChange={(e) => setEmulatorFilter(e.target.value)}
            className={styles.serverSelect}
          >
            <option value="all">🎮 Все</option>
            <option value="real">💰 Реальные</option>
            <option value="emulator">🎮 Эмулятор</option>
          </select>
          <select
            value={selectedServer}
            onChange={(e) => setSelectedServer(e.target.value)}
            className={styles.serverSelect}
          >
            <option value="all">Все боты</option>
            {servers.map(server => (
              <option key={server.id} value={server.id}>
                {server.name}
              </option>
            ))}
          </select>
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
            className={styles.metricSelect}
          >
            <option value="profit">Прибыль (USDT)</option>
            <option value="count">Количество сделок</option>
            <option value="avg_profit">Средняя прибыль</option>
          </select>
          <button onClick={loadHeatmap} className={styles.refreshBtn} disabled={loading}>
            <FiRefreshCw className={loading ? styles.spinning : ''} />
            Обновить
          </button>
        </div>
      </div>

      {loading && <div className={styles.loading}>Загрузка данных...</div>}

      {!loading && heatmapData.length === 0 && (
        <div className={styles.noData}>
          <p>Нет данных для отображения</p>
        </div>
      )}

      {!loading && heatmapData.length > 0 && (
        <>
          {/* Статистика */}
          <div className={styles.statsRow}>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>
                <FiActivity />
              </div>
              <div className={styles.statContent}>
                <div className={styles.statLabel}>Самое прибыльное время</div>
                <div className={styles.statValue}>
                  {mostProfitable ? `${dayNames[mostProfitable.day]}, ${mostProfitable.hour}:00` : 'N/A'}
                </div>
                <div className={styles.statSubValue}>
                  {mostProfitable ? `${formatValue(mostProfitable.profit)} USDT` : ''}
                </div>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statIcon}>
                <FiClock />
              </div>
              <div className={styles.statContent}>
                <div className={styles.statLabel}>Всего периодов с активностью</div>
                <div className={styles.statValue}>
                  {heatmapData.filter(d => d.count > 0).length}
                </div>
                <div className={styles.statSubValue}>
                  из {24 * 7} возможных
                </div>
              </div>
            </div>
          </div>

          {/* Heatmap таблица */}
          <div className={styles.heatmapSection}>
            <div className={styles.heatmapWrapper}>
              <table className={styles.heatmapTable}>
                <thead>
                  <tr>
                    <th className={styles.cornerCell}>День \ Час</th>
                    {hours.map(hour => (
                      <th key={hour} className={styles.hourCell}>
                        {hour}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dayNames.map((dayName, dayIndex) => (
                    <tr key={dayIndex}>
                      <td className={styles.dayCell}>{dayName}</td>
                      {hours.map(hour => {
                        const dataPoint = getDataPoint(dayIndex, hour);
                        const value = dataPoint ? dataPoint[metric] : 0;
                        const bgColor = getColor(value);
                        
                        return (
                          <td
                            key={hour}
                            className={styles.heatCell}
                            style={{ backgroundColor: bgColor }}
                            title={`${dayName}, ${hour}:00\n${metric === 'profit' ? 'Прибыль' : metric === 'count' ? 'Сделок' : 'Ср. прибыль'}: ${formatValue(value)}\nСделок: ${dataPoint?.count || 0}`}
                          >
                            <span className={styles.cellValue}>
                              {value !== 0 ? formatValue(value) : ''}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Легенда */}
          <div className={styles.legend}>
            <div className={styles.legendTitle}>Легенда:</div>
            <div className={styles.legendItems}>
              <div className={styles.legendItem}>
                <div className={styles.legendColor} style={{ backgroundColor: 'rgba(255, 99, 71, 0.8)' }}></div>
                <span>Убыток</span>
              </div>
              <div className={styles.legendItem}>
                <div className={styles.legendColor} style={{ backgroundColor: 'rgba(50, 50, 50, 0.3)' }}></div>
                <span>Нет данных</span>
              </div>
              <div className={styles.legendItem}>
                <div className={styles.legendColor} style={{ backgroundColor: 'rgba(0, 255, 136, 0.8)' }}></div>
                <span>Прибыль</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ActivityHeatmap;

