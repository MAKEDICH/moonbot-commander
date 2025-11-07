// Единая функция для получения базового URL API
export const getApiBaseUrl = () => {
  // Если задана переменная окружения - используем её
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // В development режиме Vite использует proxy
  if (import.meta.env.DEV) {
    return ''; // Используем Vite proxy для /api
  }
  
  // Production: используем текущий хост с портом 8000
  return `${window.location.protocol}//${window.location.hostname}:8000`;
};

