import React, { useState, useEffect, lazy, Suspense } from 'react';
import { FiSend, FiServer, FiSearch, FiCheckSquare, FiSquare, FiMinusSquare, FiSettings } from 'react-icons/fi';
import { serversAPI, commandsAPI, groupsAPI } from '../api/api';
import styles from './Commands.module.css';

// Lazy loading для тяжелой страницы StrategyCommander
const StrategyCommander = lazy(() => import('./StrategyCommander'));

// Список команд MoonBot - ПОЛНЫЙ СПИСОК
const MOONBOT_COMMANDS = [
  // Основные
  { cmd: 'START', desc: 'Запустить бота, запустить стратегии' },
  { cmd: 'STOP', desc: 'Остановить бота (не покупать новые)' },
  { cmd: 'list', desc: 'Список активных ордеров' },
  { cmd: 'lst', desc: 'Короткий формат списка' },
  
  // Покупка/продажа
  { cmd: 'buy ...', desc: 'Стандартные правила для сигналов на покупку' },
  { cmd: 'short ...', desc: 'Стандартные правила для сигналов на шорт (фьючерсы)' },
  { cmd: 'sell BTC', desc: 'Паник селл на монете (пример: BTC)' },
  { cmd: 'SellALL', desc: 'Паник селл НА ВСЕХ ордерах + стоп бота' },
  { cmd: 'SellPiece ALL', desc: 'Продать по кусочку от каждого ордера' },
  { cmd: 'CancelBuy', desc: 'Отменить все неисполненные BUY ордера' },
  
  // Уведомления
  { cmd: 'silent', desc: 'Отключить уведомления о сделках' },
  { cmd: 'talk', desc: 'Включить уведомления о сделках' },
  
  // Черный список
  { cmd: 'BL', desc: 'Показать черный список монет' },
  { cmd: 'BL + BTC', desc: 'Добавить монету в ЧС (пример: BTC)' },
  { cmd: 'BL - BTC', desc: 'Убрать монету из ЧС (пример: BTC)' },
  { cmd: 'TempBL +24 BTC ETH', desc: 'Временный ЧС на N часов' },
  
  // Сброс
  { cmd: 'ResetSession ALL', desc: 'Сбросить сессии на всех рынках' },
  { cmd: 'ResetSession BTC', desc: 'Сбросить сессии на монете' },
  { cmd: 'ResetLoss', desc: 'Сбросить счетчик профита' },
  
  // Плечо и маржа
  { cmd: 'Leverage 10 BTC,ETH', desc: 'Поменять плечо на монетах' },
  { cmd: 'Margin ALL ISO', desc: 'Поменять маржу на маркетах (ISO/Cross)' },
  
  // Отчеты
  { cmd: 'report', desc: 'Отчет за сегодня' },
  { cmd: 'report 7 days', desc: 'Отчет за 7 дней' },
  { cmd: 'report 2 weeks', desc: 'Отчет за 2 недели' },
  { cmd: 'report 7 days BTC', desc: 'Отчет за 7 дней по монете' },
  
  // Утилиты
  { cmd: 'ConvertBNB', desc: 'Конвертировать пыль в BNB' },
  { cmd: 'DoUpdate', desc: 'Обновить версию бота' },
  
  // Стратегии (новые команды)
  { cmd: 'GetStrategiesFull', desc: 'Выслать все стратегии' },
  { cmd: 'GetStrategiesActive', desc: 'Выслать только активные стратегии' },
];

// Команды требующие конструктора
const CONSTRUCTOR_COMMANDS = [
  {
    id: 'SetParam',
    name: 'SetParam',
    desc: 'Поменять параметр в стратегии',
    fields: [
      { name: 'strategy', label: 'Strategy', placeholder: 'Название стратегии' },
      { name: 'param', label: 'Param', placeholder: 'Название параметра' },
      { name: 'value', label: 'Value', placeholder: 'Значение (empty для пустой строки)' }
    ]
  },
  {
    id: 'SetBL+',
    name: 'SetBL+',
    desc: 'Добавить монету в ЧС стратегии',
    fields: [
      { name: 'strategy', label: 'Strategy', placeholder: 'Название стратегии' },
      { name: 'coin', label: 'Coin', placeholder: 'Монета (BTC, ETH...)' }
    ]
  },
  {
    id: 'SetBL-',
    name: 'SetBL-',
    desc: 'Убрать монету из ЧС стратегии',
    fields: [
      { name: 'strategy', label: 'Strategy', placeholder: 'Название стратегии' },
      { name: 'coin', label: 'Coin', placeholder: 'Монета (BTC, ETH...)' }
    ]
  },
  {
    id: 'SetWL+',
    name: 'SetWL+',
    desc: 'Добавить монету в БС стратегии',
    fields: [
      { name: 'strategy', label: 'Strategy', placeholder: 'Название стратегии' },
      { name: 'coin', label: 'Coin', placeholder: 'Монета (BTC, ETH...)' }
    ]
  },
  {
    id: 'SetWL-',
    name: 'SetWL-',
    desc: 'Убрать монету из БС стратегии',
    fields: [
      { name: 'strategy', label: 'Strategy', placeholder: 'Название стратегии' },
      { name: 'coin', label: 'Coin', placeholder: 'Монета (BTC, ETH...)' }
    ]
  },
  {
    id: 'sgStart',
    name: 'sgStart',
    desc: 'Запустить стратегию',
    fields: [
      { name: 'strategy', label: 'Strategy', placeholder: 'Название стратегии' },
      { name: 'time', label: 'Time (мин)', placeholder: 'Время в минутах (опционально)', optional: true }
    ]
  },
  {
    id: 'sgStop',
    name: 'sgStop',
    desc: 'Остановить стратегию',
    fields: [
      { name: 'strategy', label: 'Strategy', placeholder: 'Название стратегии' },
      { name: 'time', label: 'Time (мин)', placeholder: 'Время в минутах (опционально)', optional: true }
    ]
  },
  {
    id: 'Leverage',
    name: 'Leverage',
    desc: 'Поменять плечо на монетах',
    fields: [
      { name: 'x', label: 'X', placeholder: 'Плечо (например: 10)' },
      { name: 'coins', label: 'Coins', placeholder: 'Монеты через запятую (BTC,ETH)' }
    ]
  },
  {
    id: 'Margin',
    name: 'Margin',
    desc: 'Поменять маржу на маркетах',
    fields: [
      { name: 'coins', label: 'Coins', placeholder: 'Монеты или ALL' },
      { name: 'type', label: 'Type', placeholder: 'ISO или Cross' }
    ]
  },
  {
    id: 'TempBL',
    name: 'TempBL',
    desc: 'Временный ЧС на N часов',
    fields: [
      { name: 'hours', label: 'Hours', placeholder: 'Часы (например: 24)' },
      { name: 'coins', label: 'Coins', placeholder: 'Монеты через пробел (BTC ETH)' }
    ]
  },
  {
    id: 'sell',
    name: 'sell',
    desc: 'Паник селл на монете',
    fields: [
      { name: 'coin', label: 'Coin', placeholder: 'Монета (BTC, ETH...)' }
    ]
  },
  {
    id: 'SellPiece',
    name: 'SellPiece',
    desc: 'Продать по кусочку от ордера',
    fields: [
      { name: 'coin', label: 'Coin', placeholder: 'Монета или ALL' }
    ]
  },
  {
    id: 'ResetSession',
    name: 'ResetSession',
    desc: 'Сбросить сессии',
    fields: [
      { name: 'coin', label: 'Coin', placeholder: 'Монета или ALL' }
    ]
  },
  {
    id: 'report',
    name: 'report',
    desc: 'Отчет',
    fields: [
      { name: 'period', label: 'Period', placeholder: '7 days / 2 weeks (опционально)', optional: true },
      { name: 'coin', label: 'Coin', placeholder: 'Монета (опционально)', optional: true },
      { name: 'hide', label: 'Hide', placeholder: 'hide (опционально)', optional: true }
    ]
  },
];

const Commands = () => {
  const [servers, setServers] = useState([]);
  const [selectedServers, setSelectedServers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [commands, setCommands] = useState(''); // Изменено на множественное
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [timeout, setTimeout] = useState(5);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('all');
  
  // Новое состояние для botname
  const [useBotname, setUseBotname] = useState(false);
  
  // Состояния конструктора
  const [selectedConstructor, setSelectedConstructor] = useState(null);
  const [constructorValues, setConstructorValues] = useState({});

  // Состояние для переключения на StrategyCommander
  const [showStrategyCommander, setShowStrategyCommander] = useState(false);

  useEffect(() => {
    loadServers();
    loadGroups();
  }, []);

  const loadServers = async () => {
    try {
      const response = await serversAPI.getAll();
      const activeServers = response.data.filter(s => s.is_active);
      setServers(activeServers);
    } catch (error) {
      console.error('Error loading servers:', error);
    }
  };

  const loadGroups = async () => {
    try {
      const response = await groupsAPI.getAll();
      setGroups(response.data.groups || []);
    } catch (error) {
      console.error('Error loading groups:', error);
    }
  };

  // Фильтрация серверов по поиску и группе
  const filteredServers = servers.filter(server => {
    const matchesSearch = 
      server.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      server.host.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (server.group_name && server.group_name.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesGroup = selectedGroup === 'all' || 
                        (!selectedGroup && !server.group_name) ||
                        (server.group_name && server.group_name.split(',').map(g => g.trim()).includes(selectedGroup));
    
    return matchesSearch && matchesGroup;
  });

  // ИСПРАВЛЕНО: Группировка серверов для отображения
  const groupedServers = () => {
    const grouped = {};
    
    filteredServers.forEach(server => {
      const groupName = server.group_name || '';
      if (!grouped[groupName]) {
        grouped[groupName] = [];
      }
      grouped[groupName].push(server);
    });
    
    return grouped;
  };

  const serversGrouped = groupedServers();
  const groupNames = Object.keys(serversGrouped).sort((a, b) => {
    if (a === '') return -1; // "БЕЗ ГРУППЫ" первым
    if (b === '') return 1;
    return a.localeCompare(b);
  });

  // Проверка выбора всех серверов группы
  const isGroupFullySelected = (groupName) => {
    const groupServers = serversGrouped[groupName] || [];
    return groupServers.length > 0 && groupServers.every(s => selectedServers.includes(s.id));
  };

  const isGroupPartiallySelected = (groupName) => {
    const groupServers = serversGrouped[groupName] || [];
    return groupServers.some(s => selectedServers.includes(s.id)) && !isGroupFullySelected(groupName);
  };

  // Переключение выбора всех серверов группы
  const toggleGroupServersSelection = (groupName) => {
    const groupServers = serversGrouped[groupName] || [];
    const groupServerIds = groupServers.map(s => s.id);
    
    if (isGroupFullySelected(groupName)) {
      setSelectedServers(prev => prev.filter(id => !groupServerIds.includes(id)));
    } else {
      setSelectedServers(prev => [...new Set([...prev, ...groupServerIds])]);
    }
  };

  // Переключение выбора одного сервера
  const toggleServerSelection = (serverId) => {
    setSelectedServers(prev => {
      if (prev.includes(serverId)) {
        return prev.filter(id => id !== serverId);
      } else {
        return [...prev, serverId];
      }
    });
  };

  // Выбрать все отфильтрованные серверы
  const selectAll = () => {
    const allIds = filteredServers.map(s => s.id);
    setSelectedServers(allIds);
  };

  // Снять выбор со всех
  const deselectAll = () => {
    setSelectedServers([]);
  };

  // ИСПРАВЛЕНО: Функция для выбора/снятия выбора всех серверов группы по чекбоксу
  const toggleGroupSelection = (groupValue) => {
    let groupServers;
    
    if (groupValue === 'all') {
      // Все сервера
      groupServers = servers.map(s => s.id);
    } else if (groupValue === '') {
      // Без группы
      groupServers = servers.filter(s => !s.group_name).map(s => s.id);
    } else {
      // Конкретная группа
      groupServers = servers.filter(s => 
        s.group_name && s.group_name.split(',').map(g => g.trim()).includes(groupValue)
      ).map(s => s.id);
    }
    
    // Проверяем, все ли сервера этой группы уже выбраны
    const allSelected = groupServers.every(id => selectedServers.includes(id));
    
    if (allSelected) {
      // Снять выбор с этой группы
      setSelectedServers(prev => prev.filter(id => !groupServers.includes(id)));
    } else {
      // Выбрать все сервера этой группы
      setSelectedServers(prev => [...new Set([...prev, ...groupServers])]);
    }
  };

  // Обработчик конструктора команд
  const handleConstructorSelect = (constructor) => {
    setSelectedConstructor(constructor);
    setConstructorValues({});
  };

  const handleConstructorValueChange = (fieldName, value) => {
    setConstructorValues(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  const buildCommandFromConstructor = () => {
    if (!selectedConstructor) return;

    // Собираем команду из значений
    const parts = [selectedConstructor.name];
    
    selectedConstructor.fields.forEach(field => {
      const value = constructorValues[field.name];
      if (value || !field.optional) {
        parts.push(value || '');
      }
    });

    const newCommand = parts.join(' ').trim();
    
    // Добавляем команду в textarea
    if (commands.trim()) {
      setCommands(commands + '\n' + newCommand);
    } else {
      setCommands(newCommand);
    }

    // Очищаем конструктор
    setConstructorValues({});
  };

  const handleSendCommand = async (e) => {
    e.preventDefault();
    if (selectedServers.length === 0 || !commands.trim()) return;

    setLoading(true);
    setResponse(null);

    try {
      // Разбиваем команды по строкам
      const commandList = commands.split('\n')
        .map(cmd => cmd.trim())
        .filter(cmd => cmd.length > 0);

      if (commandList.length === 0) {
        throw new Error('Нет команд для отправки');
      }

      // Получаем данные выбранных серверов
      const selectedServersData = servers.filter(s => selectedServers.includes(s.id));

      const allResults = [];
      let totalSuccess = 0;
      let totalFailed = 0;

      // Для каждого сервера
      for (const server of selectedServersData) {
        // Для каждой команды
        for (const cmd of commandList) {
          try {
            // Формируем финальную команду с botname если нужно
            let finalCommand = cmd;
            if (useBotname && server.name) {
              finalCommand = `botname:${server.name} ${cmd}`;
            }

            const result = await commandsAPI.send({
              server_id: server.id,
              command: finalCommand,
              timeout: timeout
            });

            allResults.push({
              server_name: server.name,
              command: finalCommand,
              original_command: cmd,
              status: 'success',
              response: result.data.response
            });
            totalSuccess++;
          } catch (error) {
            allResults.push({
              server_name: server.name,
              command: useBotname ? `botname:${server.name} ${cmd}` : cmd,
              original_command: cmd,
              status: 'error',
              response: error.response?.data?.detail || 'Ошибка отправки'
            });
            totalFailed++;
          }
        }
      }

      setResponse({
        status: 'success',
        results: allResults,
        summary: {
          successful: totalSuccess,
          failed: totalFailed,
          total: allResults.length,
          servers: selectedServersData.length,
          commands: commandList.length
        },
        time: new Date().toLocaleString('ru-RU'),
        bulk: true
      });
      
    } catch (error) {
      setResponse({
        status: 'error',
        text: error.message || error.response?.data?.detail || 'Ошибка отправки команд',
        time: new Date().toLocaleString('ru-RU')
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* Условный рендеринг: показываем либо StrategyCommander, либо обычные команды */}
      {showStrategyCommander ? (
        <Suspense fallback={
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '10px' }}>⏳</div>
              <div style={{ fontSize: '18px' }}>Загрузка Strategy Commander...</div>
            </div>
          </div>
        }>
          <StrategyCommander onClose={() => setShowStrategyCommander(false)} />
        </Suspense>
      ) : (
        <>
          <div className={styles.header}>
            <FiSend className={styles.icon} />
            <h1>Отправка команд</h1>
            <button 
              className={styles.strategyCommanderButton}
              onClick={() => setShowStrategyCommander(true)}
              title="Открыть MoonBot Commander Pro"
            >
              <FiSettings /> Strategy Commander
            </button>
          </div>

      <div className={styles.content}>
        {/* Левая панель - Выбор серверов */}
        <div className={styles.serversPanel}>
          <div className={styles.serversPanelHeader}>
            <h3>
              <FiServer /> Выбор серверов
            </h3>
            <div className={styles.selectionInfo}>
              Выбрано: {selectedServers.length} из {filteredServers.length}
            </div>
          </div>

          {/* Поиск */}
          <div className={styles.searchBox}>
            <FiSearch className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Поиск по имени, IP, группе..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          {/* Фильтр по группам */}
          {groups.length > 0 && (
            <div className={styles.groupFilter}>
              <label className={styles.groupFilterLabel}>Группы:</label>
              <div className={styles.groupsList}>
                {/* Все группы */}
                <div 
                  className={`${styles.groupItem} ${selectedGroup === 'all' ? styles.activeGroup : ''}`}
                >
                  <div 
                    className={styles.groupCheckbox}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleGroupSelection('all');
                    }}
                    title="Выбрать/снять выбор всех серверов"
                  >
                    {(() => {
                      const groupServers = servers.map(s => s.id);
                      const allSelected = groupServers.every(id => selectedServers.includes(id));
                      return allSelected ? (
                        <FiCheckSquare className={styles.checkboxChecked} />
                      ) : groupServers.some(id => selectedServers.includes(id)) ? (
                        <FiMinusSquare className={styles.checkboxPartial} />
                      ) : (
                        <FiSquare className={styles.checkboxUnchecked} />
                      );
                    })()}
                  </div>
                  <span onClick={() => setSelectedGroup('all')}>
                    Все группы
                  </span>
                </div>
                
                {/* БЕЗ ГРУППЫ */}
                <div 
                  className={`${styles.groupItem} ${selectedGroup === '' ? styles.activeGroup : ''}`}
                >
                  <div 
                    className={styles.groupCheckbox}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleGroupSelection('');
                    }}
                    title="Выбрать/снять выбор всех серверов БЕЗ ГРУППЫ"
                  >
                    {(() => {
                      const groupServers = servers.filter(s => !s.group_name).map(s => s.id);
                      const allSelected = groupServers.length > 0 && groupServers.every(id => selectedServers.includes(id));
                      return allSelected ? (
                        <FiCheckSquare className={styles.checkboxChecked} />
                      ) : groupServers.some(id => selectedServers.includes(id)) ? (
                        <FiMinusSquare className={styles.checkboxPartial} />
                      ) : (
                        <FiSquare className={styles.checkboxUnchecked} />
                      );
                    })()}
                  </div>
                  <span onClick={() => setSelectedGroup('')}>
                    БЕЗ ГРУППЫ ({servers.filter(s => !s.group_name).length})
                  </span>
                </div>
                
                {/* Остальные группы */}
                {groups.map(group => (
                  <div 
                    key={group}
                    className={`${styles.groupItem} ${selectedGroup === group ? styles.activeGroup : ''}`}
                  >
                    <div 
                      className={styles.groupCheckbox}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleGroupSelection(group);
                      }}
                      title={`Выбрать/снять выбор всех серверов группы "${group}"`}
                    >
                      {(() => {
                        const groupServers = servers.filter(s => s.group_name === group).map(s => s.id);
                        const allSelected = groupServers.length > 0 && groupServers.every(id => selectedServers.includes(id));
                        return allSelected ? (
                          <FiCheckSquare className={styles.checkboxChecked} />
                        ) : groupServers.some(id => selectedServers.includes(id)) ? (
                          <FiMinusSquare className={styles.checkboxPartial} />
                        ) : (
                          <FiSquare className={styles.checkboxUnchecked} />
                        );
                      })()}
                    </div>
                    <span onClick={() => setSelectedGroup(group)}>
                      {group} ({servers.filter(s => s.group_name === group).length})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Кнопки выбора */}
          <div className={styles.selectionButtons}>
            <button 
              onClick={selectAll} 
              className={styles.selectBtn}
              disabled={filteredServers.length === 0}
              title={
                selectedGroup === '' 
                  ? 'Выбрать все сервера БЕЗ ГРУППЫ' 
                  : selectedGroup === 'all'
                  ? 'Выбрать все сервера'
                  : `Выбрать все сервера из группы "${selectedGroup}"`
              }
            >
              {selectedGroup === '' && '☐ '}
              Выбрать все ({filteredServers.length})
              {selectedGroup === '' && ' БЕЗ ГРУППЫ'}
            </button>
            <button 
              onClick={deselectAll} 
              className={styles.deselectBtn}
              disabled={selectedServers.length === 0}
            >
              Снять выбор
            </button>
          </div>

          {/* Список серверов */}
          <div className={styles.serversList}>
            {filteredServers.length === 0 ? (
              <div className={styles.noServers}>
                {searchQuery ? 'Ничего не найдено' : 'Нет активных серверов'}
              </div>
            ) : (
              groupNames.map(groupName => {
                const groupServers = serversGrouped[groupName];
                const fullySelected = isGroupFullySelected(groupName);
                const partiallySelected = isGroupPartiallySelected(groupName);
                
                return (
                  <div key={groupName} className={styles.serverGroup}>
                    {/* Заголовок группы с чекбоксом */}
                    <div 
                      className={styles.groupHeader}
                      onClick={() => toggleGroupServersSelection(groupName)}
                    >
                      <div className={styles.groupCheckboxLarge}>
                        {fullySelected ? (
                          <FiCheckSquare className={styles.checkboxChecked} />
                        ) : partiallySelected ? (
                          <FiMinusSquare className={styles.checkboxPartial} />
                        ) : (
                          <FiSquare className={styles.checkboxUnchecked} />
                        )}
                      </div>
                      <div className={styles.groupTitle}>
                        {groupName === '' ? 'БЕЗ ГРУППЫ' : groupName}
                        <span className={styles.groupCount}>
                          ({selectedServers.filter(id => groupServers.find(s => s.id === id)).length}/{groupServers.length})
                        </span>
                      </div>
                    </div>
                    
                    {/* Серверы группы */}
                    <div className={styles.groupServers}>
                      {groupServers.map(server => (
                        <div 
                          key={server.id} 
                          className={`${styles.serverItem} ${selectedServers.includes(server.id) ? styles.selected : ''}`}
                          onClick={() => toggleServerSelection(server.id)}
                        >
                          <div className={styles.checkbox}>
                            {selectedServers.includes(server.id) ? (
                              <FiCheckSquare className={styles.checkboxChecked} />
                            ) : (
                              <FiSquare className={styles.checkboxUnchecked} />
                            )}
                          </div>
                          <div className={styles.serverInfo}>
                            <div className={styles.serverName}>{server.name}</div>
                            <div className={styles.serverDetails}>
                              {server.host}:{server.port}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Правая панель - Команды */}
        <div className={styles.commandPanel}>
          {/* Форма отправки */}
          <form onSubmit={handleSendCommand} className={styles.form}>
            <div className={styles.formGroup}>
              <label>
                Команды (каждая с новой строки)
                {selectedServers.length > 1 && commands.split('\n').filter(c => c.trim()).length > 1 && (
                  <span className={styles.commandsCount}>
                    {' '}• {selectedServers.length} серверов × {commands.split('\n').filter(c => c.trim()).length} команд = {selectedServers.length * commands.split('\n').filter(c => c.trim()).length} операций
                  </span>
                )}
              </label>
              <textarea
                value={commands}
                onChange={(e) => setCommands(e.target.value)}
                placeholder={'Введите команды (каждая с новой строки):\nlist\nSTOP\nreport'}
                className={styles.textarea}
                disabled={loading}
                rows={5}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Таймаут (секунды)</label>
              <input
                type="number"
                value={timeout}
                onChange={(e) => setTimeout(parseInt(e.target.value) || 5)}
                min="1"
                max="30"
                className={styles.input}
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              className={styles.sendButton}
              disabled={loading || selectedServers.length === 0 || !commands.trim()}
            >
              {loading ? 'Отправка...' : 
               (() => {
                 const cmdCount = commands.split('\n').filter(c => c.trim()).length;
                 const total = selectedServers.length * cmdCount;
                 if (selectedServers.length === 1 && cmdCount === 1) {
                   return 'Отправить команду';
                 } else if (selectedServers.length === 1) {
                   return `Отправить ${cmdCount} команд`;
                 } else if (cmdCount === 1) {
                   return `Отправить на ${selectedServers.length} серверов`;
                 } else {
                   return `Отправить (${total} операций)`;
                 }
               })()}
            </button>
          </form>

          {/* Конструктор команд */}
          <div className={styles.constructor}>
            <h4>🔧 Конструктор сложных команд:</h4>
            
            <div className={styles.constructorButtons}>
              {CONSTRUCTOR_COMMANDS.map((cmd) => (
                <button
                  key={cmd.id}
                  onClick={() => handleConstructorSelect(cmd)}
                  className={`${styles.constructorBtn} ${selectedConstructor?.id === cmd.id ? styles.active : ''}`}
                  disabled={loading}
                  title={cmd.desc}
                >
                  {cmd.name}
                </button>
              ))}
            </div>

            {selectedConstructor && (
              <div className={styles.constructorForm}>
                <div className={styles.constructorHeader}>
                  <strong>{selectedConstructor.name}</strong>
                  <span className={styles.constructorDesc}>{selectedConstructor.desc}</span>
                </div>

                <div className={styles.constructorFields}>
                  {selectedConstructor.fields.map((field) => (
                    <div key={field.name} className={styles.constructorField}>
                      <label>
                        {field.label}
                        {field.optional && <span className={styles.optional}> (опционально)</span>}
                      </label>
                      <input
                        type="text"
                        value={constructorValues[field.name] || ''}
                        onChange={(e) => handleConstructorValueChange(field.name, e.target.value)}
                        placeholder={field.placeholder}
                        className={styles.input}
                      />
                    </div>
                  ))}
                </div>

                <button
                  onClick={buildCommandFromConstructor}
                  className={styles.constructorAddBtn}
                  disabled={loading}
                >
                  ➕ Добавить команду
                </button>
              </div>
            )}
          </div>

          {/* Быстрые команды */}
          <div className={styles.quickCommands}>
            <h4>Быстрые команды:</h4>
            <div className={styles.commandButtons}>
              {MOONBOT_COMMANDS.map((cmd, index) => (
                <button
                  key={index}
                  onClick={() => {
                    // Если уже есть команды, добавляем с новой строки
                    if (commands.trim()) {
                      setCommands(commands + '\n' + cmd.cmd);
                    } else {
                      setCommands(cmd.cmd);
                    }
                  }}
                  className={styles.quickCommand}
                  title={cmd.desc}
                  disabled={loading}
                >
                  {cmd.cmd}
                </button>
              ))}
            </div>
          </div>

          {/* Ответ */}
          {response && (
            <div className={`${styles.response} ${styles[response.status]}`}>
              <div className={styles.responseHeader}>
                <strong>
                  {response.bulk ? 'Массовая отправка' : 
                   response.single ? `Ответ от ${response.serverName}` : 
                   'Результат'}
                </strong>
                <span className={styles.responseTime}>{response.time}</span>
              </div>

              {response.bulk && response.results ? (
                <>
                  {/* Сводка */}
                  <div className={styles.summary}>
                    <div>✓ Успешно: {response.summary.successful}</div>
                    <div>✗ Ошибок: {response.summary.failed}</div>
                    <div>Серверов: {response.summary.servers}</div>
                    <div>Команд: {response.summary.commands}</div>
                    <div>Всего: {response.summary.total}</div>
                  </div>

                  {/* Результаты по серверам и командам */}
                  <div className={styles.bulkResults}>
                    {response.results.map((result, index) => (
                      <div key={index} className={`${styles.bulkResult} ${styles[result.status]}`}>
                        <div className={styles.bulkResultHeader}>
                          <div>
                            <strong>{result.server_name}</strong>
                            <div className={styles.bulkResultCommand}>
                              <code>{result.command}</code>
                            </div>
                          </div>
                          <span className={styles.bulkResultStatus}>
                            {result.status === 'success' ? '✓' : '✗'}
                          </span>
                        </div>
                        <pre className={styles.bulkResultText}>{result.response}</pre>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <pre className={styles.responseText}>{response.text}</pre>
              )}
            </div>
          )}
        </div>
      </div>
        </>
      )}
    </div>
  );
};

export default Commands;
