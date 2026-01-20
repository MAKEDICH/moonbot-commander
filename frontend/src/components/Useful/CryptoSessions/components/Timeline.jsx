/**
 * Компонент временной шкалы
 */

import React, { forwardRef } from 'react';
import styles from '../CryptoSessions.module.css';
import { SESSIONS } from '../constants';
import { 
    formatHour,
    isSessionActive, 
    utcHourToTimezoneHour,
    addPeakToBar,
    addPeakToSplitBars
} from '../utils';

/**
 * Временная шкала сессий
 */
const Timeline = forwardRef(({ 
    timezone, 
    currentHourUTC, 
    indicatorPosition, 
    currentTimeStr 
}, trackContainerRef) => {
    return (
        <div className={styles.timelineContainer}>
            <div className={styles.timelineHeader}>
                <h2 className={styles.timelineTitle}>
                    <svg viewBox="0 0 24 24" className={styles.timelineTitleIcon}>
                        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.2 3.2.8-1.3-4.5-2.7V7z" fill="currentColor"/>
                    </svg>
                    24-часовая временная шкала
                </h2>
            </div>

            <div className={styles.timelineWrapper}>
                {/* Hour marks */}
                <div className={styles.timelineScale}>
                    {Array.from({ length: 24 }, (_, i) => (
                        <div
                            key={i}
                            className={`${styles.hourMark} ${i % 3 === 0 ? styles.major : ''}`}
                            style={{ left: `${(i / 24) * 100}%` }}
                        >
                            {formatHour(i)}
                        </div>
                    ))}
                </div>

                {/* Session tracks */}
                <div className={styles.sessionTracks}>
                    {Object.entries(SESSIONS).map(([key, session]) => {
                        const isActive = isSessionActive(session, currentHourUTC);
                        const startTZ = utcHourToTimezoneHour(session.startUTC, timezone);
                        const endTZ = utcHourToTimezoneHour(session.endUTC, timezone);
                        const peakStartTZ = utcHourToTimezoneHour(session.peakStart, timezone);
                        const peakEndTZ = utcHourToTimezoneHour(session.peakEnd, timezone);

                        // Вычисляем бары и пики
                        const bars = [];
                        if (endTZ > startTZ) {
                            const startPercent = (startTZ / 24) * 100;
                            const widthPercent = ((endTZ - startTZ) / 24) * 100;
                            const peak = addPeakToBar(startTZ, endTZ, peakStartTZ, peakEndTZ);
                            bars.push({
                                left: startPercent,
                                width: widthPercent,
                                peak: peak
                            });
                        } else {
                            const peak1 = addPeakToSplitBars(startTZ, endTZ, peakStartTZ, peakEndTZ, 0);
                            bars.push({
                                left: (startTZ / 24) * 100,
                                width: ((24 - startTZ) / 24) * 100,
                                peak: peak1
                            });
                            
                            const peak2 = addPeakToSplitBars(startTZ, endTZ, peakStartTZ, peakEndTZ, 1);
                            bars.push({
                                left: 0,
                                width: (endTZ / 24) * 100,
                                peak: peak2
                            });
                        }

                        return (
                            <div key={key} className={styles.sessionTrack}>
                                <div className={styles.trackLabel}>
                                    {session.name.split(' ')[0]}
                                </div>
                                <div 
                                    className={styles.trackBarContainer}
                                    ref={key === 'asia' ? trackContainerRef : null}
                                >
                                    {bars.map((bar, idx) => (
                                        <div
                                            key={idx}
                                            className={`${styles.sessionBar} ${styles[`session${session.color.charAt(0).toUpperCase() + session.color.slice(1)}`]} ${isActive ? styles.active : ''}`}
                                            style={{ left: `${bar.left}%`, width: `${bar.width}%` }}
                                        >
                                            <span>{session.icon}</span>
                                            {bar.peak && (
                                                <div 
                                                    className={styles.peakHours}
                                                    style={{ 
                                                        left: `${bar.peak.left}%`, 
                                                        width: `${bar.peak.width}%` 
                                                    }}
                                                >
                                                    <span className={styles.peakLabel}>Peak</span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Current time indicator */}
                <div
                    className={styles.currentTimeIndicator}
                    style={{ left: `${indicatorPosition}px` }}
                >
                    <div className={styles.indicatorTime}>
                        {currentTimeStr}
                    </div>
                </div>
            </div>
        </div>
    );
});

Timeline.displayName = 'Timeline';

export default Timeline;

