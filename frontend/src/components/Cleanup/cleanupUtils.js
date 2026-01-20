/**
 * Утилиты для Cleanup
 */

/**
 * Форматирует байты в читаемый формат
 */
export const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
};

/**
 * Получает иконку для файла по типу
 */
export const getFileIcon = (key) => {
  const iconMap = {
    moonbot_db: '🗄️',
    commander_db: '🗄️',
    commander_log: '📝',
    crash_log: '⚠️',
    udp_log: '📝',
    moonbot_log: '📡',
    logs: '📊',
    'alembic.ini': '⚙️',
    '.env': '🔐'
  };
  
  if (iconMap[key]) return iconMap[key];
  if (key.endsWith('_log')) return '📝';
  return '📄';
};

/**
 * Получает отображаемое имя файла
 */
export const getDisplayName = (key) => {
  const nameMap = {
    moonbot_db: 'moonbot.db',
    commander_db: 'moonbot_commander.db',
    commander_log: 'moonbot_commander.log',
    crash_log: 'backend_crash.log',
    udp_log: 'udp_listener.log',
    moonbot_log: 'moonbot.log',
    logs: 'ОБЩИЙ РАЗМЕР ЛОГОВ',
    'alembic.ini': 'alembic.ini',
    '.env': '.env'
  };
  
  if (nameMap[key]) return nameMap[key];
  
  if (key.endsWith('_log')) {
    return key.replace('_log', '.log').replace(/_/g, '-');
  }
  
  return key.replace(/_/g, ' ');
};

/**
 * Определяет должен ли файл быть скрыт
 */
export const shouldHideFile = (key) => {
  return ['alembic.ini', '.env'].includes(key);
};

/**
 * Получает CSS класс для размера файла
 */
export const getSizeClass = (size, styles) => {
  if (size > 100 * 1024 * 1024) return styles.danger;
  if (size > 50 * 1024 * 1024) return styles.warning;
  return '';
};

/**
 * Получает CSS класс для заполнения диска
 */
export const getDiskPercentClass = (percent, styles) => {
  if (percent > 90) return styles.danger;
  if (percent > 80) return styles.warning;
  return styles.success;
};

/**
 * Сортирует файлы для отображения
 */
export const sortFiles = (files) => {
  const order = [
    'moonbot_db', 
    'commander_db', 
    'logs', 
    'moonbot_log', 
    'commander_log', 
    'crash_log', 
    'udp_log'
  ];
  
  return Object.entries(files).sort(([a], [b]) => {
    return order.indexOf(a) - order.indexOf(b);
  });
};

/**
 * Подсчитывает общий размер файлов
 */
export const calculateTotalSize = (files) => {
  return Object.entries(files)
    .filter(([key]) => !['alembic.ini', '.env', 'logs'].includes(key))
    .reduce((total, [, size]) => total + size, 0);
};



