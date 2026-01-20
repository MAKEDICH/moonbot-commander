/**
 * Под-компоненты для страницы DataBackup.
 * 
 * Содержит:
 * - ExportSection - секция экспорта данных
 * - ImportSection - секция импорта данных
 * - BackupsSection - секция локальных бэкапов
 */

import React from 'react';
import { motion } from 'framer-motion';
import { formatServerDateTime } from '../utils/dateUtils';
import { 
  FiDownload, 
  FiUpload,
  FiLock,
  FiUnlock,
  FiCheck, 
  FiInfo,
  FiDatabase,
  FiClock,
  FiRotateCcw,
  FiEye,
  FiEyeOff,
  FiPackage,
  FiFile
} from 'react-icons/fi';
import styles from './DataBackup.module.css';

/**
 * Секция экспорта данных
 */
export const ExportSection = ({
  preview,
  includeOrders,
  setIncludeOrders,
  includeCharts,
  setIncludeCharts,
  includeLogs,
  setIncludeLogs,
  exportPassword,
  setExportPassword,
  exportPasswordConfirm,
  setExportPasswordConfirm,
  showExportPassword,
  setShowExportPassword,
  exporting,
  handleExport
}) => {
  return (
    <motion.div 
      className={styles.card}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className={styles.cardHeader}>
        <div className={styles.cardIcon}>
          <FiDownload />
        </div>
        <div>
          <h2 className={styles.cardTitle}>Экспорт данных</h2>
          <p className={styles.cardSubtitle}>Создать зашифрованную копию</p>
        </div>
      </div>

      <div className={styles.cardContent}>
        {/* Превью данных */}
        {preview && preview.tables && (
          <div className={styles.previewSection}>
            <h3 className={styles.sectionTitle}>
              <FiDatabase />
              Данные для экспорта
            </h3>
            <div className={styles.previewGrid}>
              {Object.entries(preview.tables).map(([table, count]) => (
                <div key={table} className={styles.previewItem}>
                  <span className={styles.previewTable}>{table}</span>
                  <span className={styles.previewCount}>{count}</span>
                </div>
              ))}
            </div>
            <div className={styles.previewTotal}>
              Всего записей: <strong>{preview.total_records}</strong>
            </div>
          </div>
        )}

        {/* Опции экспорта */}
        <div className={styles.optionsSection}>
          <h3 className={styles.sectionTitle}>
            <FiPackage />
            Опции
          </h3>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={includeOrders}
              onChange={(e) => setIncludeOrders(e.target.checked)}
            />
            <span>Включить историю ордеров</span>
          </label>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={includeCharts}
              onChange={(e) => setIncludeCharts(e.target.checked)}
            />
            <span>Включить графики</span>
          </label>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={includeLogs}
              onChange={(e) => setIncludeLogs(e.target.checked)}
            />
            <span>Включить логи команд</span>
          </label>
        </div>

        {/* Пароль */}
        <div className={styles.passwordSection}>
          <h3 className={styles.sectionTitle}>
            <FiLock />
            Пароль шифрования
          </h3>
          <p className={styles.passwordHint}>
            Этот пароль потребуется для расшифровки файла
          </p>
          <div className={styles.passwordInput}>
            <input
              type={showExportPassword ? 'text' : 'password'}
              value={exportPassword}
              onChange={(e) => setExportPassword(e.target.value)}
              placeholder="Введите пароль"
            />
            <button 
              type="button"
              onClick={() => setShowExportPassword(!showExportPassword)}
            >
              {showExportPassword ? <FiEyeOff /> : <FiEye />}
            </button>
          </div>
          <div className={styles.passwordInput}>
            <input
              type={showExportPassword ? 'text' : 'password'}
              value={exportPasswordConfirm}
              onChange={(e) => setExportPasswordConfirm(e.target.value)}
              placeholder="Подтвердите пароль"
            />
          </div>
        </div>

        <button
          className={styles.primaryButton}
          onClick={handleExport}
          disabled={exporting || !exportPassword || exportPassword !== exportPasswordConfirm}
        >
          {exporting ? (
            <>
              <FiDownload className={styles.spinner} />
              Экспортирую...
            </>
          ) : (
            <>
              <FiDownload />
              Экспортировать
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
};

/**
 * Секция импорта данных
 */
export const ImportSection = ({
  fileInputRef,
  importFile,
  importPassword,
  setImportPassword,
  showImportPassword,
  setShowImportPassword,
  importMode,
  setImportMode,
  importing,
  validationResult,
  validating,
  handleFileSelect,
  handleValidate,
  handleImport,
  formatSize
}) => {
  return (
    <motion.div 
      className={styles.card}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      <div className={styles.cardHeader}>
        <div className={styles.cardIcon}>
          <FiUpload />
        </div>
        <div>
          <h2 className={styles.cardTitle}>Импорт данных</h2>
          <p className={styles.cardSubtitle}>Восстановить из файла</p>
        </div>
      </div>

      <div className={styles.cardContent}>
        {/* Выбор файла */}
        <div className={styles.fileSection}>
          <h3 className={styles.sectionTitle}>
            <FiFile />
            Файл импорта
          </h3>
          <div 
            className={styles.dropZone}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".mbc"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            {importFile ? (
              <div className={styles.selectedFile}>
                <FiFile />
                <span>{importFile.name}</span>
                <span className={styles.fileSize}>
                  {formatSize(importFile.size)}
                </span>
              </div>
            ) : (
              <div className={styles.dropZoneContent}>
                <FiUpload size={32} />
                <span>Нажмите для выбора файла .mbc</span>
              </div>
            )}
          </div>
        </div>

        {/* Пароль */}
        <div className={styles.passwordSection}>
          <h3 className={styles.sectionTitle}>
            <FiUnlock />
            Пароль расшифровки
          </h3>
          <div className={styles.passwordInput}>
            <input
              type={showImportPassword ? 'text' : 'password'}
              value={importPassword}
              onChange={(e) => setImportPassword(e.target.value)}
              placeholder="Введите пароль от файла"
            />
            <button 
              type="button"
              onClick={() => setShowImportPassword(!showImportPassword)}
            >
              {showImportPassword ? <FiEyeOff /> : <FiEye />}
            </button>
          </div>
        </div>

        {/* Кнопка валидации */}
        <button
          className={styles.secondaryButton}
          onClick={handleValidate}
          disabled={validating || !importFile || !importPassword}
        >
          {validating ? (
            <>
              <FiCheck className={styles.spinner} />
              Проверяю...
            </>
          ) : (
            <>
              <FiCheck />
              Проверить файл
            </>
          )}
        </button>

        {/* Результат валидации */}
        {validationResult && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className={styles.validationResult}
          >
            <h3 className={styles.sectionTitle}>
              <FiInfo />
              Содержимое файла
            </h3>
            <div className={styles.validationInfo}>
              <div className={styles.validationRow}>
                <span>Версия:</span>
                <span>{validationResult.app_version}</span>
              </div>
              <div className={styles.validationRow}>
                <span>Создан:</span>
                <span>{formatServerDateTime(validationResult.created_at)}</span>
              </div>
            </div>
            <div className={styles.previewGrid}>
              {Object.entries(validationResult.tables || {}).map(([table, count]) => (
                <div key={table} className={styles.previewItem}>
                  <span className={styles.previewTable}>{table}</span>
                  <span className={styles.previewCount}>{count}</span>
                </div>
              ))}
            </div>

            {/* Режим импорта */}
            <div className={styles.modeSection}>
              <h4>Режим импорта:</h4>
              <div className={styles.modeOptions}>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="importMode"
                    value="merge"
                    checked={importMode === 'merge'}
                    onChange={(e) => setImportMode(e.target.value)}
                  />
                  <span>Объединить</span>
                  <small>Обновить существующие, добавить новые</small>
                </label>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="importMode"
                    value="skip"
                    checked={importMode === 'skip'}
                    onChange={(e) => setImportMode(e.target.value)}
                  />
                  <span>Добавить</span>
                  <small>Только новые записи</small>
                </label>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="importMode"
                    value="replace"
                    checked={importMode === 'replace'}
                    onChange={(e) => setImportMode(e.target.value)}
                  />
                  <span>Заменить</span>
                  <small>Перезаписать все данные</small>
                </label>
              </div>
            </div>

            <button
              className={styles.primaryButton}
              onClick={handleImport}
              disabled={importing}
            >
              {importing ? (
                <>
                  <FiUpload className={styles.spinner} />
                  Импортирую...
                </>
              ) : (
                <>
                  <FiUpload />
                  Импортировать
                </>
              )}
            </button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

/**
 * Секция локальных бэкапов
 */
export const BackupsSection = ({
  backups,
  handleRestore,
  formatSize,
  formatDate
}) => {
  if (backups.length === 0) return null;
  
  return (
    <motion.div 
      className={styles.backupsCard}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <div className={styles.cardHeader}>
        <div className={styles.cardIcon}>
          <FiClock />
        </div>
        <div>
          <h2 className={styles.cardTitle}>Локальные бэкапы</h2>
          <p className={styles.cardSubtitle}>
            Автоматические копии перед импортом
          </p>
        </div>
      </div>

      <div className={styles.backupsList}>
        {backups.slice(0, 5).map((backup) => (
          <div key={backup.path} className={styles.backupItem}>
            <div className={styles.backupInfo}>
              <FiDatabase />
              <div>
                <span className={styles.backupName}>{backup.name}</span>
                <span className={styles.backupMeta}>
                  {formatDate(backup.created)} • {formatSize(backup.size)}
                </span>
              </div>
            </div>
            <button
              className={styles.restoreButton}
              onClick={() => handleRestore(backup.path)}
              title="Восстановить"
            >
              <FiRotateCcw />
            </button>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

/**
 * Информационная секция
 */
export const InfoSection = () => {
  return (
    <motion.div 
      className={styles.infoCard}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.3 }}
    >
      <FiInfo />
      <div>
        <h3>Как это работает</h3>
        <ul>
          <li>
            <strong>Экспорт</strong> создаёт зашифрованный файл .mbc со всеми вашими данными
          </li>
          <li>
            <strong>Шифрование</strong> использует AES-256-GCM с вашим паролем
          </li>
          <li>
            <strong>Импорт</strong> возможен только с правильным паролем
          </li>
          <li>
            Перед импортом автоматически создаётся бэкап текущих данных
          </li>
        </ul>
      </div>
    </motion.div>
  );
};


