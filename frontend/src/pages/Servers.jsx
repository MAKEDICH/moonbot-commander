import React, { useState, useEffect } from 'react';
import { FiServer, FiPlus, FiEdit2, FiTrash2, FiCheckCircle, FiXCircle, FiRadio, FiRefreshCw } from 'react-icons/fi';
import { serversAPI } from '../api/api';
import Tooltip from '../components/Tooltip';
import styles from './Servers.module.css';
import { getApiBaseUrl } from '../utils/apiUrl';

const Servers = () => {
  const API_BASE_URL = getApiBaseUrl();
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingServer, setEditingServer] = useState(null);
  const [testingServer, setTestingServer] = useState(null);
  const [listenerStatuses, setListenerStatuses] = useState({});
  const [actionLoading, setActionLoading] = useState({});
  const [formData, setFormData] = useState({
    name: '',
    host: '',
    port: '',
    password: '',  // UDP пароль для HMAC-SHA256
    description: '',
    group_name: ''
  });

  useEffect(() => {
    loadServers();
  }, []);

  useEffect(() => {
    if (servers.length > 0) {
      servers.forEach(server => {
        loadListenerStatus(server.id);
      });
    }
  }, [servers.length]);

  const loadServers = async () => {
    try {
      const response = await serversAPI.getAll();
      setServers(response.data);
    } catch (error) {
      console.error('Error loading servers:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadListenerStatus = async (serverId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/servers/${serverId}/listener/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setListenerStatuses(prev => ({ ...prev, [serverId]: data }));
      }
    } catch (error) {
      console.error(`Error loading listener status for server ${serverId}:`, error);
    }
  };

  const handleListenerStart = async (serverId) => {
    setActionLoading(prev => ({ ...prev, [`start-${serverId}`]: true }));
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/servers/${serverId}/listener/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        await loadListenerStatus(serverId);
      } else {
        const data = await response.json();
        alert(data.detail || 'Ошибка запуска listener');
      }
    } catch (error) {
      alert('Ошибка запуска listener');
    } finally {
      setActionLoading(prev => ({ ...prev, [`start-${serverId}`]: false }));
    }
  };

  const handleListenerStop = async (serverId) => {
    setActionLoading(prev => ({ ...prev, [`stop-${serverId}`]: true }));
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/servers/${serverId}/listener/stop`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        await loadListenerStatus(serverId);
      } else {
        alert('Ошибка остановки listener');
      }
    } catch (error) {
      alert('Ошибка остановки listener');
    } finally {
      setActionLoading(prev => ({ ...prev, [`stop-${serverId}`]: false }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingServer) {
        await serversAPI.update(editingServer.id, formData);
      } else {
        await serversAPI.create(formData);
      }
      await loadServers();
      handleCloseModal();
    } catch (error) {
      alert(error.response?.data?.detail || 'Ошибка сохранения сервера');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Вы уверены, что хотите удалить этот сервер?')) return;
    
    try {
      await serversAPI.delete(id);
      await loadServers();
    } catch (error) {
      alert(error.response?.data?.detail || 'Ошибка удаления сервера');
    }
  };

  const handleTest = async (id) => {
    setTestingServer(id);
    try {
      const response = await serversAPI.test(id);
      alert(response.data.is_online ? 'Сервер доступен!' : 'Сервер недоступен');
    } catch (error) {
      alert('Ошибка проверки соединения');
    } finally {
      setTestingServer(null);
    }
  };

  const handleEdit = (server) => {
    setEditingServer(server);
    setFormData({
      name: server.name,
      host: server.host,
      port: server.port.toString(),
      password: server.password || '',  // Пароль для HMAC-SHA256
      description: server.description || '',
      group_name: server.group_name || ''
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingServer(null);
    setFormData({ name: '', host: '', port: '', password: '', description: '', group_name: '' });
  };

  if (loading) {
    return <div className={styles.loading}>Загрузка...</div>;
  }

  return (
    <div className={styles.servers}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Серверы</h1>
          <p className={styles.subtitle}>Управление вашими MoonBot серверами</p>
        </div>
        <Tooltip text="Добавить новый MoonBot сервер для удаленного управления" position="bottom">
          <button className={styles.addBtn} onClick={() => setShowModal(true)}>
            <FiPlus />
            Добавить сервер
          </button>
        </Tooltip>
      </div>

      {servers.length === 0 ? (
        <div className={styles.emptyState}>
          <FiServer />
          <p>У вас пока нет серверов</p>
          <p className={styles.emptySubtext}>Добавьте свой первый сервер для начала работы</p>
          <button className={styles.addBtnLarge} onClick={() => setShowModal(true)}>
            <FiPlus />
            Добавить первый сервер
          </button>
        </div>
      ) : (
        <div className={styles.serverGrid}>
          {servers.map((server) => {
            const listenerStatus = listenerStatuses[server.id];
            const isListenerRunning = listenerStatus?.is_running;
            
            return (
            <div key={server.id} className={styles.serverCard}>
              <div className={styles.serverHeader}>
                <div className={styles.serverIcon}>
                  <FiServer />
                </div>
                <div className={`${styles.statusBadge} ${server.is_active ? styles.active : styles.inactive}`}>
                  {server.is_active ? <FiCheckCircle /> : <FiXCircle />}
                </div>
              </div>
              
              <h3 className={styles.serverName}>{server.name}</h3>
              <div className={styles.serverAddress}>{server.host}:{server.port}</div>
              
              {server.description && (
                <p className={styles.serverDescription}>{server.description}</p>
              )}

              {/* UDP Listener Status */}
              <div className={styles.listenerSection}>
                <div className={styles.listenerHeader}>
                  <FiRadio className={isListenerRunning ? styles.listenerIconActive : styles.listenerIconInactive} />
                  <span className={styles.listenerLabel}>
                    UDP Listener: {isListenerRunning ? 'Работает' : 'Остановлен'}
                  </span>
                </div>
                
                {listenerStatus && isListenerRunning && (
                  <div className={styles.listenerStats}>
                    <small>Получено: {listenerStatus.messages_received || 0} пакетов</small>
                    {listenerStatus.last_message_at && (
                      <small>Последний: {new Date(listenerStatus.last_message_at).toLocaleTimeString('ru-RU')}</small>
                    )}
                  </div>
                )}
                
                <div className={styles.listenerActions}>
                  {isListenerRunning ? (
                    <button 
                      className={`${styles.listenerBtn} ${styles.stopBtn}`}
                      onClick={() => handleListenerStop(server.id)}
                      disabled={actionLoading[`stop-${server.id}`]}
                      title="Остановить listener"
                    >
                      {actionLoading[`stop-${server.id}`] ? '...' : 'Стоп'}
                    </button>
                  ) : (
                    <button 
                      className={`${styles.listenerBtn} ${styles.startBtn}`}
                      onClick={() => handleListenerStart(server.id)}
                      disabled={actionLoading[`start-${server.id}`]}
                      title="Запустить listener"
                    >
                      {actionLoading[`start-${server.id}`] ? '...' : 'Старт'}
                    </button>
                  )}
                </div>
              </div>

              <div className={styles.serverActions}>
                <button 
                  className={styles.actionBtn}
                  onClick={() => handleTest(server.id)}
                  disabled={testingServer === server.id}
                >
                  {testingServer === server.id ? 'Проверка...' : 'Тест'}
                </button>
                <button 
                  className={styles.actionBtn}
                  onClick={() => handleEdit(server)}
                >
                  <FiEdit2 />
                </button>
                <button 
                  className={`${styles.actionBtn} ${styles.deleteBtn}`}
                  onClick={() => handleDelete(server.id)}
                >
                  <FiTrash2 />
                </button>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div 
          className={styles.modal}
          onMouseDown={(e) => {
            // Закрываем только если mousedown был непосредственно на overlay
            if (e.target === e.currentTarget) {
              e.preventDefault();
              handleCloseModal();
            }
          }}
        >
          <div className={styles.modalContent}>
            <h2 className={styles.modalTitle}>
              {editingServer ? 'Редактировать сервер' : 'Добавить сервер'}
            </h2>
            
            <form onSubmit={handleSubmit}>
              <div className={styles.formGroup}>
                <label>Название</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Например: Главный сервер"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label>Хост (IP адрес)</label>
                <input
                  type="text"
                  value={formData.host}
                  onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                  placeholder="127.0.0.1"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label>UDP порт</label>
                <input
                  type="number"
                  value={formData.port}
                  onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                  placeholder="5005"
                  min="1"
                  max="65535"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label>UDP пароль (необязательно)</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Пароль для HMAC-SHA256"
                />
                <small style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>
                  🔒 Требуется для нового протокола MoonBot (HMAC-SHA256).<br/>
                  Укажите пароль из: Настройки → Специальные → Remote → UDP Commands Pass
                </small>
              </div>

              <div className={styles.formGroup}>
                <label>Описание (необязательно)</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Краткое описание сервера"
                  rows="3"
                />
              </div>

              <div className={styles.formGroup}>
                <label>Группа (необязательно)</label>
                <input
                  type="text"
                  value={formData.group_name}
                  onChange={(e) => setFormData({ ...formData, group_name: e.target.value })}
                  placeholder="Например: Production, Test"
                />
                <small style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>
                  Используйте группы для массовой отправки команд
                </small>
              </div>

              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={handleCloseModal}>
                  Отмена
                </button>
                <button type="submit" className={styles.saveBtn}>
                  {editingServer ? 'Сохранить' : 'Добавить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Servers;

