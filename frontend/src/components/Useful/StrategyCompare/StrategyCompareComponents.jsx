/**
 * Под-компоненты для секции сравнения стратегий.
 * 
 * Содержит:
 * - FolderTree - рекурсивный рендер дерева папок/стратегий (виртуализированный)
 * - ComparisonTable - таблица сравнения параметров (виртуализированная)
 */

import React, { useState, useCallback, useMemo, memo, useRef } from 'react';
import { FixedSizeList as List } from 'react-window';
import styles from './StrategyCompare.module.css';

/**
 * Мемоизированный элемент стратегии
 */
const StrategyItem = memo(({ strategy, index, isSelected, onToggle }) => (
    <label className={styles.strategyItem}>
        <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggle(index)}
        />
        <span className={styles.strategyIcon}>📄</span>
        <span className={styles.strategyName}>
            {strategy?.strategyName}
        </span>
    </label>
));

StrategyItem.displayName = 'StrategyItem';

/**
 * Рекурсивный рендер дерева папок/стратегий (оптимизированный)
 */
export const FolderTree = memo(({ 
    items, 
    selectedIndexes, 
    onToggle, 
    allStrategies, 
    collapsedFolders, 
    toggleFolder 
}) => {
    // Для очень большого списка (>200) используем виртуализацию
    const flatStrategies = useMemo(() => {
        const result = [];
        const flatten = (items, depth = 0) => {
            items.forEach((item, idx) => {
                if (item.type === 'folder') {
                    const folderId = `folder-${item.name}-${depth}-${idx}`;
                    result.push({ ...item, folderId, depth, isFolderStart: true });
                    if (!collapsedFolders.has(folderId)) {
                        flatten(item.children, depth + 1);
                    }
                } else if (item.type === 'strategy') {
                    result.push({ ...item, depth });
                }
            });
        };
        flatten(items);
        return result;
    }, [items, collapsedFolders]);

    const useVirtualization = flatStrategies.length > 200;

    const Row = useCallback(({ index, style }) => {
        const item = flatStrategies[index];
        const paddingLeft = item.depth * 20;

        if (item.isFolderStart) {
            const isCollapsed = collapsedFolders.has(item.folderId);
            return (
                <div style={{ ...style, paddingLeft }} className={styles.folderNode}>
                    <div 
                        className={styles.folderHeader}
                        onClick={() => toggleFolder(item.folderId)}
                    >
                        <span className={styles.folderIcon}>
                            {isCollapsed ? '📁' : '📂'}
                        </span>
                        {item.name}
                    </div>
                </div>
            );
        }

        const strategy = allStrategies[item.index];
        const isSelected = selectedIndexes.has(item.index);

        return (
            <div style={{ ...style, paddingLeft }}>
                <StrategyItem
                    strategy={strategy}
                    index={item.index}
                    isSelected={isSelected}
                    onToggle={onToggle}
                />
            </div>
        );
    }, [flatStrategies, allStrategies, selectedIndexes, collapsedFolders, onToggle, toggleFolder]);

    if (useVirtualization) {
        return (
            <div className={styles.folderTreeVirtual}>
                <List
                    height={Math.min(flatStrategies.length * 32, 500)}
                    itemCount={flatStrategies.length}
                    itemSize={32}
                    width="100%"
                >
                    {Row}
                </List>
            </div>
        );
    }

    // Обычный рендер для небольшого списка
    return (
        <div className={styles.folderTree}>
            {items.map((item, idx) => {
                if (item.type === 'folder') {
                    const folderId = `folder-${item.name}-${idx}`;
                    const isCollapsed = collapsedFolders.has(folderId);
                    
                    return (
                        <div key={folderId} className={styles.folderNode}>
                            <div 
                                className={styles.folderHeader}
                                onClick={() => toggleFolder(folderId)}
                            >
                                <span className={styles.folderIcon}>
                                    {isCollapsed ? '📁' : '📂'}
                                </span>
                                {item.name}
                            </div>
                            {!isCollapsed && (
                                <div className={styles.folderChildren}>
                                    <FolderTree
                                        items={item.children}
                                        selectedIndexes={selectedIndexes}
                                        onToggle={onToggle}
                                        allStrategies={allStrategies}
                                        collapsedFolders={collapsedFolders}
                                        toggleFolder={toggleFolder}
                                    />
                                </div>
                            )}
                        </div>
                    );
                }
                
                if (item.type === 'strategy') {
                    const strategy = allStrategies[item.index];
                    const isSelected = selectedIndexes.has(item.index);
                    
                    return (
                        <StrategyItem
                            key={`strategy-${item.index}`}
                            strategy={strategy}
                            index={item.index}
                            isSelected={isSelected}
                            onToggle={onToggle}
                        />
                    );
                }
                
                return null;
            })}
        </div>
    );
});

FolderTree.displayName = 'FolderTree';

/**
 * Мемоизированная ячейка значения
 */
const ValueCell = memo(({ 
    value, 
    isSame, 
    trueColor, 
    falseColor, 
    strategyIndex, 
    param, 
    onUpdateValue 
}) => {
    const [localValue, setLocalValue] = useState(value);
    const timeoutRef = useRef(null);

    const handleChange = useCallback((e) => {
        const newVal = e.target.value;
        setLocalValue(newVal);
        
        // Debounce обновления
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            onUpdateValue(strategyIndex, param, newVal);
        }, 300);
    }, [strategyIndex, param, onUpdateValue]);

    // Синхронизация с внешним значением
    React.useEffect(() => {
        setLocalValue(value);
    }, [value]);

    return (
        <td 
            className={styles.valueCell}
            style={{ backgroundColor: isSame ? trueColor : falseColor }}
        >
            <input
                type="text"
                value={localValue}
                onChange={handleChange}
                className={styles.valueInput}
            />
        </td>
    );
});

ValueCell.displayName = 'ValueCell';

/**
 * Мемоизированная строка таблицы
 */
const TableRow = memo(({ row, strategies, trueColor, falseColor, onUpdateValue }) => (
    <tr>
        <td className={styles.paramName}>{row.param}</td>
        {row.values.map((val, colIdx) => (
            <ValueCell
                key={colIdx}
                value={val.value}
                isSame={val.isSame}
                trueColor={trueColor}
                falseColor={falseColor}
                strategyIndex={val.strategyIndex}
                param={row.param}
                onUpdateValue={onUpdateValue}
            />
        ))}
    </tr>
));

TableRow.displayName = 'TableRow';

/**
 * Таблица сравнения (оптимизированная)
 */
export const ComparisonTable = memo(({ 
    result, 
    trueColor, 
    falseColor, 
    onUpdateValue,
    onCopy 
}) => {
    const [copyIndexes, setCopyIndexes] = useState(new Set());
    const [selectAll, setSelectAll] = useState(false);
    const [visibleRows, setVisibleRows] = useState(100);
    
    const strategies = result?.strategies || [];
    const rows = result?.rows || [];
    const indexes = result?.indexes || [];
    
    // Показываем только часть строк для производительности
    const displayedRows = useMemo(() => {
        return rows.slice(0, visibleRows);
    }, [rows, visibleRows]);

    const handleLoadMore = useCallback(() => {
        setVisibleRows(prev => Math.min(prev + 100, rows.length));
    }, [rows.length]);
    
    const handleSelectAll = useCallback((checked) => {
        setSelectAll(checked);
        if (checked) {
            setCopyIndexes(new Set(indexes));
        } else {
            setCopyIndexes(new Set());
        }
    }, [indexes]);
    
    const toggleCopyIndex = useCallback((idx) => {
        setCopyIndexes(prev => {
            const newSet = new Set(prev);
            if (newSet.has(idx)) {
                newSet.delete(idx);
            } else {
                newSet.add(idx);
            }
            return newSet;
        });
    }, []);
    
    const handleCopy = useCallback(async () => {
        const text = onCopy(Array.from(copyIndexes));
        if (text) {
            try {
                await navigator.clipboard.writeText(text);
                alert('Скопировано в буфер обмена!');
            } catch (err) {
                console.error('Ошибка копирования:', err);
            }
        }
    }, [copyIndexes, onCopy]);
    
    if (!result) return null;
    
    return (
        <div className={styles.comparisonTableWrapper}>
            {rows.length > 100 && (
                <div className={styles.tableInfo}>
                    Показано {displayedRows.length} из {rows.length} параметров
                </div>
            )}
            
            <table className={styles.comparisonTable}>
                <thead>
                    <tr>
                        <th className={styles.paramHeader}>Параметр</th>
                        {strategies.map((st, idx) => (
                            <th key={idx} className={styles.strategyHeader}>
                                {st.strategyName}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {displayedRows.map((row, rowIdx) => (
                        <TableRow
                            key={rowIdx}
                            row={row}
                            strategies={strategies}
                            trueColor={trueColor}
                            falseColor={falseColor}
                            onUpdateValue={onUpdateValue}
                        />
                    ))}
                    
                    {/* Строка копирования */}
                    <tr className={styles.copyRow}>
                        <th className={styles.copyHeader}>
                            <label className={styles.selectAllLabel} title="Выбрать все стратегии для копирования">
                                <input
                                    type="checkbox"
                                    checked={selectAll}
                                    onChange={(e) => handleSelectAll(e.target.checked)}
                                />
                                Выбрать все
                            </label>
                            <button 
                                className={styles.copyButton}
                                onClick={handleCopy}
                                disabled={copyIndexes.size === 0}
                                title="Скопировать выбранные стратегии в буфер обмена в формате MoonBot"
                            >
                                📋 Скопировать
                            </button>
                        </th>
                        {indexes.map((idx, colIdx) => (
                            <td key={colIdx} className={styles.copyCell}>
                                <input
                                    type="checkbox"
                                    checked={copyIndexes.has(idx)}
                                    onChange={() => toggleCopyIndex(idx)}
                                />
                            </td>
                        ))}
                    </tr>
                </tbody>
            </table>
            
            {/* Кнопка загрузки ещё */}
            {visibleRows < rows.length && (
                <button 
                    className={styles.loadMoreBtn}
                    onClick={handleLoadMore}
                >
                    Показать ещё ({rows.length - visibleRows} осталось)
                </button>
            )}
        </div>
    );
});

ComparisonTable.displayName = 'ComparisonTable';
