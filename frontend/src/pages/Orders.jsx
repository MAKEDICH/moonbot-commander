/**
 * Страница Orders - управление ордерами
 */

import React, { useState, useCallback, Suspense } from 'react';
import { FiMaximize2, FiMinimize2 } from 'react-icons/fi';
import { useNotification } from '../context/NotificationContext';
import styles from './Orders.module.css';
import {
  OrdersHeader,
  OrdersStats,
  OrdersFilters,
  OrdersTable,
  useOrders,
  handleServerChange as doServerChange,
  handleRefresh as doRefresh,
  handleFilterChange as doFilterChange,
  handleSort as doSort,
  handleClearOrders as doClearOrders,
  handleDeleteOrder as doDeleteOrder,
  handlePageChange as doPageChange,
  handleAutoRefreshToggle as doAutoRefreshToggle
} from '../components/Orders';
import { chartsAPI } from '../api/api';

// Lazy load TradingChart для оптимизации
const TradingChart = React.lazy(() => import('../components/TradingChart'));

const Orders = ({ autoRefresh, setAutoRefresh, emulatorFilter, setEmulatorFilter, currencyFilter }) => {
  const { confirm, success, error: showError } = useNotification();
  
  // Состояние для модального окна графика
  const [chartModal, setChartModal] = useState({ open: false, order: null, chartData: null, loading: false });
  const [isChartFullscreen, setIsChartFullscreen] = useState(false);
  
  const {
    // Данные
    servers,
    selectedServer,
    orders,
    stats,
    loading,
    loadingProgress,
    total,
    page,
    limit,
    statusFilter,
    symbolFilter,
    error,
    sortBy,
    sortOrder,
    visibleColumns,
    
    // Setters
    setSelectedServer,
    setPage,
    setStatusFilter,
    setSymbolFilter,
    setError,
    setSortBy,
    setSortOrder,
    setOrders,
    setTotal,
    setStats,
    fetchOrders,
    fetchStats,
  } = useOrders(autoRefresh, setAutoRefresh, emulatorFilter, setEmulatorFilter, currencyFilter);

  const totalPages = Math.ceil(total / limit);

  // Обработчики событий
  const handleServerChange = (serverId) => {
    doServerChange(serverId, {
      setSelectedServer,
      setPage,
      setStatusFilter,
      setSymbolFilter,
      fetchOrders,
      fetchStats,
      emulatorFilter
    });
  };

  const handleRefresh = async () => {
    await doRefresh(selectedServer, servers, {
      setLoading: (val) => {},
      setError,
      fetchOrders,
      fetchStats,
      page,
      statusFilter,
      symbolFilter,
      emulatorFilter
    });
  };

  const handleFilterChange = (status, symbol, emulator) => {
    doFilterChange(status, symbol, emulator, {
      setStatusFilter,
      setSymbolFilter,
      setEmulatorFilter,
      setPage,
      fetchOrders,
      fetchStats,
      selectedServer,
      emulatorFilter
    });
  };

  const handleSort = (field) => {
    doSort(field, {
      sortBy,
      sortOrder,
      setSortBy,
      setSortOrder
    });
  };

  const handleClearOrders = async () => {
    await doClearOrders(selectedServer, {
      confirm,
      success,
      showError,
      fetchOrders,
      fetchStats,
      setPage,
      statusFilter,
      symbolFilter,
      emulatorFilter
    });
  };

  const handleDeleteOrder = async (serverId, orderId) => {
    await doDeleteOrder(serverId, orderId, {
      confirm,
      success,
      showError,
      orders,
      stats,
      servers,
      page,
      setOrders,
      setTotal,
      setStats,
      handlePageChange: (newPage) => handlePageChange(newPage)
    });
  };

  const handlePageChange = (newPage) => {
    doPageChange(newPage, {
      fetchOrders,
      selectedServer,
      statusFilter,
      symbolFilter,
      emulatorFilter
    });
  };

  const handleAutoRefreshToggle = (e) => {
    doAutoRefreshToggle(e, { setAutoRefresh });
  };

  // Обработчик клика по строке ордера - открытие графика
  const handleRowClick = useCallback(async (order) => {
    if (!order.server_id || !order.moonbot_order_id) {
      showError('Не удалось определить ID ордера');
      return;
    }

    console.log('[Orders] Opening chart for order:', {
      server_id: order.server_id,
      moonbot_order_id: order.moonbot_order_id,
      symbol: order.symbol
    });

    setChartModal({ open: true, order, chartData: null, loading: true });

    try {
      const response = await chartsAPI.getChart(order.server_id, order.moonbot_order_id);
      console.log('[Orders] Chart API response:', response.data);
      
      // API возвращает data (не chart_data), добавляем мета-данные
      if (response.data && response.data.data) {
        const chartData = {
          ...response.data.data,
          market_name: response.data.market_name || response.data.data.market_name,
          market_currency: response.data.market_currency || response.data.data.market_currency,
          strategy_name: response.data.strategy_name || null,
          start_time: response.data.start_time || response.data.data.start_time || null,
          end_time: response.data.end_time || response.data.data.end_time || null,
        };
        setChartModal(prev => ({ ...prev, chartData, loading: false }));
      } else {
        console.log('[Orders] No chart data in response');
        setChartModal(prev => ({ ...prev, chartData: null, loading: false }));
      }
    } catch (err) {
      // 404 означает что график не найден - это нормально
      if (err.response?.status === 404) {
        console.log('[Orders] Chart not found (404)');
      } else {
        console.error('[Orders] Error loading chart:', err);
      }
      setChartModal(prev => ({ ...prev, chartData: null, loading: false }));
    }
  }, [showError]);

  // Закрытие модального окна
  const closeChartModal = useCallback(() => {
    setChartModal({ open: false, order: null, chartData: null, loading: false });
  }, []);

  return (
    <div className={styles.container}>
      {error && (
        <div className={styles.errorBanner}>
          ⚠️ {error}
          <button onClick={() => setError(null)} className={styles.closeError}>×</button>
        </div>
      )}
      
      <OrdersHeader
        selectedServer={selectedServer}
        servers={servers}
        autoRefresh={autoRefresh}
        loading={loading}
        onServerChange={handleServerChange}
        onRefresh={handleRefresh}
        onAutoRefreshToggle={handleAutoRefreshToggle}
        onClearOrders={handleClearOrders}
      />

      <OrdersStats
        stats={stats}
        selectedServer={selectedServer}
      />

      <OrdersFilters
        statusFilter={statusFilter}
        symbolFilter={symbolFilter}
        emulatorFilter={emulatorFilter}
        onFilterChange={handleFilterChange}
      />

      <OrdersTable
        orders={orders}
        loading={loading}
        loadingProgress={loadingProgress}
        selectedServer={selectedServer}
        visibleColumns={visibleColumns}
        sortBy={sortBy}
        sortOrder={sortOrder}
        page={page}
        totalPages={totalPages}
        onSort={handleSort}
        onDeleteOrder={handleDeleteOrder}
        onPageChange={handlePageChange}
        onRowClick={handleRowClick}
      />

      {/* Модальное окно с графиком */}
      {chartModal.open && (
        <div className={styles.chartModalOverlay} onClick={closeChartModal}>
          <div 
            className={`${styles.chartModal} ${isChartFullscreen ? styles.chartModalFullscreen : ''}`} 
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.chartModalHeader}>
              <h3>
                📊 График ордера #{chartModal.order?.moonbot_order_id} - {chartModal.order?.symbol}
              </h3>
              <div className={styles.chartModalActions}>
                <button 
                  className={styles.chartModalFullscreenBtn} 
                  onClick={() => setIsChartFullscreen(!isChartFullscreen)}
                  title={isChartFullscreen ? 'Свернуть' : 'На весь экран'}
                >
                  {isChartFullscreen ? <FiMinimize2 /> : <FiMaximize2 />}
                </button>
                <button className={styles.chartModalClose} onClick={closeChartModal}>×</button>
              </div>
            </div>
            <div className={styles.chartModalContent}>
              {chartModal.loading ? (
                <div className={styles.chartLoading}>
                  <div className={styles.spinner}></div>
                  <p>Загрузка графика...</p>
                </div>
              ) : chartModal.chartData ? (
                <Suspense fallback={<div className={styles.chartLoading}>Загрузка компонента...</div>}>
                  <TradingChart chartData={chartModal.chartData} isFullscreen={isChartFullscreen} />
                </Suspense>
              ) : (
                <div className={styles.noChart}>
                  <p>📈 График для ордера #{chartModal.order?.moonbot_order_id} не найден</p>
                  <small>
                    Графики сохраняются автоматически при получении данных от MoonBot.<br/>
                    Убедитесь что Listener запущен и подписка на графики активна.
                  </small>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;
