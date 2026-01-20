/**
 * Компоненты таблиц для страницы Полезное
 * Упрощённая версия без дат листинга
 */

import React, { useState, useMemo, useCallback } from 'react';
import styles from '../../pages/Useful.module.css';
import {
    formatPrice,
    formatChange,
    copyToClipboard
} from './usefulUtils';

/**
 * Таблица рынков Upbit по базе
 */
export const UpbitMarketsTable = ({
    markets,
    tickers,
    normalizedExternal
}) => {
    const [search, setSearch] = useState('');
    const [sortKey, setSortKey] = useState(null);
    const [sortDir, setSortDir] = useState('asc');
    const [useAlias, setUseAlias] = useState(false);
    const [aliasExchange, setAliasExchange] = useState('bin');
    const [copyNotice, setCopyNotice] = useState('');
    
    // Построение данных таблицы
    const tableData = useMemo(() => {
        let data = markets.map(mkt => {
            const t = tickers.get(mkt) || {};
            const coin = mkt.split('-')[1];
            return {
                market: mkt,
                coin,
                trade_price: t.trade_price,
                signed_change_rate: t.signed_change_rate
            };
        });
        
        // Фильтр по поиску
        const term = search.trim().toLowerCase();
        if (term) {
            data = data.filter(r => r.market.toLowerCase().includes(term));
        }
        
        // Сортировка
        if (sortKey) {
            data = [...data].sort((a, b) => {
                let va = a[sortKey];
                let vb = b[sortKey];
                
                if (typeof va === 'number' && typeof vb === 'number') {
                    return sortDir === 'asc' ? va - vb : vb - va;
                }
                
                va = String(va ?? '').toLowerCase();
                vb = String(vb ?? '').toLowerCase();
                
                if (va < vb) return sortDir === 'asc' ? -1 : 1;
                if (va > vb) return sortDir === 'asc' ? 1 : -1;
                return 0;
            });
        }
        
        return data;
    }, [markets, tickers, search, sortKey, sortDir]);
    
    // Обработчик сортировки
    const handleSort = (key) => {
        if (sortKey === key) {
            setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };
    
    // Копирование списка через запятую
    const handleCopy = async () => {
        const items = tableData.map(r => {
            if (!useAlias) return r.coin;
            
            const norm = r.coin;
            const map = aliasExchange === 'bin' 
                ? normalizedExternal?.binanceSpot?.map 
                : normalizedExternal?.bybitSpot?.map;
            
            if (map) {
                const originals = map.get(norm);
                if (originals && originals.size) {
                    let pick = null;
                    for (const o of originals) {
                        if (/^\d+/.test(o)) {
                            pick = o;
                            break;
                        }
                    }
                    if (!pick) pick = Array.from(originals)[0];
                    return String(pick).toLowerCase();
                }
            }
            
            return norm;
        });
        
        // Через запятую без пробелов
        const ok = await copyToClipboard(items.join(','));
        setCopyNotice(ok ? 'Скопировано' : 'Не удалось скопировать');
        setTimeout(() => setCopyNotice(''), 2000);
    };
    
    const headers = [
        { label: 'Market', key: 'market', sortable: true },
        { label: 'Trade Price', key: 'trade_price', sortable: true },
        { label: 'Change (24h)', key: 'signed_change_rate', sortable: true }
    ];
    
    return (
        <div className={styles.tableCard}>
            <div className={styles.tableToolbar}>
                <input
                    type="text"
                    className={styles.searchInput}
                    placeholder="Поиск по рынку..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>
            
            <div className={styles.copyControls}>
                <label className={styles.aliasCheckbox}>
                    <input
                        type="checkbox"
                        checked={useAlias}
                        onChange={e => setUseAlias(e.target.checked)}
                    />
                    Биржевые названия
                </label>
                {useAlias && (
                    <span className={styles.exchangeSelect}>
                        <label>
                            <input
                                type="radio"
                                name="aliasExchange"
                                value="bin"
                                checked={aliasExchange === 'bin'}
                                onChange={() => setAliasExchange('bin')}
                            />
                            Binance
                        </label>
                        <label>
                            <input
                                type="radio"
                                name="aliasExchange"
                                value="bb"
                                checked={aliasExchange === 'bb'}
                                onChange={() => setAliasExchange('bb')}
                            />
                            Bybit
                        </label>
                    </span>
                )}
                <button className={styles.copyButton} onClick={handleCopy}>
                    Копировать
                </button>
                {copyNotice && <span className={styles.copyNotice}>{copyNotice}</span>}
            </div>
            
            <div className={styles.tableWrapper}>
                <table className={styles.dataTable}>
                    <thead>
                        <tr>
                            {headers.map(h => (
                                <th
                                    key={h.key}
                                    className={h.sortable ? styles.sortable : ''}
                                    onClick={() => h.sortable && handleSort(h.key)}
                                >
                                    {h.label}
                                    {sortKey === h.key && (
                                        <span className={styles.sortIndicator}>
                                            {sortDir === 'asc' ? ' ↑' : ' ↓'}
                                        </span>
                                    )}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {tableData.map(row => (
                            <tr key={row.market}>
                                <td>{row.market}</td>
                                <td>{formatPrice(row.trade_price, row.market)}</td>
                                <td className={row.signed_change_rate >= 0 ? styles.positive : styles.negative}>
                                    {formatChange(row.signed_change_rate)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            <div className={styles.tableFooter}>
                Всего: {tableData.length} рынков
            </div>
        </div>
    );
};

/**
 * Таблица пересечений монет
 */
export const IntersectionTable = ({
    coins,
    count,
    setsWithLabels,
    title
}) => {
    const [search, setSearch] = useState('');
    const [sortKey, setSortKey] = useState('coin');
    const [sortDir, setSortDir] = useState('asc');
    const [useAlias, setUseAlias] = useState(false);
    const [aliasExchange, setAliasExchange] = useState('bin');
    const [copyNotice, setCopyNotice] = useState('');
    
    // Получение алиасов для монеты
    const aliasesFor = useCallback((coin) => {
        const out = [];
        for (const s of setsWithLabels) {
            if (!s || !s.source || !s.map) continue;
            const originals = s.map.get(coin);
            if (!originals || originals.size === 0) continue;
            for (const orig of originals) {
                if (/^\d+/.test(orig)) {
                    out.push(`${String(orig).toLowerCase()}:${s.source}`);
                }
            }
        }
        return out.join(', ');
    }, [setsWithLabels]);
    
    // Построение данных таблицы
    const tableData = useMemo(() => {
        let data = coins.map(coin => ({
            coin,
            aliases: aliasesFor(coin)
        }));
        
        // Фильтр по поиску
        const term = search.trim().toLowerCase();
        if (term) {
            data = data.filter(r => 
                r.coin.toLowerCase().includes(term) || 
                r.aliases.toLowerCase().includes(term)
            );
        }
        
        // Сортировка
        if (sortKey) {
            data = data.sort((a, b) => {
                let va = a[sortKey];
                let vb = b[sortKey];
                
                va = String(va ?? '').toLowerCase();
                vb = String(vb ?? '').toLowerCase();
                
                if (va < vb) return sortDir === 'asc' ? -1 : 1;
                if (va > vb) return sortDir === 'asc' ? 1 : -1;
                return 0;
            });
        }
        
        return data;
    }, [coins, aliasesFor, search, sortKey, sortDir]);
    
    // Обработчик сортировки
    const handleSort = (key) => {
        if (sortKey === key) {
            setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };
    
    // Копирование списка через запятую с поддержкой биржевых названий
    const handleCopy = async () => {
        const items = tableData.map(r => {
            if (!useAlias) return r.coin;
            
            const norm = r.coin;
            for (const s of setsWithLabels) {
                if (s.source !== aliasExchange) continue;
                const originals = s.map?.get(norm);
                if (originals && originals.size) {
                    let pick = null;
                    for (const o of originals) {
                        if (/^\d+/.test(o)) {
                            pick = o;
                            break;
                        }
                    }
                    if (!pick) pick = Array.from(originals)[0];
                    return String(pick).toLowerCase();
                }
            }
            
            return norm;
        });
        
        // Через запятую без пробелов
        const ok = await copyToClipboard(items.join(','));
        setCopyNotice(ok ? 'Скопировано' : 'Не удалось скопировать');
        setTimeout(() => setCopyNotice(''), 2000);
    };
    
    const headers = [
        { label: 'Coin', key: 'coin', sortable: true },
        { label: 'Биржевые названия', key: 'aliases', sortable: true }
    ];
    
    const labels = setsWithLabels.map(x => x.label);
    
    return (
        <div className={styles.tableCard}>
            <div className={styles.intersectionHeader}>
                <span className={styles.chip}>{title}</span>
                <span className={styles.intersectionInfo}>
                    Общие монеты ({labels.join(' ∩ ')}): {count}
                </span>
            </div>
            
            {count === 0 ? (
                <div className={styles.emptyMessage}>Общих монет не найдено.</div>
            ) : (
                <>
                    <div className={styles.tableToolbar}>
                        <input
                            type="text"
                            className={styles.searchInput}
                            placeholder="Поиск монеты..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    
                    <div className={styles.copyControls}>
                        <label className={styles.aliasCheckbox}>
                            <input
                                type="checkbox"
                                checked={useAlias}
                                onChange={e => setUseAlias(e.target.checked)}
                            />
                            Биржевые названия
                        </label>
                        {useAlias && (
                            <span className={styles.exchangeSelect}>
                                <label>
                                    <input
                                        type="radio"
                                        name={`aliasExchange-${title}`}
                                        value="bin"
                                        checked={aliasExchange === 'bin'}
                                        onChange={() => setAliasExchange('bin')}
                                    />
                                    Binance
                                </label>
                                <label>
                                    <input
                                        type="radio"
                                        name={`aliasExchange-${title}`}
                                        value="bb"
                                        checked={aliasExchange === 'bb'}
                                        onChange={() => setAliasExchange('bb')}
                                    />
                                    Bybit
                                </label>
                            </span>
                        )}
                        <button className={styles.copyButton} onClick={handleCopy}>
                            Копировать
                        </button>
                        {copyNotice && <span className={styles.copyNotice}>{copyNotice}</span>}
                    </div>
                    
                    <div className={styles.tableWrapper}>
                        <table className={styles.dataTable}>
                            <thead>
                                <tr>
                                    {headers.map(h => (
                                        <th
                                            key={h.key}
                                            className={h.sortable ? styles.sortable : ''}
                                            onClick={() => h.sortable && handleSort(h.key)}
                                        >
                                            {h.label}
                                            {sortKey === h.key && (
                                                <span className={styles.sortIndicator}>
                                                    {sortDir === 'asc' ? ' ↑' : ' ↓'}
                                                </span>
                                            )}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {tableData.map(row => (
                                    <tr key={row.coin}>
                                        <td>{row.coin}</td>
                                        <td className={styles.aliasCell}>{row.aliases || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    
                    <div className={styles.tableFooter}>
                        Показано: {tableData.length} из {count} монет
                    </div>
                </>
            )}
        </div>
    );
};

export default { UpbitMarketsTable, IntersectionTable };
