import { useState, useEffect } from 'react';
import { serversAPI, serverStatusAPI, userSettingsAPI, apiErrorsAPI, groupsAPI } from '../../api/api';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../../context/NotificationContext';
import { useAutoPing } from '../../context/AutoPingContext';

/**
 * Хук для управления серверами
 * Автопроверка вынесена в глобальный контекст AutoPingContext
 */
const useServers = () => {
  const navigate = useNavigate();
  const { success, error: showError, confirm } = useNotification();
  
  // Используем глобальный контекст автопроверки
  const { 
    autoPingEnabled, 
    toggleAutoPing,
    isPinging,
    pingInterval,
    updatePingInterval
  } = useAutoPing();
  
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingServer, setEditingServer] = useState(null);
  const [testingServer, setTestingServer] = useState(null);
  const [testingServers, setTestingServers] = useState(new Set());
  const [listenerStatuses, setListenerStatuses] = useState({});
  const [actionLoading, setActionLoading] = useState({});
  const [availableGroups, setAvailableGroups] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('serversViewMode') || 'full';
  });
  const [localPingInterval, setLocalPingInterval] = useState(pingInterval);
  const [showPingSettings, setShowPingSettings] = useState(false);
  const [hideAddresses, setHideAddresses] = useState(() => {
    const saved = localStorage.getItem('serversHideAddresses');
    return saved === 'true';
  });
  const [errorsCount, setErrorsCount] = useState(0);
  
  const [formData, setFormData] = useState({
    name: '',
    host: '',
    port: '',
    password: '',
    description: '',
    group_name: '',
    keepalive_enabled: true,
    is_localhost: false
  });

  useEffect(() => {
    loadServers();
    loadGroups();
    loadErrorsCount();
  }, []);

  useEffect(() => {
    if (servers.length > 0) {
      servers.forEach(server => {
        loadListenerStatus(server.id);
      });
    }
  }, [servers.length]);

  // Периодическое обновление данных при активной автопроверке
  useEffect(() => {
    if (!autoPingEnabled) return;
    
    // Обновляем данные каждые 5 секунд когда автопроверка включена
    const refreshInterval = setInterval(() => {
      loadServers();
    }, 5000);
    
    return () => clearInterval(refreshInterval);
  }, [autoPingEnabled]);

  const handlePingIntervalChange = (value) => {
    setLocalPingInterval(value);
  };

  const savePingInterval = async () => {
    try {
      // Сохраняем на сервере
      await userSettingsAPI.update({ ping_interval: localPingInterval });
      // Обновляем глобальный интервал
      updatePingInterval(localPingInterval);
      setShowPingSettings(false);
      success('Интервал опроса сохранён');
    } catch (error) {
      console.error('Ошибка сохранения интервала:', error);
      setShowPingSettings(false);
    }
  };

  const loadServers = async () => {
    try {
      const response = await serverStatusAPI.getAllWithStatus();
      setServers(response.data);
    } catch (error) {
      console.error('Error loading servers:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadGroups = async () => {
    try {
      const response = await groupsAPI.getAll();
      const data = response.data;
      const emptyGroups = JSON.parse(localStorage.getItem('emptyGroups') || '[]');
      const allGroups = [...new Set([...data.groups, ...emptyGroups])];
      setAvailableGroups(allGroups);
    } catch (error) {
      console.error('Error loading groups:', error);
    }
  };

  const loadErrorsCount = async () => {
    try {
      const response = await apiErrorsAPI.getStats(24);
      // Используем количество непросмотренных ошибок для значка
      setErrorsCount(response.data.unviewed_count || 0);
    } catch (error) {
      console.error('Error loading API errors count:', error);
      setErrorsCount(0);
    }
  };

  const loadListenerStatus = async (serverId) => {
    try {
      const response = await serversAPI.listenerStatus(serverId);
      setListenerStatuses(prev => ({ ...prev, [serverId]: response.data }));
    } catch (error) {
      console.error(`Error loading listener status for server ${serverId}:`, error);
    }
  };

  const handleListenerStart = async (serverId) => {
    setActionLoading(prev => ({ ...prev, [`start-${serverId}`]: true }));
    try {
      await serversAPI.listenerStart(serverId);
      await loadListenerStatus(serverId);
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Ошибка запуска listener';
      showError(errorMsg);
    } finally {
      setActionLoading(prev => ({ ...prev, [`start-${serverId}`]: false }));
    }
  };

  const handleListenerStop = async (serverId) => {
    setActionLoading(prev => ({ ...prev, [`stop-${serverId}`]: true }));
    try {
      await serversAPI.listenerStop(serverId);
      await loadListenerStatus(serverId);
    } catch (error) {
      showError('Ошибка остановки listener');
    } finally {
      setActionLoading(prev => ({ ...prev, [`stop-${serverId}`]: false }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const dataToSend = {
        ...formData,
        group_name: selectedGroups.join(', ')
      };
      
      if (editingServer && !dataToSend.password) {
        delete dataToSend.password;
      }
      
      if (editingServer) {
        await serversAPI.update(editingServer.id, dataToSend);
      } else {
        await serversAPI.create(dataToSend);
      }
      await loadServers();
      await loadGroups();
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
      // Используем ping - он обновляет last_ping и is_online в БД
      const response = await serverStatusAPI.ping(id);
      if (response.data.is_online) {
        success('Сервер доступен!');
      } else {
        showError('Сервер недоступен');
      }
      // Перезагружаем серверы для обновления статусов на карточках
      await loadServers();
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
      password: server.password || '',
      description: server.description || '',
      group_name: server.group_name || '',
      keepalive_enabled: server.keepalive_enabled !== false,
      is_localhost: server.is_localhost || false
    });
    
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
    setFormData({ 
      name: '', 
      host: '', 
      port: '', 
      password: '', 
      description: '', 
      group_name: '', 
      keepalive_enabled: true, 
      is_localhost: false 
    });
  };

  const toggleViewMode = () => {
    const newMode = viewMode === 'full' ? 'compact' : 'full';
    setViewMode(newMode);
    localStorage.setItem('serversViewMode', newMode);
  };

  const toggleHideAddresses = () => {
    const newValue = !hideAddresses;
    setHideAddresses(newValue);
    localStorage.setItem('serversHideAddresses', newValue.toString());
  };

  return {
    servers,
    loading,
    showModal,
    setShowModal,
    editingServer,
    testingServer,
    testingServers,
    isPinging,
    listenerStatuses,
    actionLoading,
    viewMode,
    autoPingEnabled,
    pingInterval: localPingInterval,
    showPingSettings,
    setShowPingSettings,
    hideAddresses,
    errorsCount,
    formData,
    setFormData,
    navigate,
    handleSubmit,
    handleDelete,
    handleTest,
    handleEdit,
    handleCloseModal,
    handleListenerStart,
    handleListenerStop,
    toggleViewMode,
    toggleAutoPing,
    toggleHideAddresses,
    handlePingIntervalChange,
    savePingInterval
  };
};

export default useServers;



