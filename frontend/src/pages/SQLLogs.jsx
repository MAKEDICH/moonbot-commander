import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { FaDatabase, FaSearch, FaSync, FaFilter } from 'react-icons/fa';
import styles from './SQLLogs.module.css';
import { getApiBaseUrl } from '../utils/apiUrl';

const SQLLogs = ({ autoRefresh, setAutoRefresh }) => {
  const API_BASE_URL = getApiBaseUrl();
  const [servers, setServers] = useState([]);
  const [selectedServer, setSelectedServer] = useState('all'); // По умолчанию "Все сервера"
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [searchTerm, setSearchTerm] = useState('');
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
  }, []);

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
  }, [selectedServer, page, servers]);

  // Автообновление с использованием ref для предотвращения лишних пересозданий
  useEffect(() => {
    // Очищаем предыдущий интервал
    if (autoRefreshRef.current) {
      clearInterval(autoRefreshRef.current);
      autoRefreshRef.current = null;
    }

    // Создаем новый интервал если включено автообновление
    if (autoRefresh && selectedServer && servers.length > 0) {
      const doRefresh = async () => {
        await fetchLogs(selectedServer, page);
      };
      
      autoRefreshRef.current = setInterval(doRefresh, 5000);
    }

    // Cleanup при размонтировании
    return () => {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
      }
    };
  }, [autoRefresh, selectedServer, page, servers]);

  const fetchServers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/servers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // ЗАЩИТА: нормализуем к массиву если пришёл объект
      const serversData = Array.isArray(response.data) 
        ? response.data 
        : Object.values(response.data || {});
      
      setServers(serversData);
      
      // Если есть сохраненный выбор, используем его, иначе загружаем данные для "all"
      const savedServer = localStorage.getItem('sqllogs_selectedServer') || 'all';
      if (serversData.length > 0) {
        fetchLogs(savedServer);
      }
    } catch (error) {
      console.error('Error fetching servers:', error);
    }
  };

  const fetchLogs = async (serverId, pageNum = 1) => {
    if (!serverId) return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const offset = (pageNum - 1) * limit;
      
      if (serverId === 'all') {
        // Загрузка логов со всех серверов
        let allLogs = [];
        
        for (const server of servers) {
          try {
            const response = await axios.get(`${API_BASE_URL}/api/servers/${server.id}/sql-log?limit=1000&offset=0`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            
            // Добавляем server_name к каждому логу для отображения
            const logsWithServer = response.data.logs.map(log => ({ ...log, server_name: server.name }));
            allLogs = [...allLogs, ...logsWithServer];
          } catch (err) {
            console.error(`Error fetching logs from server ${server.id}:`, err);
          }
        }
        
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
    if (selectedServer === 'all') {
      alert('Выберите конкретный сервер для очистки логов');
      return;
    }

    const confirmed = window.confirm(
      '⚠️ ВНИМАНИЕ!\n\nВы действительно хотите удалить ВСЕ SQL логи для этого сервера?\n\nЭто действие нельзя отменить!'
    );

    if (!confirmed) return;

    try {
      const token = localStorage.getItem('token');
      const response = await axios.delete(
        `${API_BASE_URL}/api/servers/${selectedServer}/sql-log/clear`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      alert(`✅ Успешно удалено ${response.data.deleted_count} записей`);
      
      // Перезагружаем данные
      fetchLogs(selectedServer, 1);
      setPage(1);
    } catch (error) {
      console.error('Error clearing logs:', error);
      alert('❌ Ошибка при удалении логов');
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

  const filteredLogs = logs.filter(log => 
    log.sql_text.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.command_id.toString().includes(searchTerm)
  );

  const totalPages = Math.ceil(total / limit);

  const getSQLType = (sql) => {
    const lower = sql.toLowerCase().trim();
    if (lower.startsWith('update')) return 'UPDATE';
    if (lower.startsWith('insert')) return 'INSERT';
    if (lower.startsWith('delete')) return 'DELETE';
    if (lower.startsWith('select')) return 'SELECT';
    return 'OTHER';
  };

  const getSQLTypeClass = (type) => {
    switch(type) {
      case 'UPDATE': return styles.typeUpdate;
      case 'INSERT': return styles.typeInsert;
      case 'DELETE': return styles.typeDelete;
      case 'SELECT': return styles.typeSelect;
      default: return styles.typeOther;
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <FaDatabase className={styles.icon} />
          <h1>SQL Logs</h1>
          <span className={styles.badge}>{total} записей</span>
        </div>

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
            disabled={loading || selectedServer === 'all'}
            title={selectedServer === 'all' ? 'Выберите конкретный сервер' : 'Очистить все логи'}
          >
            🗑️ Очистить
          </button>
        </div>
      </div>

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
                        <span className={`${styles.sqlType} ${getSQLTypeClass(sqlType)}`}>
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

