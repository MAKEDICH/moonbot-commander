/**
 * Утилиты для Dashboard
 */

/**
 * Показывает системное уведомление
 */
export const showSystemNotification = (message, title = 'MoonBot Commander') => {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      body: message,
      icon: '/favicon.ico'
    });
  }
};

/**
 * Проигрывает звук уведомления
 */
export const playNotificationSound = (soundPath = '/notification.mp3') => {
  const audio = new Audio(soundPath);
  audio.play()
    .then(() => {
      audio.src = '';
      audio.remove();
    })
    .catch(() => {
      audio.src = '';
      audio.remove();
    });
};

/**
 * Запрашивает разрешение на показ уведомлений
 */
export const requestNotificationPermission = async () => {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
};

/**
 * Подсчитывает количество онлайн и оффлайн серверов
 */
export const countServersByStatus = (servers) => {
  const online = servers.filter(s => s.status?.is_online).length;
  const offline = servers.length - online;
  return { online, offline };
};



