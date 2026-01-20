/**
 * Секция результатов отправки команд
 */

import React from 'react';
import { FiCheck, FiX } from 'react-icons/fi';
import styles from './SendResultSection.module.css';

/**
 * Отображение результатов отправки команд
 */
const SendResultSection = ({ sendResult, onClose }) => {
    if (!sendResult) return null;
    
    return (
        <div className={`${styles.fullRow} ${styles.sendResult} ${styles[sendResult.status]}`}>
            <div className={styles.sendResultHeader}>
                {sendResult.status === 'success' ? (
                    <><FiCheck /> Команды отправлены</>
                ) : sendResult.status === 'partial' ? (
                    <>⚠️ Частично выполнено</>
                ) : (
                    <><FiX /> Ошибка отправки</>
                )}
                <button onClick={onClose} className={styles.closeBtn}>✕</button>
            </div>
            
            {sendResult.summary && (
                <div className={styles.sendResultSummary}>
                    Успешно: {sendResult.summary.successful} | Ошибок: {sendResult.summary.failed} | Серверов: {sendResult.summary.servers}
                </div>
            )}
            
            {sendResult.message && (
                <div className={styles.sendResultMessage}>{sendResult.message}</div>
            )}
            
            {sendResult.results && sendResult.results.length > 0 && (
                <div className={styles.sendResultList}>
                    {sendResult.results.map((result, index) => (
                        <div key={index} className={`${styles.resultItem} ${styles[result.status]}`}>
                            <div className={styles.resultItemHeader}>
                                <span>{result.status === 'success' ? '✓' : '✗'} {result.server_name}</span>
                                <span className={styles.resultCmd}>{result.command}</span>
                            </div>
                            <div className={styles.resultResponse}>{result.response || 'Нет ответа'}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SendResultSection;

