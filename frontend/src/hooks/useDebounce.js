import { useState, useEffect } from 'react';

/**
 * Hook для debounce значения
 * 
 * Debounce откладывает обновление значения до момента, когда
 * пользователь перестанет вводить текст на указанное время (delay).
 * Это критично для поиска и фильтрации - избегаем лишних API запросов!
 * 
 * @param {*} value - Значение которое нужно debounce
 * @param {number} delay - Задержка в миллисекундах (по умолчанию 500мс)
 * @returns {*} Debounced значение
 * 
 * @example
 * const [searchTerm, setSearchTerm] = useState('');
 * const debouncedSearchTerm = useDebounce(searchTerm, 500);
 * 
 * useEffect(() => {
 *   if (debouncedSearchTerm) {
 *     searchAPI(debouncedSearchTerm);  // Запрос только после 500мс паузы
 *   }
 * }, [debouncedSearchTerm]);
 */
function useDebounce(value, delay = 500) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Очищаем таймер при изменении value до истечения delay
    // 2. Компонент unmount (избегаем memory leaks)
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);  // Перезапускаем effect при изменении value или delay

  return debouncedValue;
}

export default useDebounce;

