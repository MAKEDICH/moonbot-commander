import React, { useState, useEffect } from 'react';
import api from '../api/api';
import { FiTrendingUp, FiTrendingDown, FiRefreshCw, FiAward, FiTarget } from 'react-icons/fi';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import styles from './StrategyComparison.module.css';

const StrategyComparison = ({ emulatorFilter, setEmulatorFilter, currencyFilter }) => {
  const [servers, setServers] = useState([]);
  const [selectedServer, setSelectedServer] = useState('all');
  const [strategies, setStrategies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState('total_profit'); // total_profit, win_rate, profit_factor
  const [sortOrder, setSortOrder] = useState('desc'); // asc, desc

  useEffect(() => {
    loadServers();
  }, [currencyFilter]);

  useEffect(() => {
    if (servers.length > 0) {
      loadStrategies();
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

  const loadStrategies = async () => {
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
        // Фильтруем стратегии только по серверам с нужной валютой
        const serverIds = servers.map(s => s.id).join(',');
        if (serverIds) {
          response = await api.get(`/api/strategies/comparison-all${urlSuffix}${queryString ? '&' : '?'}server_ids=${serverIds}`);
        } else {
          // Если нет серверов с нужной валютой
          response = { data: { strategies: [] } };
        }
        setStrategies(response.data.strategies || []);
      } else {
        response = await api.get(`/api/servers/${selectedServer}/strategies/comparison${urlSuffix}`);
        setStrategies(response.data.strategies || []);
      }
    } catch (error) {
      console.error('Error loading strategies:', error);
      setStrategies([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const sortedStrategies = [...strategies].sort((a, b) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];
    const multiplier = sortOrder === 'asc' ? 1 : -1;
    
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return (aVal - bVal) * multiplier;
    }
    return String(aVal).localeCompare(String(bVal)) * multiplier;
  });

  const formatNumber = (num) => {
    if (num === null || num === undefined) return '0';
    return parseFloat(num).toFixed(4);
  };

  const formatPercent = (num) => {
    if (num === null || num === undefined) return '0.00%';
    return `${parseFloat(num).toFixed(2)}%`;
  };

  const getTopStrategies = () => {
    return sortedStrategies.slice(0, 5);
  };

  const chartData = getTopStrategies().map(s => ({
    name: s.strategy,
    'Прибыль': parseFloat(s.total_profit),
    'Винрейт %': parseFloat(s.win_rate),
    'Profit Factor': parseFloat(s.profit_factor)
  }));

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>⚖️ Сравнение стратегий</h1>
          <p className={styles.subtitle}>Анализ эффективности торговых стратегий</p>
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
          <button onClick={loadStrategies} className={styles.refreshBtn} disabled={loading}>
            <FiRefreshCw className={loading ? styles.spinning : ''} />
            Обновить
          </button>
        </div>
      </div>

      {loading && <div className={styles.loading}>Загрузка данных...</div>}

      {!loading && strategies.length === 0 && (
        <div className={styles.noData}>
          <p>Нет данных о стратегиях для отображения</p>
        </div>
      )}

      {!loading && strategies.length > 0 && (
        <>
          {/* Графики топ-5 стратегий */}
          <div className={styles.chartsSection}>
            <h3>Топ-5 стратегий</h3>
            <div className={styles.chartsGrid}>
              {/* График прибыли */}
              <div className={styles.chartCard}>
                <h4>Общая прибыль (USDT)</h4>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                    <XAxis dataKey="name" stroke="var(--text-muted)" />
                    <YAxis stroke="var(--text-muted)" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--accent-primary)',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="Прибыль" fill="#00ff88" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* График винрейта */}
              <div className={styles.chartCard}>
                <h4>Винрейт (%)</h4>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                    <XAxis dataKey="name" stroke="var(--text-muted)" />
                    <YAxis stroke="var(--text-muted)" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--accent-primary)',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="Винрейт %" fill="#00d4ff" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Таблица со всеми стратегиями */}
          <div className={styles.tableSection}>
            <h3>Детальная статистика</h3>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th onClick={() => handleSort('strategy')} className={styles.sortable}>
                      Стратегия {sortBy === 'strategy' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => handleSort('total_orders')} className={styles.sortable}>
                      Сделок {sortBy === 'total_orders' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => handleSort('open_orders')} className={styles.sortable}>
                      Открыто {sortBy === 'open_orders' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => handleSort('closed_orders')} className={styles.sortable}>
                      Закрыто {sortBy === 'closed_orders' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => handleSort('total_profit')} className={styles.sortable}>
                      Прибыль (USDT) {sortBy === 'total_profit' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => handleSort('win_rate')} className={styles.sortable}>
                      Винрейт {sortBy === 'win_rate' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => handleSort('profit_factor')} className={styles.sortable}>
                      Profit Factor {sortBy === 'profit_factor' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => handleSort('avg_profit_per_order')} className={styles.sortable}>
                      Ср. прибыль {sortBy === 'avg_profit_per_order' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => handleSort('best_trade')} className={styles.sortable}>
                      Лучшая сделка {sortBy === 'best_trade' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => handleSort('worst_trade')} className={styles.sortable}>
                      Худшая сделка {sortBy === 'worst_trade' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedStrategies.map((strategy, index) => (
                    <tr key={index} className={styles.row}>
                      <td className={styles.strategyName}>
                        {strategy.total_profit > 0 ? (
                          <FiTrendingUp className={styles.iconProfit} />
                        ) : (
                          <FiTrendingDown className={styles.iconLoss} />
                        )}
                        {strategy.strategy}
                      </td>
                      <td>{strategy.total_orders}</td>
                      <td>
                        <span className={styles.statusOpen}>{strategy.open_orders}</span>
                      </td>
                      <td>
                        <span className={styles.statusClosed}>{strategy.closed_orders}</span>
                      </td>
                      <td className={strategy.total_profit >= 0 ? styles.profit : styles.loss}>
                        {formatNumber(strategy.total_profit)}
                      </td>
                      <td>
                        <span className={strategy.win_rate >= 50 ? styles.goodWinRate : styles.badWinRate}>
                          {formatPercent(strategy.win_rate)}
                        </span>
                      </td>
                      <td>
                        <span className={strategy.profit_factor >= 1.5 ? styles.goodPF : styles.badPF}>
                          {formatNumber(strategy.profit_factor)}
                        </span>
                      </td>
                      <td className={strategy.avg_profit_per_order >= 0 ? styles.profit : styles.loss}>
                        {formatNumber(strategy.avg_profit_per_order)}
                      </td>
                      <td className={styles.profit}>{formatNumber(strategy.best_trade)}</td>
                      <td className={styles.loss}>{formatNumber(strategy.worst_trade)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Карточки с ключевыми метриками */}
          <div className={styles.metricsSection}>
            <h3>Ключевые метрики</h3>
            <div className={styles.metricsGrid}>
              <div className={styles.metricCard}>
                <div className={styles.metricIcon}>
                  <FiAward />
                </div>
                <div className={styles.metricContent}>
                  <div className={styles.metricLabel}>Лучшая стратегия (прибыль)</div>
                  <div className={styles.metricValue}>
                    {sortedStrategies[0]?.strategy || 'N/A'}
                  </div>
                  <div className={styles.metricSubValue}>
                    {formatNumber(sortedStrategies[0]?.total_profit || 0)} USDT
                  </div>
                </div>
              </div>

              <div className={styles.metricCard}>
                <div className={styles.metricIcon}>
                  <FiTarget />
                </div>
                <div className={styles.metricContent}>
                  <div className={styles.metricLabel}>Лучший винрейт</div>
                  <div className={styles.metricValue}>
                    {[...sortedStrategies].sort((a, b) => b.win_rate - a.win_rate)[0]?.strategy || 'N/A'}
                  </div>
                  <div className={styles.metricSubValue}>
                    {formatPercent([...sortedStrategies].sort((a, b) => b.win_rate - a.win_rate)[0]?.win_rate || 0)}
                  </div>
                </div>
              </div>

              <div className={styles.metricCard}>
                <div className={styles.metricIcon}>
                  <FiTrendingUp />
                </div>
                <div className={styles.metricContent}>
                  <div className={styles.metricLabel}>Лучший Profit Factor</div>
                  <div className={styles.metricValue}>
                    {[...sortedStrategies].sort((a, b) => b.profit_factor - a.profit_factor)[0]?.strategy || 'N/A'}
                  </div>
                  <div className={styles.metricSubValue}>
                    {formatNumber([...sortedStrategies].sort((a, b) => b.profit_factor - a.profit_factor)[0]?.profit_factor || 0)}
                  </div>
                </div>
              </div>

              <div className={styles.metricCard}>
                <div className={styles.metricIcon}>
                  <FiTrendingDown />
                </div>
                <div className={styles.metricContent}>
                  <div className={styles.metricLabel}>Всего стратегий</div>
                  <div className={styles.metricValue}>{strategies.length}</div>
                  <div className={styles.metricSubValue}>
                    {strategies.filter(s => s.total_profit > 0).length} прибыльных
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default StrategyComparison;

