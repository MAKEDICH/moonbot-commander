/**
 * Утилиты для страницы Полезное (Upbit Market Data)
 */

// Порядок баз для сортировки
export const PREFERRED_BASE_ORDER = ['KRW', 'BTC', 'USDT'];

// Комбинации баз для вкладок
export const UPBIT_BASE_MARKET_COMBINATIONS = [
    { id: 'krw', label: 'KRW', bases: ['KRW'] },
    { id: 'btc', label: 'BTC', bases: ['BTC'] },
    { id: 'usdt', label: 'USDT', bases: ['USDT'] },
    { id: 'krw-btc', label: 'KRW ∩ BTC', bases: ['KRW', 'BTC'] },
    { id: 'krw-usdt', label: 'KRW ∩ USDT', bases: ['KRW', 'USDT'] },
    { id: 'btc-usdt', label: 'BTC ∩ USDT', bases: ['BTC', 'USDT'] },
    { id: 'krw-btc-usdt', label: 'KRW ∩ BTC ∩ USDT', bases: ['KRW', 'BTC', 'USDT'] }
];

/**
 * Нормализация символа (убираем числовые префиксы)
 */
export function normalizeSymbol(symbol) {
    if (!symbol) return '';
    const upper = String(symbol).trim().toUpperCase();
    const stripped = upper.replace(/^\d+/, '');
    return stripped || upper;
}

/**
 * Построение нормализованного индекса
 */
export function buildNormalizedIndex(set) {
    const normSet = new Set();
    const normMap = new Map();
    
    for (const sym of set) {
        const norm = normalizeSymbol(sym);
        normSet.add(norm);
        if (!normMap.has(norm)) normMap.set(norm, new Set());
        normMap.get(norm).add(sym);
    }
    
    return { set: normSet, map: normMap };
}

/**
 * Пересечение множеств
 */
export function intersectionSets(sets) {
    const valid = sets.filter(s => s && s.size !== undefined);
    if (valid.length === 0) return new Set();
    
    let result = new Set(valid[0]);
    for (let i = 1; i < valid.length; i++) {
        const next = valid[i];
        result = new Set([...result].filter(x => next.has(x)));
        if (result.size === 0) break;
    }
    return result;
}

/**
 * Объединение множеств
 */
export function unionSets(sets) {
    const out = new Set();
    for (const s of sets) {
        if (s) for (const v of s) out.add(v);
    }
    return out;
}

/**
 * Группировка рынков Upbit по базам
 */
export function groupUpbitMarkets(markets) {
    const grouped = {};
    for (const m of markets) {
        const [base] = m.market.split('-');
        if (!grouped[base]) grouped[base] = [];
        grouped[base].push(m.market);
    }
    return grouped;
}

/**
 * Форматирование цены с разделителями тысяч
 */
function formatWithSeparators(num, decimals = 0) {
    const fixed = decimals > 0 ? num.toFixed(decimals) : Math.round(num).toString();
    const [intPart, decPart] = fixed.split('.');
    const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return decPart ? `${formatted}.${decPart}` : formatted;
}

/**
 * Форматирование цены (как в оригинале)
 */
export function formatPrice(val, market) {
    if (typeof val !== 'number') return 'N/A';
    const base = (market || '').split('-')[0];
    
    if (base === 'KRW') {
        if (val >= 100) return formatWithSeparators(val, 0);
        if (val >= 1) return formatWithSeparators(val, 2);
        return val.toFixed(4);
    }
    
    if (val >= 100) return val.toFixed(2);
    if (val >= 1) return val.toFixed(4);
    return val.toFixed(8);
}

/**
 * Форматирование изменения цены
 */
export function formatChange(rate) {
    if (typeof rate !== 'number') return 'N/A';
    const pct = rate * 100;
    const s = pct >= 0 ? '+' : '';
    return `${s}${pct.toFixed(2)}%`;
}

/**
 * Экранирование HTML
 */
export function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;'
    }[c]));
}

/**
 * Копирование в буфер обмена
 */
export async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (e) {
        // Fallback
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        let ok = false;
        try {
            ok = document.execCommand('copy');
        } catch (err) {
            ok = false;
        }
        document.body.removeChild(ta);
        return ok;
    }
}
