import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import { FaDatabase, FaSearch, FaSync, FaFilter } from 'react-icons/fa';
import styles from './SQLLogs.module.css';
import PageHeader from '../components/PageHeader';
import { getApiBaseUrl } from '../utils/apiUrl';
import { sqlLogsAPI } from '../api/api';
import wsService from '../services/websocket';
import { useNotification } from '../context/NotificationContext';
import { getSQLType, getSQLTypeClass } from './SQLLogsUtils';

const SQLLogs = ({ autoRefresh, setAutoRefresh, emulatorFilter, setEmulatorFilter, currencyFilter }) => {
  const API_BASE_URL = getApiBaseUrl();
  const { success, error: showError, confirm } = useNotification();
  const [servers, setServers] = useState([]);
  const [selectedServer, setSelectedServer] = useState('all'); // По умолчанию "Все сервера"
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [searchTerm, setSearchTerm] = useState('');
  // ИСПРАВЛЕНО: Добавлено недостающее состояние error
  const [error, setError] = useState(null);
  const autoRefreshRef = useRef(null);

  // Восстановление настроек из localStorage при загрузке
  useEffect(() => {
    const savedServer = localStorage.getItem('sqllogs_selectedServer');
    
    if (savedServer) {
      setSelectedServer(savedServer);
    }
    // autoRefresh больше не восстанавливаем здесь - он приходит из пропсов
  }, []);

  // Загрузка списка серверов
  useEffect(() => {
    fetchServers();
  }, [currencyFilter]);

  // Перезагрузка данных при возврате на вкладку
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && selectedServer) {
        // Вкладка стала активной - обновляем данные
        fetchLogs(selectedServer, page);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [selectedServer, page, servers, currencyFilter]);

  // WebSocket подключение (всегда активно для real-time обновлений)
  useEffect(() => {
    if (!selectedServer || servers.length === 0) {
      return;
    }

    // Подключаемся к WebSocket
    wsService.connect();

    // Подписываемся на события SQL логов
    const unsubscribe = wsService.on('sql_log', (data) => {
      console.log('[SQLLogs] WebSocket event received:', data);
      
      // Проверяем соответствует ли server_id выбранному серверу
      if (selectedServer === 'all' || Number(selectedServer) === data.server_id) {
        console.log('[SQLLogs] Refreshing logs due to WebSocket event');
        // Обновляем логи без изменения страницы
        fetchLogs(selectedServer, page);
      }
    });

    // Cleanup
    return () => {
      unsubscribe();
    };
  }, [selectedServer, page, servers.length, currencyFilter]);

  // Автообновление: Fallback polling если WebSocket не работает
  useEffect(() => {
    // Очищаем предыдущий интервал
    if (autoRefreshRef.current) {
      clearInterval(autoRefreshRef.current);
      autoRefreshRef.current = null;
    }

    if (!autoRefresh || !selectedServer || servers.length === 0) {
      return;
    }

    // Fallback: Polling каждые 30 секунд если WebSocket не подключен
    const checkInterval = setInterval(() => {
      if (!wsService.isConnected()) {
        console.log('[SQLLogs] WebSocket not connected, using polling fallback');
        fetchLogs(selectedServer, page);
      }
    }, 30000);

    // Cleanup
    return () => {
      if (checkInterval) {
        clearInterval(checkInterval);
      }
    };
  }, [autoRefresh, selectedServer, page, servers.length]);

  const fetchServers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/servers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // ЗАЩИТА: нормализуем к массиву если пришёл объект
      const allServersData = Array.isArray(response.data) 
        ? response.data 
        : Object.values(response.data || {});
      
      // Фильтруем серверы по валюте
      const serversData = currencyFilter === 'all' 
        ? allServersData 
        : allServersData.filter(server => server.default_currency === currencyFilter);
      
      setServers(serversData);
      
      // Если есть сохраненный выбор, используем его, иначе загружаем данные для "all"
      const savedServer = localStorage.getItem('sqllogs_selectedServer') || 'all';
      if (serversData.length > 0) {
        console.log('[SQLLogs] Initial load for server:', savedServer);
        // Передаем serversData напрямую, так как setServers обновляет state асинхронно
        fetchLogsWithServers(savedServer, serversData);
      }
    } catch (error) {
      console.error('Error fetching servers:', error);
    }
  };

  const fetchLogs = async (serverId, pageNum = 1) => {
    // Используем текущий state servers
    return fetchLogsWithServers(serverId, servers, pageNum);
  };

  const fetchLogsWithServers = async (serverId, serversArray, pageNum = 1) => {
    if (!serverId) return;
    
    console.log('[SQLLogs] fetchLogsWithServers called:', { serverId, serversCount: serversArray.length, pageNum });
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const offset = (pageNum - 1) * limit;
      
      if (serverId === 'all') {
        // Фильтруем серверы по выбранной валюте
        const filteredServers = currencyFilter === 'all' 
          ? serversArray 
          : serversArray.filter(server => server.default_currency === currencyFilter);
        
        if (filteredServers.length === 0) {
          setLogs([]);
          setTotal(0);
          setLoading(false);
          return;
        }
        
        // Загрузка логов со всех отфильтрованных серверов ПАРАЛЛЕЛЬНО (оптимизация)
        let allLogs = [];
        const MAX_LOGS_PER_SERVER = 100;
        
        // Создаем массив промисов для параллельной загрузки
        const fetchPromises = filteredServers.map(server =>
          axios.get(`${API_BASE_URL}/api/servers/${server.id}/sql-log?limit=${MAX_LOGS_PER_SERVER}&offset=0`, {
            headers: { Authorization: `Bearer ${token}` }
          })
            .then(response => {
              // Добавляем server_name к каждому логу для отображения
              return response.data.logs.map(log => ({ ...log, server_name: server.name }));
            })
            .catch(err => {
              console.error(`Error fetching logs from server ${server.id}:`, err);
              return []; // Возвращаем пустой массив при ошибке
            })
        );
        
        // Ждем завершения всех запросов параллельно
        const results = await Promise.all(fetchPromises);
        
        // Объединяем все результаты
        allLogs = results.flat();
        
        // Сортировка по дате (новые сверху)
        allLogs.sort((a, b) => new Date(b.received_at) - new Date(a.received_at));
        
        // Пагинация на клиенте
        const paginatedLogs = allLogs.slice(offset, offset + limit);
        
        setLogs(paginatedLogs);
        setTotal(allLogs.length);
        setPage(pageNum);
      } else {
        // Загрузка логов с конкретного сервера
        const response = await axios.get(
          `${API_BASE_URL}/api/servers/${serverId}/sql-log?limit=${limit}&offset=${offset}`,
          { headers: { Authorization: `Bearer ${token}` }}
        );
        
        setLogs(response.data.logs);
        setTotal(response.data.total);
        setPage(pageNum);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleServerChange = (serverId) => {
    setSelectedServer(serverId);
    localStorage.setItem('sqllogs_selectedServer', serverId); // Сохранение в localStorage
    setPage(1);
    fetchLogs(serverId, 1);
  };

  const handleRefresh = async () => {
    setLoading(true);
    
    // Отправляем команду lst через listener для получения свежих данных
    if (selectedServer && selectedServer !== 'all') {
      try {
        const token = localStorage.getItem('token');
        console.log(`Sending lst command to server ${selectedServer}...`);
        
        const response = await axios.post(
          `${API_BASE_URL}/api/servers/${selectedServer}/listener/send-command`,
          null,
          {
            params: { command: 'lst' },
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        console.log('Command lst sent successfully:', response.data);
        
        // Ждём 3 секунды чтобы listener получил и обработал ответ
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (error) {
        console.error('Error sending lst command:', error);
        setError('Не удалось отправить команду обновления');
      }
    } else if (selectedServer === 'all') {
      // Если выбраны все сервера - отправляем lst на все активные
      try {
        const token = localStorage.getItem('token');
        const serversToUpdate = servers.filter(s => s.is_active);
        
        console.log(`Sending lst to ${serversToUpdate.length} servers...`);
        
        const promises = serversToUpdate.map(server => 
          axios.post(
            `${API_BASE_URL}/api/servers/${server.id}/listener/send-command`,
            null,
            {
              params: { command: 'lst' },
              headers: { Authorization: `Bearer ${token}` }
            }
          ).catch(err => {
            console.error(`Failed to send lst to server ${server.id}:`, err);
            return null;
          })
        );
        
        await Promise.all(promises);
        console.log('Commands sent to all servers');
        
        // Ждём 3 секунды для обработки
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (error) {
        console.error('Error sending commands to all servers:', error);
      }
    }
    
    // Загружаем данные
    fetchLogs(selectedServer, page);
  };

  const handleClearLogs = async () => {
    const confirmed = await confirm({
      title: 'Удаление SQL логов',
      message: selectedServer === 'all'
        ? 'Вы действительно хотите удалить ВСЕ SQL логи со ВСЕХ серверов?\n\nЭто действие нельзя отменить!'
        : 'Вы действительно хотите удалить ВСЕ SQL логи для этого сервера?\n\nЭто действие нельзя отменить!',
      type: 'danger',
      confirmText: 'Удалить',
      cancelText: 'Отмена',
    });

    if (!confirmed) return;

    try {
      // Используем разные endpoints в зависимости от выбора
      if (selectedServer === 'all') {
        const response = await sqlLogsAPI.clearAll();
        success(`Успешно удалено ${response.data.deleted_count} записей со всех серверов`);
      } else {
        const response = await sqlLogsAPI.clearByServer(Number(selectedServer));
        success(`Успешно удалено ${response.data.deleted_count} записей`);
      }
      
      // Перезагружаем данные
      fetchLogs(selectedServer, 1);
      setPage(1);
    } catch (error) {
      console.error('Error clearing logs:', error);
      showError('Ошибка при удалении логов');
    }
  };

  const handlePageChange = (newPage) => {
    fetchLogs(selectedServer, newPage);
  };

  const handleAutoRefreshToggle = (e) => {
    const newValue = e.target.checked;
    setAutoRefresh(newValue);
    // Сохранение в localStorage теперь происходит в Trading.jsx
  };

  // ИСПРАВЛЕНО: Оптимизация фильтрации с помощью useMemo
  const filteredLogs = useMemo(() => {
    if (!searchTerm.trim()) return logs;
    
    const lowerSearch = searchTerm.toLowerCase();
    return logs.filter(log => 
      log.sql_text.toLowerCase().includes(lowerSearch) ||
      log.command_id.toString().includes(searchTerm)
    );
  }, [logs, searchTerm]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className={styles.container}>
      <PageHeader 
        icon={<FaDatabase />} 
        title="SQL Logs" 
        gradient="purple"
        badge={`${total} записей`}
      >
        <div className={styles.controls}>
          <div className={styles.serverSelect}>
            <label>Сервер:</label>
            <select 
              value={selectedServer} 
              onChange={(e) => handleServerChange(e.target.value)}
              className={styles.select}
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
                onChange={handleAutoRefreshToggle}
              />
              Автообновление
            </label>
          </div>

          <button 
            onClick={handleRefresh} 
            className={styles.refreshBtn}
            disabled={loading}
          >
            <FaSync className={loading ? styles.spinning : ''} />
            Обновить
          </button>

          <button 
            onClick={handleClearLogs} 
            className={styles.clearBtn}
            disabled={loading}
            title={selectedServer === 'all' ? 'Очистить логи со всех серверов' : 'Очистить все логи сервера'}
          >
            🗑️ Очистить
          </button>
        </div>
      </PageHeader>

      <div className={styles.searchBar}>
        <FaSearch className={styles.searchIcon} />
        <input
          type="text"
          placeholder="Поиск по тексту SQL или ID команды..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={styles.searchInput}
        />
      </div>

      {loading ? (
        <div className={styles.loading}>Загрузка...</div>
      ) : filteredLogs.length === 0 ? (
        <div className={styles.empty}>
          <FaDatabase size={48} />
          <p>SQL команд пока нет</p>
          <small>Listener будет сохранять команды автоматически</small>
        </div>
      ) : (
        <>
          <div className={styles.logsTable}>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Тип</th>
                  <th>SQL Команда</th>
                  <th>Время получения</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map(log => {
                  const sqlType = getSQLType(log.sql_text);
                  return (
                    <tr key={log.id}>
                      <td className={styles.commandId}>#{log.command_id}</td>
                      <td>
                        <span className={`${styles.sqlType} ${getSQLTypeClass(sqlType, styles)}`}>
                          {sqlType}
                        </span>
                      </td>
                      <td className={styles.sqlText}>
                        <code>{log.sql_text}</code>
                      </td>
                      <td className={styles.time}>
                        {new Date(log.received_at).toLocaleString('ru-RU')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button 
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
                className={styles.pageBtn}
              >
                ← Назад
              </button>
              
              <span className={styles.pageInfo}>
                Страница {page} из {totalPages}
              </span>
              
              <button 
                onClick={() => handlePageChange(page + 1)}
                disabled={page === totalPages}
                className={styles.pageBtn}
              >
                Вперед →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SQLLogs;

