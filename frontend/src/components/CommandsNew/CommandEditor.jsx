import React from 'react';
import { FiX } from 'react-icons/fi';
import styles from '../../pages/CommandsNew.module.css';

/**
 * Редактор команд с настройками отправки
 */
const CommandEditor = ({
  commands,
  setCommands,
  loading,
  selectedServers,
  handleSendCommand,
  delayBetweenBots,
  setDelayBetweenBots,
  clearAfterSend,
  setClearAfterSend,
  response
}) => {
  return (
    <div className={styles.commandPanel}>
      <div className={styles.topControlsRow}>
        <div className={styles.delayInputWrapper}>
          <label 
            title="Задержка между отправкой команд на разные боты (применяется только если выбрано больше 1 бота)"
            style={{ cursor: 'help' }}
          >
            Задержка отправки команд (сек):
          </label>
          <input
            type="text"
            value={delayBetweenBots}
            onChange={(e) => {
              const value = e.target.value.replace(/[^0-9]/g, '');
              if (value === '') {
                setDelayBetweenBots(0);
              } else {
                const numValue = parseInt(value);
                if (numValue >= 0 && numValue <= 9999) {
                  setDelayBetweenBots(numValue);
                }
              }
            }}
            onKeyDown={(e) => {
              if (e.key === '-' || e.key === '+' || e.key === 'e' || e.key === 'E' || e.key === '.' || e.key === ',') {
                e.preventDefault();
              }
            }}
            maxLength="4"
            className={styles.delayInput}
            disabled={loading}
            placeholder="0"
            title="Задержка между отправкой команд на разные боты"
          />
        </div>
      </div>

      <form onSubmit={handleSendCommand} className={styles.form}>
        <div className={styles.formGroup}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <label>Редактор команд (каждая с новой строки)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                <input
                  type="checkbox"
                  checked={clearAfterSend}
                  onChange={(e) => {
                    const newValue = e.target.checked;
                    setClearAfterSend(newValue);
                    localStorage.setItem('clearAfterSend', newValue.toString());
                  }}
                  style={{ cursor: 'pointer' }}
                />
                <span>Очищать после отправки</span>
              </label>
              <button
                type="button"
                onClick={() => setCommands('')}
                className={styles.clearBtn}
                title="Очистить редактор"
                disabled={loading || !commands.trim()}
              >
                <FiX /> Очистить
              </button>
            </div>
          </div>
          <textarea
            value={commands}
            onChange={(e) => {
              if (e.target.value.length <= 100000) {
                setCommands(e.target.value);
              }
            }}
            placeholder="list&#10;report&#10;START"
            className={styles.textarea}
            disabled={loading}
            rows={6}
          />
        </div>

        <button
          type="submit"
          className={styles.sendButton}
          disabled={loading || selectedServers.length === 0 || !commands.trim()}
        >
          {loading ? 'Отправка...' : `Отправить (${selectedServers.length * commands.split('\n').filter(c => c.trim()).length})`}
        </button>
      </form>

      {/* Результаты */}
      {response && (
        <div className={`${styles.response} ${styles[response.status]}`}>
          <div className={styles.responseHeader}>
            <strong>{response.presetName ? `Пресет: ${response.presetName}` : 'Результат'}</strong>
            <span className={styles.responseTime}>{response.time}</span>
          </div>

          {response.bulk && response.results ? (
            <>
              <div className={styles.summary}>
                <div>✓ Успешно: {response.summary.successful}</div>
                <div>✗ Ошибок: {response.summary.failed}</div>
                <div>Всего: {response.summary.total}</div>
              </div>

              <div className={styles.bulkResults}>
                {response.results.map((result, index) => (
                  <div key={index} className={`${styles.bulkResult} ${styles[result.status]}`}>
                    <div className={styles.bulkResultHeader}>
                      <div>
                        <strong>{result.server_name}</strong>
                        <div><code>{result.command}</code></div>
                      </div>
                      <span>{result.status === 'success' ? '✓' : '✗'}</span>
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
  );
};

export default CommandEditor;





