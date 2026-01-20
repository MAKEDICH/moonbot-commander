/**
 * Константы для компонента Crypto Sessions
 */

import React from 'react';

/**
 * SVG иконки для сессий (точная копия из оригинала)
 */
export const SESSION_ICONS = {
    asia: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="5" fill="#ff6b35" opacity="0.3"/>
            <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" stroke="#f7931a"/>
            <path d="M12 8l1.5 3 3.5.5-2.5 2.5.5 3.5L12 16l-3 1.5.5-3.5-2.5-2.5 3.5-.5L12 8z" fill="#ff6b35"/>
        </svg>
    ),
    europe: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#00d4ff" opacity="0.3"/>
            <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="#00d4ff"/>
            <circle cx="12" cy="7" r="2" fill="#0099cc"/>
        </svg>
    ),
    america: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" fill="#a855f7" opacity="0.2"/>
            <path d="M3 9h18M9 21V9m6 12V9" stroke="#a855f7"/>
            <path d="M7 6h.01M12 6h.01M17 6h.01" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round"/>
            <path d="M6 13l3 3 3-3 3 3 3-3" stroke="#a855f7" strokeWidth="1.5"/>
        </svg>
    ),
    pacific: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 15c2.5-2.5 5-2.5 7.5 0s5 2.5 7.5 0 5-2.5 7.5 0" stroke="#00ff88" strokeWidth="2"/>
            <path d="M3 11c2.5-2.5 5-2.5 7.5 0s5 2.5 7.5 0 5-2.5 7.5 0" stroke="#00cc6a" strokeWidth="1.5" opacity="0.7"/>
            <path d="M3 19c2.5-2.5 5-2.5 7.5 0s5 2.5 7.5 0 5-2.5 7.5 0" stroke="#00ff88" strokeWidth="1.5" opacity="0.5"/>
            <circle cx="17" cy="6" r="3" fill="#00ff88" opacity="0.4"/>
            <path d="M17 4v4M15 6h4" stroke="#00cc6a"/>
        </svg>
    )
};

/**
 * Данные торговых сессий (время в UTC)
 * 
 * Криптовалютный рынок работает 24/7, но активность трейдеров
 * варьируется в зависимости от времени суток и совпадает 
 * с основными мировыми финансовыми сессиями.
 */
export const SESSIONS = {
    asia: {
        name: 'Азиатская сессия',
        region: 'Токио, Сеул, Сингапур, Гонконг',
        icon: SESSION_ICONS.asia,
        emoji: '🌏',
        startUTC: 0,
        endUTC: 9,
        peakStart: 1,
        peakEnd: 4,
        color: 'asia'
    },
    europe: {
        name: 'Европейская сессия',
        region: 'Лондон, Франкфурт, Париж',
        icon: SESSION_ICONS.europe,
        emoji: '🌍',
        startUTC: 7,
        endUTC: 16,
        peakStart: 8,
        peakEnd: 11,
        color: 'europe'
    },
    america: {
        name: 'Американская сессия',
        region: 'Нью-Йорк, Чикаго',
        icon: SESSION_ICONS.america,
        emoji: '🌎',
        startUTC: 13,
        endUTC: 22,
        peakStart: 14,
        peakEnd: 17,
        color: 'america'
    },
    pacific: {
        name: 'Тихоокеанская сессия',
        region: 'Сидней, Веллингтон',
        icon: SESSION_ICONS.pacific,
        emoji: '🌊',
        startUTC: 21,
        endUTC: 6,
        peakStart: 22,
        peakEnd: 1,
        color: 'pacific'
    }
};

/**
 * Пересечения сессий - периоды высокой волатильности
 */
export const OVERLAPS = [
    {
        sessions: ['europe', 'america'],
        name: 'Европа + Америка',
        startUTC: 13,
        endUTC: 16,
        description: 'Максимальная ликвидность и волатильность'
    },
    {
        sessions: ['asia', 'europe'],
        name: 'Азия + Европа',
        startUTC: 7,
        endUTC: 9,
        description: 'Переход активности на Европу'
    },
    {
        sessions: ['america', 'pacific'],
        name: 'Америка + Тихоокеанская',
        startUTC: 21,
        endUTC: 22,
        description: 'Переход к азиатским рынкам'
    },
    {
        sessions: ['pacific', 'asia'],
        name: 'Тихоокеанская + Азия',
        startUTC: 0,
        endUTC: 6,
        description: 'Азиатское утро'
    }
];

/**
 * Доступные часовые пояса
 */
export const TIMEZONES = [
    { value: 'Europe/Moscow', label: 'Москва (UTC+3)' },
    { value: 'Europe/London', label: 'Лондон (UTC+0/+1)' },
    { value: 'Europe/Berlin', label: 'Берлин (UTC+1/+2)' },
    { value: 'America/New_York', label: 'Нью-Йорк (UTC-5/-4)' },
    { value: 'America/Los_Angeles', label: 'Лос-Анджелес (UTC-8/-7)' },
    { value: 'Asia/Tokyo', label: 'Токио (UTC+9)' },
    { value: 'Asia/Singapore', label: 'Сингапур (UTC+8)' },
    { value: 'Asia/Hong_Kong', label: 'Гонконг (UTC+8)' },
    { value: 'Asia/Dubai', label: 'Дубай (UTC+4)' },
    { value: 'Australia/Sydney', label: 'Сидней (UTC+10/+11)' },
    { value: 'UTC', label: 'UTC (UTC+0)' }
];

