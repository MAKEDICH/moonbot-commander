/**
 * Безопасная обертка для localStorage
 * 
 * РАЗМЫШЛЕНИЕ: localStorage может упасть в Safari Private Mode, iOS incognito,
 * при превышении квоты, или в iframe с другого домена.
 * Нужен fallback на in-memory хранилище.
 */

// In-memory fallback storage
const memoryStorage = new Map();

const safeStorage = {
  /**
   * Проверяет доступность localStorage
   */
  isAvailable() {
    try {
      const testKey = '__storage_test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      console.warn('[Storage] localStorage недоступен, используется fallback:', e.message);
      return false;
    }
  },

  /**
   * Безопасное получение значения
   */
  getItem(key) {
    try {
      if (this.isAvailable()) {
        return localStorage.getItem(key);
      }
      return memoryStorage.get(key) || null;
    } catch (e) {
      console.error('[Storage] Ошибка чтения:', e);
      return memoryStorage.get(key) || null;
    }
  },

  /**
   * Безопасное сохранение значения
   */
  setItem(key, value) {
    try {
      if (this.isAvailable()) {
        localStorage.setItem(key, value);
      }
      // Всегда сохраняем в memory storage как backup
      memoryStorage.set(key, value);
      return true;
    } catch (e) {
      // QuotaExceededError или SecurityError
      console.error('[Storage] Ошибка записи:', e);
      memoryStorage.set(key, value);
      return false;
    }
  },

  /**
   * Безопасное удаление значения
   */
  removeItem(key) {
    try {
      if (this.isAvailable()) {
        localStorage.removeItem(key);
      }
      memoryStorage.delete(key);
      return true;
    } catch (e) {
      console.error('[Storage] Ошибка удаления:', e);
      memoryStorage.delete(key);
      return false;
    }
  },

  /**
   * Очистка всех данных
   */
  clear() {
    try {
      if (this.isAvailable()) {
        localStorage.clear();
      }
      memoryStorage.clear();
      return true;
    } catch (e) {
      console.error('[Storage] Ошибка очистки:', e);
      memoryStorage.clear();
      return false;
    }
  }
};

export default safeStorage;

