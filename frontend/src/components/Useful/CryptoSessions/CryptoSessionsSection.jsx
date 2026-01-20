/**
 * Компонент Crypto Trading Sessions
 * Отображает глобальные криптовалютные торговые сессии в реальном времени
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import styles from './CryptoSessions.module.css';
import { SESSIONS, OVERLAPS, TIMEZONES } from './constants';
import { 
    formatTime, 
    formatDate, 
    getTimeInTimezone,
    isSessionActive 
} from './utils';
import { SessionCard, OverlapCard, Timeline } from './components';

/**
 * Главный компонент Crypto Sessions
 */
const CryptoSessionsSection = () => {
    const [timezone, setTimezone] = useState(() => {
        return localStorage.getItem('cryptoSessionsTimezone') || 'Europe/Moscow';
    });
    const [indicatorPosition, setIndicatorPosition] = useState(0);
    const [currentTimeStr, setCurrentTimeStr] = useState('00:00');
    const [, setTick] = useState(0);
    
    const trackContainerRef = useRef(null);

    /**
     * Обновление позиции индикатора текущего времени
     */
    const updateTimeIndicator = useCallback(() => {
        const now = new Date();
        const tzTime = getTimeInTimezone(now, timezone);
        const hours = tzTime.getHours();
        const minutes = tzTime.getMinutes();
        const decimal = hours + minutes / 60;
        const percent = (decimal / 24) * 100;

        const trackContainer = trackContainerRef.current;
        
        if (trackContainer) {
            const containerLeft = 130;
            const containerWidth = trackContainer.offsetWidth;
            const position = containerLeft + (percent / 100) * containerWidth;
            
            setIndicatorPosition(position);
            setCurrentTimeStr(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);
        }
    }, [timezone]);

    // Сохранение часового пояса
    const handleTimezoneChange = (e) => {
        const newTimezone = e.target.value;
        setTimezone(newTimezone);
        localStorage.setItem('cryptoSessionsTimezone', newTimezone);
    };

    // Обновление каждую секунду
    useEffect(() => {
        updateTimeIndicator();
        setTick(t => t + 1);
        
        const interval = setInterval(() => {
            updateTimeIndicator();
            setTick(t => t + 1);
        }, 1000);
        
        return () => clearInterval(interval);
    }, [updateTimeIndicator]);

    // Обновление при изменении размера окна
    useEffect(() => {
        const handleResize = () => {
            updateTimeIndicator();
        };
        
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [updateTimeIndicator]);

    // Текущее время
    const now = new Date();
    const tzTime = getTimeInTimezone(now, timezone);
    const currentHourUTC = now.getUTCHours();
    const currentMinutes = now.getUTCMinutes();
    const currentSeconds = now.getUTCSeconds();

    // Активные сессии
    const activeSessions = Object.entries(SESSIONS)
        .filter(([, session]) => isSessionActive(session, currentHourUTC))
        .map(([, session]) => session);

    return (
        <div className={styles.wrapper}>
            <div className={styles.bgAnimation}></div>
            <div className={styles.gridOverlay}></div>

            <div className={styles.container}>
                {/* Header */}
                <header className={styles.header}>
                    <h1 className={styles.headerTitle}>₿ Crypto Sessions</h1>
                    <p className={styles.subtitle}>Глобальные криптовалютные торговые сессии в реальном времени</p>
                </header>

                {/* Current Time Panel */}
                <div className={styles.currentTimePanel}>
                    <div className={styles.timeDisplay}>
                        <span className={styles.timeLabel}>Текущее время</span>
                        <span className={styles.timeValue}>{formatTime(tzTime)}</span>
                        <span className={styles.dateValue}>{formatDate(tzTime)}</span>
                    </div>

                    <div className={styles.activeSessions}>
                        {activeSessions.length === 0 ? (
                            <span className={styles.lowActivity}>Низкая активность</span>
                        ) : (
                            activeSessions.map((session, idx) => (
                                <div key={idx} className={styles.activeBadge}>
                                    <span className={styles.activeBadgeDot}></span>
                                    <span className={styles.activeBadgeIcon}>{session.icon}</span>
                                    <span>{session.name.split(' ')[0]}</span>
                                </div>
                            ))
                        )}
                    </div>

                    <div className={styles.timezoneSelector}>
                        <label htmlFor="timezone">Часовой пояс:</label>
                        <select
                            id="timezone"
                            className={styles.timezoneSelect}
                            value={timezone}
                            onChange={handleTimezoneChange}
                        >
                            {TIMEZONES.map(tz => (
                                <option key={tz.value} value={tz.value}>{tz.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Timeline */}
                <Timeline
                    ref={trackContainerRef}
                    timezone={timezone}
                    currentHourUTC={currentHourUTC}
                    indicatorPosition={indicatorPosition}
                    currentTimeStr={currentTimeStr}
                />

                {/* Session Cards */}
                <div className={styles.sessionsGrid}>
                    {Object.entries(SESSIONS).map(([key, session]) => (
                        <SessionCard
                            key={key}
                            session={session}
                            sessionKey={key}
                            timezone={timezone}
                            currentHourUTC={currentHourUTC}
                            currentMinutes={currentMinutes}
                            currentSeconds={currentSeconds}
                        />
                    ))}
                </div>

                {/* Overlap Section */}
                <div className={styles.overlapSection}>
                    <h2 className={styles.overlapTitle}>
                        <svg viewBox="0 0 24 24" className={styles.overlapTitleIcon}>
                            <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2z" fill="currentColor"/>
                        </svg>
                        Пересечения сессий (Высокая волатильность)
                    </h2>
                    <div className={styles.overlapGrid}>
                        {OVERLAPS.map((overlap, index) => (
                            <OverlapCard
                                key={index}
                                overlap={overlap}
                                index={index}
                                timezone={timezone}
                                currentHourUTC={currentHourUTC}
                            />
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className={styles.footerInfo}>
                    <p>Криптовалютный рынок работает 24/7. Данные времени обновляются в реальном времени.</p>
                </div>
            </div>
        </div>
    );
};

export default CryptoSessionsSection;
