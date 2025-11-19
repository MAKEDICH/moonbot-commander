import React, { useState, useEffect } from 'react';
import { FiServer, FiPlus, FiEdit2, FiTrash2, FiCheckCircle, FiXCircle, FiRadio, FiRefreshCw, FiGrid, FiList, FiDollarSign } from 'react-icons/fi';
import { serversAPI } from '../api/api';
import Tooltip from '../components/Tooltip';
import styles from './Servers.module.css';
import { getApiBaseUrl } from '../utils/apiUrl';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../context/NotificationContext';

const Servers = () => {
  const API_BASE_URL = getApiBaseUrl();
  const navigate = useNavigate();
  const { success, error: showError, confirm } = useNotification();
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingServer, setEditingServer] = useState(null);
  const [testingServer, setTestingServer] = useState(null);
  const [listenerStatuses, setListenerStatuses] = useState({});
  const [actionLoading, setActionLoading] = useState({});
  const [availableGroups, setAvailableGroups] = useState([]); // Список всех групп
  const [selectedGroups, setSelectedGroups] = useState([]); // Выбранные группы для сервера
  
  // ДОБАВЛЕНО: Переключатель вида (полный/компактный)
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('serversViewMode') || 'full';
  });
  
  const [formData, setFormData] = useState({
    name: '',
    host: '',
    port: '',
    password: '',  // UDP пароль для HMAC-SHA256
    description: '',
    group_name: '',
    keepalive_enabled: true,  // По умолчанию включён
    is_localhost: false  // По умолчанию запрещён localhost
  });

  useEffect(() => {
    loadServers();
    loadGroups();
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

  const loadGroups = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/groups`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAvailableGroups(data.groups || []);
        
        // Добавляем также пустые группы из localStorage
        const emptyGroups = JSON.parse(localStorage.getItem('emptyGroups') || '[]');
        const allGroups = [...new Set([...data.groups, ...emptyGroups])];
        setAvailableGroups(allGroups);
      }
    } catch (error) {
      console.error('Error loading groups:', error);
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
        showError(data.detail || 'Ошибка запуска listener');
      }
    } catch (error) {
      showError('Ошибка запуска listener');
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
        showError('Ошибка остановки listener');
      }
    } catch (error) {
      showError('Ошибка остановки listener');
    } finally {
      setActionLoading(prev => ({ ...prev, [`stop-${serverId}`]: false }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Объединяем выбранные группы через запятую
      const dataToSend = {
        ...formData,
        group_name: selectedGroups.join(', ')
      };
      
      // ВАЖНО: Если редактируем и пароль пустой - НЕ отправляем его (чтобы не перезаписать)
      if (editingServer && !dataToSend.password) {
        delete dataToSend.password;
      }
      
      if (editingServer) {
        await serversAPI.update(editingServer.id, dataToSend);
      } else {
        await serversAPI.create(dataToSend);
      }
      await loadServers();
      await loadGroups(); // Обновляем список групп на случай если добавили новую
      handleCloseModal();
    } catch (error) {
      showError(error.response?.data?.detail || 'Ошибка сохранения сервера');
    }
  };

  const handleDelete = async (id) => {
    const confirmed = await confirm({
      title: 'Удаление сервера',
      message: 'Вы уверены, что хотите удалить этот сервер?',
      type: 'danger',
      confirmText: 'Удалить',
      cancelText: 'Отмена',
    });
    
    if (!confirmed) return;
    
    try {
      await serversAPI.delete(id);
      await loadServers();
      success('Сервер успешно удалён');
    } catch (error) {
      showError(error.response?.data?.detail || 'Ошибка удаления сервера');
    }
  };

  const handleTest = async (id) => {
    setTestingServer(id);
    try {
      const response = await serversAPI.test(id);
      if (response.data.is_online) {
        success('Сервер доступен!');
      } else {
        showError('Сервер недоступен');
      }
    } catch (error) {
      showError('Ошибка проверки соединения');
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
      group_name: server.group_name || '',
      keepalive_enabled: server.keepalive_enabled !== false,  // По умолчанию true
      is_localhost: server.is_localhost || false  // По умолчанию false
    });
    
    // Разбираем группы из строки через запятую
    if (server.group_name) {
      const groups = server.group_name.split(',').map(g => g.trim()).filter(g => g);
      setSelectedGroups(groups);
    } else {
      setSelectedGroups([]);
    }
    
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingServer(null);
    setSelectedGroups([]);
    setFormData({ name: '', host: '', port: '', password: '', description: '', group_name: '', keepalive_enabled: true, is_localhost: false });
  };

  // ДОБАВЛЕНО: Функция переключения вида
  const toggleViewMode = () => {
    const newMode = viewMode === 'full' ? 'compact' : 'full';
    setViewMode(newMode);
    localStorage.setItem('serversViewMode', newMode);
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
        <div className={styles.headerActions}>
          <button 
            onClick={toggleViewMode} 
            className={styles.viewToggleBtn}
            title={viewMode === 'full' ? 'Переключить на компактный вид' : 'Переключить на полный вид'}
          >
            {viewMode === 'full' ? <><FiList /> Компактный</> : <><FiGrid /> Полный</>}
          </button>
          <Tooltip text="Посмотреть балансы всех серверов" position="bottom">
            <button 
              className={styles.balancesBtn} 
              onClick={() => navigate('/balances')}
            >
              <FiDollarSign />
              Балансы
            </button>
          </Tooltip>
          <Tooltip text="Добавить новый MoonBot сервер для удаленного управления" position="bottom">
            <button className={styles.addBtn} onClick={() => setShowModal(true)}>
              <FiPlus />
              Добавить сервер
            </button>
          </Tooltip>
        </div>
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
        <div className={`${styles.serverGrid} ${viewMode === 'compact' ? styles.compactView : ''}`}>
          {servers.map((server) => {
            const listenerStatus = listenerStatuses[server.id];
            const isListenerRunning = listenerStatus?.is_running;
            
            return (
            <div key={server.id} className={`${styles.serverCard} ${viewMode === 'compact' ? styles.compact : ''}`}>
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
              
              {server.group_name && (
                <div className={styles.groupBadges}>
                  {server.group_name.split(',').map((g, idx) => (
                    <span key={idx} className={styles.groupBadge}>{g.trim()}</span>
                  ))}
                </div>
              )}
              
              {viewMode === 'full' && server.description && (
                <p className={styles.serverDescription}>{server.description}</p>
              )}

              {/* UDP Listener Status - только в полном виде */}
              {viewMode === 'full' && (
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
              )}

              {/* Компактная информация о listener */}
              {viewMode === 'compact' && (
                <div className={styles.compactListener}>
                  <FiRadio className={isListenerRunning ? styles.listenerIconActive : styles.listenerIconInactive} />
                  <span className={styles.compactListenerText}>
                    {isListenerRunning ? 'UDP: ВКЛ' : 'UDP: ВЫКЛ'}
                  </span>
                </div>
              )}

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
              {/* Название сервера */}
              <div className={styles.formGroup}>
                <label>
                  <span className={styles.labelIcon}>🖥️</span>
                  Название сервера
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Например: Главный сервер"
                  required
                  className={styles.modernInput}
                />
              </div>

              {/* Сетевые настройки */}
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>
                    <span className={styles.labelIcon}>🌐</span>
                    IP адрес
                  </label>
                  <input
                    type="text"
                    value={formData.host}
                    onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                    placeholder="127.0.0.1"
                    required
                    className={styles.modernInput}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>
                    <span className={styles.labelIcon}>🔌</span>
                    UDP порт
                  </label>
                  <input
                    type="number"
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                    placeholder="5005"
                    min="1"
                    max="65535"
                    required
                    className={styles.modernInput}
                  />
                </div>
              </div>

              {/* Безопасность */}
              <div className={styles.formGroup}>
                <label>
                  <span className={styles.labelIcon}>🔐</span>
                  UDP пароль
                  <span className={styles.optionalBadge}>необязательно</span>
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••••"
                  className={styles.modernInput}
                />
                <div className={styles.hint}>
                  <span className={styles.hintIcon}>💡</span>
                  <div className={styles.hintText}>
                    <strong>Требуется для HMAC-SHA256 протокола</strong>
                    <br />
                    Настройки → Специальные → Remote → UDP Commands Pass
                  </div>
                </div>
              </div>

              {/* Дополнительные опции */}
              <div className={styles.optionsSection}>
                <div className={styles.optionCard}>
                  <div className={styles.optionHeader}>
                    <label className={styles.modernCheckbox}>
                      <input
                        type="checkbox"
                        checked={formData.is_localhost === true}
                        onChange={(e) => setFormData({ ...formData, is_localhost: e.target.checked })}
                      />
                      <span className={styles.checkboxCustom}></span>
                      <span className={styles.checkboxLabel}>
                        <span className={styles.labelIcon}>🏠</span>
                        Localhost соединение
                      </span>
                    </label>
                  </div>
                  <div className={styles.optionDescription}>
                    Разрешает подключение к MoonBot на том же сервере (127.0.0.1).
                    <br />
                    <span className={styles.warningText}>⚠️ По умолчанию отключено для защиты от SSRF атак</span>
                  </div>
                </div>
              </div>

              {/* Кнопки действий */}
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={handleCloseModal}>
                  <span>✕</span>
                  Отмена
                </button>
                <button type="submit" className={styles.saveBtn}>
                  <span>{editingServer ? '💾' : '➕'}</span>
                  {editingServer ? 'Сохранить изменения' : 'Добавить сервер'}
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

