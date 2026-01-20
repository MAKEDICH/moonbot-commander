/**
 * Модальные окна для ScheduledCommands
 */

import React from 'react';
import { FiX, FiCheck } from 'react-icons/fi';
import styles from '../../pages/ScheduledCommands.module.css';

/**
 * Модальное окно настроек/справки планировщика
 */
export function SettingsModal({ show, onClose }) {
  if (!show) return null;

  return (
    <div 
      className={styles.modalOverlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
          onClose();
        }
      }}
    >
      <div className={styles.modalContent}>
        <h2>⚙️ О работе планировщика</h2>
        
        <div className={styles.settingsSection}>
          <div className={styles.settingsInfo}>
            <div className={styles.controlInfo}>
              <h4>🎛️ Управление планировщиком:</h4>
              <p>
                Используйте <strong>переключатель</strong> в шапке страницы для включения/выключения планировщика.
              </p>
              <ul>
                <li>✅ <strong>Включен</strong> - планировщик активен, команды выполняются по расписанию</li>
                <li>⏸️ <strong>Выключен</strong> - планировщик приостановлен, команды не выполняются (но остаются в очереди)</li>
              </ul>
              <p className={styles.warningText}>
                ⚠️ При выключении планировщика все отложенные команды остаются в базе и будут выполнены после повторного включения, если их время еще не прошло.
              </p>
            </div>
            
            <h4>🧠 Умный режим работы:</h4>
            
            <div className={styles.smartModeInfo}>
              <div className={styles.modeStep}>
                <span className={styles.stepIcon}>💤</span>
                <div>
                  <strong>Режим ожидания</strong>
                  <p>Когда нет команд, планировщик проверяет базу данных раз в 5 секунд</p>
                </div>
              </div>
              
              <div className={styles.modeStep}>
                <span className={styles.stepIcon}>⏰</span>
                <div>
                  <strong>Обнаружение команды</strong>
                  <p>При появлении команды планировщик переходит в активный режим мониторинга</p>
                </div>
              </div>
              
              <div className={styles.modeStep}>
                <span className={styles.stepIcon}>⚡</span>
                <div>
                  <strong>Точное выполнение</strong>
                  <p>Каждые 0.5 секунды проверяет наступило ли точное время выполнения. Команда отправляется секунда в секунду с назначенным временем</p>
                </div>
              </div>
              
              <div className={styles.modeStep}>
                <span className={styles.stepIcon}>✅</span>
                <div>
                  <strong>После выполнения</strong>
                  <p>Сразу после выполнения команды проверяет следующую в очереди. Если её нет - возвращается в режим ожидания</p>
                </div>
              </div>
            </div>
            
            <div className={styles.benefitsBox}>
              <h4>💡 Преимущества:</h4>
              <ul>
                <li>⚡ <strong>Точность до секунды</strong> - команды выполняются ровно в назначенное время</li>
                <li>💾 <strong>Минимальная нагрузка</strong> - проверки раз в 5 секунд когда нет команд, раз в 0.5 секунды когда есть</li>
                <li>🔋 <strong>Экономия ресурсов</strong> - CPU и память не загружаются впустую</li>
                <li>🎯 <strong>Автоматическая оптимизация</strong> - автоматически переключается между режимами ожидания и активного мониторинга</li>
                <li>⏸️ <strong>Возможность паузы</strong> - можно временно приостановить выполнение команд</li>
              </ul>
            </div>
            
            <p className={styles.infoText}>
              📊 <strong>Пример:</strong> Если команда назначена на 15:30:00, планировщик начнет проверять время каждые 0.5 секунды. Как только наступит 15:30:00, команда выполнится мгновенно, после чего планировщик проверит следующую команду в очереди.
            </p>
          </div>
        </div>

        <div className={styles.modalActions}>
          <button 
            type="button" 
            onClick={onClose}
            className={styles.saveBtnModal}
          >
            <FiCheck /> Понятно
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Модальное окно сброса системы
 */
export function ResetModal({ show, loading, resetCode, onCodeChange, onReset, onClose }) {
  if (!show) return null;

  return (
    <div 
      className={styles.modalOverlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
          onClose();
        }
      }}
    >
      <div className={styles.modalContent}>
        <h2>⚠️ Системный сброс</h2>
        
        <div className={styles.formGroup}>
          <label>Введите код доступа:</label>
          <input
            type="text"
            value={resetCode}
            onChange={(e) => onCodeChange(e.target.value)}
            placeholder="Код доступа"
            autoFocus
            style={{
              color: '#000000',
              backgroundColor: '#ffffff',
              border: '2px solid #00f5ff',
              padding: '12px',
              fontSize: '16px',
              borderRadius: '8px'
            }}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                onReset();
              }
            }}
          />
        </div>

        <div className={styles.modalActions}>
          <button 
            type="button" 
            onClick={onReset}
            className={styles.deleteBtn}
            disabled={loading}
          >
            🗑️ {loading ? 'Выполняется...' : 'Сбросить систему'}
          </button>
          <button 
            type="button" 
            onClick={onClose}
            className={styles.cancelBtnModal}
          >
            <FiX /> Отмена
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Модальное окно помощи по пресетам
 */
export function PresetHelpModal({ show, onClose }) {
  if (!show) return null;

  return (
    <div className={styles.modal} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <button 
          className={styles.closeBtn}
          onClick={onClose}
        >
          <FiX />
        </button>

        <div className={styles.modalHeader}>
          <h2>📋 Как создать пресеты команд</h2>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.helpSection}>
            <h3>🎯 Что такое пресеты?</h3>
            <p>
              Пресеты — это сохранённые наборы команд, которые можно быстро загрузить одним кликом.
              Например: "Утренний рестарт", "Экстренная остановка", "Отчёт по всем ботам" и т.д.
            </p>
          </div>

          <div className={styles.helpSection}>
            <h3>📝 Как создать пресет:</h3>
            <ol className={styles.instructionList}>
              <li>
                <strong>Перейдите во вкладку "Команды"</strong>
                <p>В левом меню нажмите на раздел "Команды"</p>
              </li>
              <li>
                <strong>Введите команды</strong>
                <p>В поле "Команды (каждая с новой строки)" напишите нужные команды, например:</p>
                <pre className={styles.codeExample}>list{'\n'}report{'\n'}START</pre>
              </li>
              <li>
                <strong>Введите название пресета</strong>
                <p>Внизу формы найдите поле "Название пресета" и введите понятное имя</p>
              </li>
              <li>
                <strong>Сохраните</strong>
                <p>Нажмите кнопку "💾 Сохранить как пресет"</p>
              </li>
              <li>
                <strong>Готово!</strong>
                <p>Пресет появится в виде пронумерованной кнопки (1, 2, 3...) и станет доступен здесь</p>
              </li>
            </ol>
          </div>

          <div className={styles.helpSection}>
            <h3>💡 Полезные примеры пресетов:</h3>
            <ul className={styles.exampleList}>
              <li><strong>Проверка статуса:</strong> list, report, status</li>
              <li><strong>Запуск торговли:</strong> START</li>
              <li><strong>Остановка:</strong> STOP, SELL</li>
              <li><strong>Утренний рестарт:</strong> STOP, SELL, list, START</li>
            </ul>
          </div>
        </div>

        <div className={styles.modalActions}>
          <button 
            type="button"
            onClick={onClose}
            className={styles.primaryBtn}
          >
            <FiCheck /> Понятно
          </button>
        </div>
      </div>
    </div>
  );
}



