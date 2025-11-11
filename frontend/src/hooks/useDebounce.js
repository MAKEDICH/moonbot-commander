import { useState, useEffect } from 'react';

/**
 * Hook для debounce значения
 * 
 * РАЗМЫШЛЕНИЕ: Debounce откладывает обновление значения до момента, когда
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
    // РАЗМЫШЛЕНИЕ: Создаем таймер который обновит значение через delay
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // РАЗМЫШЛЕНИЕ: Очищаем таймер если:
    // 1. value изменился до истечения delay (пользователь продолжает печатать)
    // 2. Компонент unmount (избегаем memory leaks)
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);  // Перезапускаем effect при изменении value или delay

  return debouncedValue;
}

export default useDebounce;

