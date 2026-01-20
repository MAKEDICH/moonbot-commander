/**
 * Шапка страницы Orders
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaSync } from 'react-icons/fa';
import { FiList } from 'react-icons/fi';
import styles from '../../pages/Orders.module.css';
import commonStyles from '../../styles/common.module.css';
import PageHeader from '../PageHeader';

export default function OrdersHeader({
  selectedServer,
  servers,
  autoRefresh,
  loading,
  onServerChange,
  onRefresh,
  onAutoRefreshToggle,
  onClearOrders
}) {
  const navigate = useNavigate();

  return (
    <PageHeader 
      icon={<FiList />} 
      title="MoonBot Orders" 
      gradient="purple"
    >
        <div className={styles.serverSelect}>
          <label>Сервер:</label>
          <select 
            value={selectedServer} 
            onChange={(e) => onServerChange(e.target.value)}
            className={commonStyles.selectField}
          >
            <option value="all">Все сервера</option>
            {Array.isArray(servers) && servers.map(server => (
              <option key={server.id} value={server.id}>
                {server.name}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.autoRefreshToggle}>
          <label>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={onAutoRefreshToggle}
            />
            Авто
          </label>
        </div>

        <button onClick={onRefresh} className={styles.refreshBtn} disabled={loading}>
          <FaSync className={loading ? styles.spinning : ''} />
        </button>
        
        <div className={styles.columnSettingsWrapper}>
          <button 
            onClick={() => navigate('/column-settings')} 
            className={styles.columnSettingsBtn}
            title="Настройка колонок"
          >
            <span style={{filter: 'grayscale(0)', fontSize: '16px', marginRight: '6px'}}>⚙️</span> Колонки
          </button>
        </div>
        
        <button 
          onClick={onClearOrders} 
          className={styles.clearBtn}
          disabled={loading}
          title={selectedServer === 'all' ? 'Очистить ордера со всех серверов' : 'Очистить все ордера сервера'}
        >
          <span style={{fontSize: '18px'}}>🗑️</span>
        </button>
    </PageHeader>
  );
}



