/**
 * Секция выбора серверов для отправки
 */
import React, { useState, useMemo } from 'react';
import { FiServer, FiCheck, FiX, FiSearch, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import styles from './ServerSelector.module.css';

const ServerSelector = ({ 
    servers, 
    selectedServers, 
    setSelectedServers,
    isOpen,
    setIsOpen 
}) => {
    const [searchQuery, setSearchQuery] = useState('');

    const groupedServers = useMemo(() => {
        const groups = {};
        servers.forEach(server => {
            const groupName = server.group_name || 'Без группы';
            if (!groups[groupName]) groups[groupName] = [];
            groups[groupName].push(server);
        });
        return groups;
    }, [servers]);

    const filteredServers = useMemo(() => {
        if (!searchQuery.trim()) return groupedServers;
        const query = searchQuery.toLowerCase();
        const filtered = {};
        Object.entries(groupedServers).forEach(([groupName, groupServers]) => {
            const matching = groupServers.filter(s => 
                s.name.toLowerCase().includes(query) ||
                s.host.toLowerCase().includes(query)
            );
            if (matching.length > 0) filtered[groupName] = matching;
        });
        return filtered;
    }, [groupedServers, searchQuery]);

    const toggleServer = (id) => {
        setSelectedServers(prev => 
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const toggleGroup = (groupServers) => {
        const ids = groupServers.map(s => s.id);
        const allSelected = ids.every(id => selectedServers.includes(id));
        if (allSelected) {
            setSelectedServers(prev => prev.filter(id => !ids.includes(id)));
        } else {
            setSelectedServers(prev => [...new Set([...prev, ...ids])]);
        }
    };

    if (servers.length === 0) return null;

    return (
        <div className={styles.serverSection}>
            <div className={styles.sectionHeader} onClick={() => setIsOpen(!isOpen)}>
                <div className={styles.sectionTitle}>
                    <FiServer />
                    <span>Выбор серверов для отправки</span>
                    <span className={styles.serverCount}>
                        ({selectedServers.length} из {servers.length})
                    </span>
                </div>
                <button className={styles.toggleBtn}>
                    {isOpen ? <FiChevronUp /> : <FiChevronDown />}
                </button>
            </div>

            {isOpen && (
                <div className={styles.sectionBody}>
                    <div className={styles.serverControls}>
                        <div className={styles.searchBox}>
                            <FiSearch />
                            <input
                                type="text"
                                placeholder="Поиск серверов..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className={styles.quickBtns}>
                            <button onClick={() => setSelectedServers(servers.map(s => s.id))}>
                                <FiCheck /> Все
                            </button>
                            <button onClick={() => setSelectedServers([])}>
                                <FiX /> Сбросить
                            </button>
                        </div>
                    </div>

                    <div className={styles.serverList}>
                        {Object.entries(filteredServers).map(([groupName, groupServers]) => {
                            const allSelected = groupServers.every(s => selectedServers.includes(s.id));
                            const someSelected = groupServers.some(s => selectedServers.includes(s.id));

                            return (
                                <div key={groupName} className={styles.serverGroup}>
                                    <label className={styles.groupHeader}>
                                        <input
                                            type="checkbox"
                                            checked={allSelected}
                                            ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                                            onChange={() => toggleGroup(groupServers)}
                                        />
                                        <span>{groupName}</span>
                                        <span className={styles.groupCount}>
                                            {groupServers.filter(s => selectedServers.includes(s.id)).length}/{groupServers.length}
                                        </span>
                                    </label>
                                    <div className={styles.serverItems}>
                                        {groupServers.map(server => (
                                            <label key={server.id} className={styles.serverItem}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedServers.includes(server.id)}
                                                    onChange={() => toggleServer(server.id)}
                                                />
                                                <span className={styles.serverName}>{server.name}</span>
                                                <span className={styles.serverHost}>{server.host}:{server.port}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ServerSelector;

