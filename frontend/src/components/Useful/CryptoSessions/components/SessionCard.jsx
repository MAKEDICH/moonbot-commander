/**
 * Компонент карточки сессии
 */

import React from 'react';
import styles from '../CryptoSessions.module.css';
import { 
    formatHour,
    isSessionActive, 
    isInPeakHours, 
    getSessionProgress, 
    getTimeRemaining, 
    getTimeUntilStart,
    getTimeInTimezone,
    utcHourToTimezoneHour
} from '../utils';

/**
 * Карточка торговой сессии
 */
const SessionCard = ({ session, sessionKey, timezone, currentHourUTC, currentMinutes, currentSeconds }) => {
    const isActive = isSessionActive(session, currentHourUTC);
    const isPeak = isInPeakHours(session, currentHourUTC);
    
    // Получить время в часовом поясе
    const now = new Date();
    const utcDate = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        session.startUTC, 0, 0
    ));
    const tzDate = getTimeInTimezone(utcDate, timezone);
    const startHour = tzDate.getHours();
    
    const utcDateEnd = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        session.endUTC, 0, 0
    ));
    const tzDateEnd = getTimeInTimezone(utcDateEnd, timezone);
    const endHour = tzDateEnd.getHours();

    let timer, timerLabel;
    if (isActive) {
        timer = getTimeRemaining(session, currentHourUTC, currentMinutes, currentSeconds);
        timerLabel = 'До окончания сессии';
    } else {
        timer = getTimeUntilStart(session, currentHourUTC, currentMinutes, currentSeconds);
        timerLabel = 'До начала сессии';
    }

    const progress = isActive
        ? getSessionProgress(session, currentHourUTC, currentMinutes, currentSeconds)
        : 0;

    // Определяем статус
    let statusClass, statusText;
    if (isActive) {
        if (isPeak) {
            statusClass = styles.statusActive;
            statusText = '🔥 Пик активности';
        } else {
            statusClass = styles.statusActive;
            statusText = '● Активна';
        }
    } else if (timer.hours < 2) {
        statusClass = styles.statusUpcoming;
        statusText = '◐ Скоро начнётся';
    } else {
        statusClass = styles.statusInactive;
        statusText = '○ Неактивна';
    }

    return (
        <div
            className={`${styles.sessionCard} ${styles[session.color]} ${isActive ? styles.cardActive : ''}`}
        >
            <div className={styles.cardHeader}>
                <div className={`${styles.sessionIcon} ${styles[`icon${session.color.charAt(0).toUpperCase() + session.color.slice(1)}`]}`}>
                    {session.icon}
                </div>
                <span className={`${styles.sessionStatus} ${statusClass}`}>
                    {statusText}
                </span>
            </div>

            <h3 className={styles.sessionName}>{session.name}</h3>
            <p className={styles.sessionRegion}>{session.region}</p>

            <div className={styles.sessionTimes}>
                <div className={styles.timeBlock}>
                    <div className={styles.timeBlockLabel}>Начало</div>
                    <div className={styles.timeBlockValue}>{formatHour(startHour)}</div>
                </div>
                <div className={styles.timeBlock}>
                    <div className={styles.timeBlockLabel}>Конец</div>
                    <div className={styles.timeBlockValue}>{formatHour(endHour)}</div>
                </div>
            </div>

            <div className={styles.timerSection}>
                <div className={styles.timerLabel}>
                    <svg viewBox="0 0 24 24" className={styles.timerLabelIcon}>
                        <path d="M15 1H9v2h6V1zm-4 13h2V8h-2v6zm8.03-6.61l1.42-1.42c-.43-.51-.9-.99-1.41-1.41l-1.42 1.42A8.962 8.962 0 0012 4c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-2.12-.74-4.07-1.97-5.61zM12 20c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" fill="currentColor"/>
                    </svg>
                    <span>{timerLabel}</span>
                </div>
                <div className={styles.timerDisplay}>
                    <div className={styles.timerUnit}>
                        <div className={styles.timerValue}>
                            {timer.hours.toString().padStart(2, '0')}
                        </div>
                        <div className={styles.timerUnitLabel}>Часы</div>
                    </div>
                    <div className={styles.timerUnit}>
                        <div className={styles.timerValue}>
                            {timer.minutes.toString().padStart(2, '0')}
                        </div>
                        <div className={styles.timerUnitLabel}>Минуты</div>
                    </div>
                    <div className={styles.timerUnit}>
                        <div className={styles.timerValue}>
                            {timer.seconds.toString().padStart(2, '0')}
                        </div>
                        <div className={styles.timerUnitLabel}>Секунды</div>
                    </div>
                </div>
            </div>

            {isActive && (
                <div className={styles.progressSection}>
                    <div className={styles.progressHeader}>
                        <span className={styles.progressLabel}>Прогресс сессии</span>
                        <span className={styles.progressValue}>{Math.round(progress)}%</span>
                    </div>
                    <div className={styles.progressBar}>
                        <div
                            className={`${styles.progressFill} ${styles[`fill${session.color.charAt(0).toUpperCase() + session.color.slice(1)}`]}`}
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SessionCard;

