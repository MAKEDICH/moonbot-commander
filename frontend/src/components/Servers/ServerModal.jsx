import React from 'react';
import styles from '../../pages/Servers.module.css';

/**
 * Модальное окно добавления/редактирования сервера
 */
const ServerModal = ({
  show,
  editingServer,
  formData,
  onFormChange,
  onSubmit,
  onClose
}) => {
  if (!show) return null;

  return (
    <div 
      className={styles.modal}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
          onClose();
        }
      }}
    >
      <div className={styles.modalContent}>
        <h2 className={styles.modalTitle}>
          {editingServer ? 'Редактировать сервер' : 'Добавить сервер'}
        </h2>
        
        <form onSubmit={onSubmit}>
          <div className={styles.formGroup}>
            <label>
              <span className={styles.labelIcon}>🖥️</span>
              Название сервера
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => onFormChange({ ...formData, name: e.target.value })}
              placeholder="Например: Главный сервер"
              required
              className={styles.modernInput}
            />
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>
                <span className={styles.labelIcon}>🌐</span>
                IP адрес
              </label>
              <input
                type="text"
                value={formData.host}
                onChange={(e) => onFormChange({ ...formData, host: e.target.value })}
                placeholder="127.0.0.1"
                required
                className={styles.modernInput}
              />
            </div>

            <div className={styles.formGroup}>
              <label>
                <span className={styles.labelIcon}>🔌</span>
                UDP порт
              </label>
              <input
                type="number"
                value={formData.port}
                onChange={(e) => onFormChange({ ...formData, port: e.target.value })}
                placeholder="5005"
                min="1"
                max="65535"
                required
                className={styles.modernInput}
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>
              <span className={styles.labelIcon}>🔐</span>
              UDP пароль
              <span className={styles.optionalBadge}>необязательно</span>
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => onFormChange({ ...formData, password: e.target.value })}
              placeholder="••••••••••"
              className={styles.modernInput}
            />
            <div className={styles.hint}>
              <span className={styles.hintIcon}>💡</span>
              <div className={styles.hintText}>
                <strong>Требуется для HMAC-SHA256 протокола</strong>
                <br />
                Настройки → Специальные → Remote → UDP Commands Pass
              </div>
            </div>
          </div>

          <div className={styles.optionsSection}>
            <div className={styles.optionCard}>
              <div className={styles.optionHeader}>
                <label className={styles.modernCheckbox}>
                  <input
                    type="checkbox"
                    checked={formData.is_localhost === true}
                    onChange={(e) => onFormChange({ ...formData, is_localhost: e.target.checked })}
                  />
                  <span className={styles.checkboxCustom}></span>
                  <span className={styles.checkboxLabel}>
                    <span className={styles.labelIcon}>🏠</span>
                    Localhost соединение
                  </span>
                </label>
              </div>
              <div className={styles.optionDescription}>
                Разрешает подключение к MoonBot на том же сервере (127.0.0.1).
                <br />
                <span className={styles.warningText}>⚠️ По умолчанию отключено для защиты от SSRF атак</span>
              </div>
            </div>
          </div>

          <div className={styles.modalActions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>
              <span>✕</span>
              Отмена
            </button>
            <button type="submit" className={styles.saveBtn}>
              <span>{editingServer ? '💾' : '➕'}</span>
              {editingServer ? 'Сохранить изменения' : 'Добавить сервер'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ServerModal;



