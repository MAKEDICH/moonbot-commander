/**
 * Строка таблицы TriggersHub
 */
import React, { useState, useEffect } from 'react';
import styles from '../styles/table.module.css';
import { extractNumsList } from '../useTriggersHub';
import NumberChip from './NumberChip';

/**
 * Получение baseline для сравнения (Forward baseline)
 */
const getBaselineValue = (stg, param, value) => {
    const hasBF = stg.baselineForwardParams && Object.prototype.hasOwnProperty.call(stg.baselineForwardParams, param);
    return hasBF ? stg.baselineForwardParams[param] : (stg.originalParams?.[param] ?? value);
};

const TableRow = ({ row, isSelected, isHit, isChanged, onSelect, onValueChange, onToggleChip, showFolder }) => {
    const [value, setValue] = useState(row.stg.params[row.param]);
    
    // Синхронизация с props при изменении извне
    useEffect(() => {
        setValue(row.stg.params[row.param]);
    }, [row.stg.params[row.param]]);
    
    // Вычисляем текущие номера из ЛОКАЛЬНОГО value (для мгновенного отображения)
    const curNums = row.type === 'Seconds' ? [] : extractNumsList(value || '');
    // Базовые номера из baselineForwardParams (или originalParams если нет)
    const baseVal = getBaselineValue(row.stg, row.param, row.value);
    const baseNums = row.type === 'Seconds' ? [] : extractNumsList(baseVal);
    
    // Объединяем все номера для отображения
    const allNums = [...new Set([...curNums, ...baseNums])].sort((a, b) => a - b);
    
    let className = '';
    if (isSelected) className += ` ${styles.trSelected}`;
    if (isHit) className += ` ${styles.trHit}`;
    if (isChanged) className += ` ${styles.trChanged}`;
    
    const handleValueChange = (e) => {
        setValue(e.target.value);
    };
    
    const handleBlur = () => {
        if (value !== row.stg.params[row.param]) {
            onValueChange(row.stg, row.param, value);
        }
    };
    
    // Проверяем добавлен/удалён номер
    const isNumAdded = (n) => curNums.includes(n) && !baseNums.includes(n);
    const isNumRemoved = (n) => baseNums.includes(n) && !curNums.includes(n);
    
    return (
        <tr className={className} onClick={() => onSelect(row)}>
            <td>{row.strategy}</td>
            {showFolder && <td>{row.folder}</td>}
            <td>{row.param}</td>
            <td>{row.type}</td>
            <td className={styles.tdValue}>
                <textarea
                    className={styles.valueTextarea}
                    value={value}
                    onChange={handleValueChange}
                    onBlur={handleBlur}
                    onClick={(e) => e.stopPropagation()}
                    rows={1}
                />
            </td>
            <td className={styles.tdNumbers}>
                <div className={styles.nums}>
                    {allNums.map(n => (
                        <NumberChip
                            key={n}
                            num={n}
                            type={row.type}
                            isAdded={isNumAdded(n)}
                            isRemoved={isNumRemoved(n)}
                            onToggleGlobal={onToggleChip}
                        />
                    ))}
                </div>
            </td>
        </tr>
    );
};

export default TableRow;

