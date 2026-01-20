/**
 * Компонент карточки пересечения сессий
 */

import React from 'react';
import styles from '../CryptoSessions.module.css';
import { SESSIONS } from '../constants';
import { formatHour, isOverlapActive, getTimeInTimezone } from '../utils';

/**
 * Карточка пересечения сессий
 */
const OverlapCard = ({ overlap, index, timezone, currentHourUTC }) => {
    const isActive = isOverlapActive(overlap, currentHourUTC);
    
    // Получить время в часовом поясе
    const now = new Date();
    const utcDateStart = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        overlap.startUTC, 0, 0
    ));
    const tzDateStart = getTimeInTimezone(utcDateStart, timezone);
    const startHour = tzDateStart.getHours();
    
    const utcDateEnd = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        overlap.endUTC, 0, 0
    ));
    const tzDateEnd = getTimeInTimezone(utcDateEnd, timezone);
    const endHour = tzDateEnd.getHours();

    return (
        <div
            className={`${styles.overlapCard} ${isActive ? styles.overlapCardActive : ''}`}
        >
            <div className={styles.overlapSessions}>
                {overlap.sessions.map((s, i) => (
                    <React.Fragment key={s}>
                        <span className={`${styles.overlapBadge} ${styles[`badge${s.charAt(0).toUpperCase() + s.slice(1)}`]}`}>
                            <span className={styles.overlapBadgeIcon}>{SESSIONS[s].icon}</span>
                            {SESSIONS[s].name.split(' ')[0]}
                        </span>
                        {i < overlap.sessions.length - 1 && (
                            <span className={styles.overlapPlus}>+</span>
                        )}
                    </React.Fragment>
                ))}
            </div>
            <div className={styles.overlapTime}>
                {formatHour(startHour)} - {formatHour(endHour)}
            </div>
            <div className={styles.overlapNote}>
                ⚡ {overlap.description}
            </div>
        </div>
    );
};

export default OverlapCard;

