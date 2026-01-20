import React, { useRef, useEffect, useCallback, memo, useMemo, useState } from 'react';
import { FixedSizeList as List } from 'react-window';
import { FiCopy, FiX, FiCheck } from 'react-icons/fi';
import styles from '../../pages/StrategyCommander.module.css';
import { buildSetParamCommand } from './strategyUtils';

// Модальное окно для редактирования значения
const EditModal = memo(({ isOpen, onClose, paramName, strategyName, value, onSave }) => {
  const [localValue, setLocalValue] = useState(value);
  const textareaRef = useRef(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(localValue);
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter' && e.ctrlKey) {
      handleSave();
    }
  };

  return (
    <div className={styles.editModalOverlay} onClick={onClose}>
      <div className={styles.editModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.editModalHeader}>
          <h3>Редактирование параметра</h3>
          <button className={styles.editModalClose} onClick={onClose}>
            <FiX />
          </button>
        </div>
        <div className={styles.editModalBody}>
          <div className={styles.editModalInfo}>
            <span className={styles.editModalLabel}>Стратегия:</span>
            <span className={styles.editModalValue}>{strategyName}</span>
          </div>
          <div className={styles.editModalInfo}>
            <span className={styles.editModalLabel}>Параметр:</span>
            <span className={styles.editModalValue}>{paramName}</span>
          </div>
          <div className={styles.editModalField}>
            <label>Значение:</label>
            <textarea
              ref={textareaRef}
              value={localValue}
              onChange={(e) => setLocalValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className={styles.editModalTextarea}
              rows={5}
            />
          </div>
          <div className={styles.editModalHint}>
            Ctrl+Enter для сохранения, Esc для отмены
          </div>
        </div>
        <div className={styles.editModalFooter}>
          <button className={styles.editModalCancel} onClick={onClose}>
            Отмена
          </button>
          <button className={styles.editModalSave} onClick={handleSave}>
            <FiCheck /> Сохранить
          </button>
        </div>
      </div>
    </div>
  );
});

EditModal.displayName = 'EditModal';

// Мемоизированная строка таблицы
const TableRow = memo(({ 
  row, 
  tableData, 
  onParamChange,
  onEditClick,
  columnWidths,
  style 
}) => {
  const oldVal = row.stgObj.originalParams[row.paramName];
  const newVal = row.stgObj.params[row.paramName];
  const isChanged = oldVal !== newVal;
  const who = row.stgObj.commandTarget || row.stgObj.name;

  return (
    <div 
      className={`${styles.virtualRow} ${isChanged ? styles.changed : ''}`}
      style={style}
    >
      {tableData.showStrategyColumn && (
        <div className={styles.virtualCell} style={{ width: columnWidths[0], minWidth: columnWidths[0] }}>
          {row.strategyName}
        </div>
      )}
      <div 
        className={`${styles.virtualCell} ${styles.clickableCell}`} 
        style={{ width: columnWidths[1], minWidth: columnWidths[1] }}
        onClick={() => onEditClick(row)}
        title="Нажмите для редактирования"
      >
        {row.paramName}
      </div>
      <div className={styles.virtualCell} style={{ width: columnWidths[2], minWidth: columnWidths[2] }}>
        <input
          type="text"
          value={newVal}
          onChange={(e) => onParamChange(row.stgObj, row.paramName, e.target.value)}
          className={styles.editInput}
          title={newVal}
        />
      </div>
      <div className={styles.virtualCell} style={{ width: columnWidths[3], minWidth: columnWidths[3] }}>
        {isChanged && `${oldVal} → ${newVal}`}
      </div>
      <div className={styles.virtualCell} style={{ flex: 1 }}>
        <span className={styles.command}>
          {buildSetParamCommand(who, row.paramName, newVal)}
        </span>
      </div>
    </div>
  );
});

TableRow.displayName = 'TableRow';

// Компонент заголовка с ресайзером
const HeaderCell = memo(({ 
  title, 
  width, 
  onResize, 
  onCopy, 
  showCopy = false,
  isLast = false 
}) => {
  const cellRef = useRef(null);
  const [isResizing, setIsResizing] = useState(false);

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = cellRef.current.offsetWidth;

    const handleMouseMove = (e) => {
      const newWidth = Math.max(80, startWidth + (e.clientX - startX));
      onResize(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    <div 
      ref={cellRef}
      className={styles.virtualHeaderCell} 
      style={{ width: isLast ? undefined : width, minWidth: isLast ? undefined : width, flex: isLast ? 1 : undefined }}
    >
      <span>{title}</span>
      {showCopy && (
        <button 
          type="button"
          className={styles.copyIcon} 
          onClick={onCopy}
          title="Скопировать столбец"
        >
          <FiCopy />
        </button>
      )}
      {!isLast && (
        <div 
          className={`${styles.columnResizer} ${isResizing ? styles.resizing : ''}`}
          onMouseDown={handleMouseDown}
        />
      )}
    </div>
  );
});

HeaderCell.displayName = 'HeaderCell';

const StrategyTable = ({ 
  tableData, 
  onParamChange, 
  onCopyColumn,
  resizingRef,
  strategiesCount = 0
}) => {
  const listRef = useRef(null);
  
  // Ширины столбцов
  const [columnWidths, setColumnWidths] = useState([200, 180, 150, 180]);
  
  // Модальное окно редактирования
  const [editModal, setEditModal] = useState({
    isOpen: false,
    row: null
  });

  const handleResize = useCallback((index, newWidth) => {
    setColumnWidths(prev => {
      const updated = [...prev];
      updated[index] = newWidth;
      return updated;
    });
  }, []);

  const handleEditClick = useCallback((row) => {
    setEditModal({
      isOpen: true,
      row
    });
  }, []);

  const handleEditSave = useCallback((newValue) => {
    if (editModal.row) {
      onParamChange(editModal.row.stgObj, editModal.row.paramName, newValue);
    }
  }, [editModal.row, onParamChange]);

  const handleEditClose = useCallback(() => {
    setEditModal({ isOpen: false, row: null });
  }, []);

  // Мемоизированный Row renderer для react-window
  const Row = useCallback(({ index, style }) => {
    const row = tableData.rows[index];
    return (
      <TableRow
        row={row}
        tableData={tableData}
        onParamChange={onParamChange}
        onEditClick={handleEditClick}
        columnWidths={columnWidths}
        style={style}
      />
    );
  }, [tableData, onParamChange, handleEditClick, columnWidths]);

  // Высота контейнера
  const containerHeight = useMemo(() => {
    return Math.min(tableData.rows.length * 40, 600);
  }, [tableData.rows.length]);

  // Копирование столбца
  const handleCopyColumn = useCallback((colIndex) => {
    const values = tableData.rows.map(row => {
      const who = row.stgObj.commandTarget || row.stgObj.name;
      const newVal = row.stgObj.params[row.paramName];
      
      switch(colIndex) {
        case 0: return row.strategyName;
        case 1: return row.paramName;
        case 2: return newVal;
        case 3: 
          const oldVal = row.stgObj.originalParams[row.paramName];
          return oldVal !== newVal ? `${oldVal} → ${newVal}` : '';
        case 4: return buildSetParamCommand(who, row.paramName, newVal);
        default: return '';
      }
    }).filter(v => v);
    
    navigator.clipboard.writeText(values.join('\n'));
  }, [tableData.rows]);

  if (tableData.rows.length === 0) return null;

  // Для малого количества строк используем обычную таблицу
  const useVirtualization = tableData.rows.length > 100;

  const baseColIndex = tableData.showStrategyColumn ? 0 : -1;

  return (
    <div className={styles.tableContainer}>
      {/* Счётчик стратегий */}
      {strategiesCount > 0 && (
        <div className={styles.tableStats}>
          <div className={styles.statItem}>
            <span className={styles.statIcon}>📊</span>
            <span className={styles.statLabel}>Загружено стратегий:</span>
            <span className={styles.statValue}>{strategiesCount}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statIcon}>📋</span>
            <span className={styles.statLabel}>Параметров в таблице:</span>
            <span className={styles.statValue}>{tableData.rows.length}</span>
          </div>
        </div>
      )}

      {/* Заголовок */}
      <div className={styles.virtualHeader}>
        {tableData.showStrategyColumn && (
          <HeaderCell
            title="Стратегия"
            width={columnWidths[0]}
            onResize={(w) => handleResize(0, w)}
            onCopy={() => handleCopyColumn(0)}
            showCopy={true}
          />
        )}
        <HeaderCell
          title="Параметр"
          width={columnWidths[1]}
          onResize={(w) => handleResize(1, w)}
          onCopy={() => handleCopyColumn(1)}
          showCopy={true}
        />
        <HeaderCell
          title="Значение"
          width={columnWidths[2]}
          onResize={(w) => handleResize(2, w)}
          onCopy={() => handleCopyColumn(2)}
          showCopy={true}
        />
        <HeaderCell
          title="Изменение"
          width={columnWidths[3]}
          onResize={(w) => handleResize(3, w)}
          onCopy={() => handleCopyColumn(3)}
          showCopy={true}
        />
        <HeaderCell
          title="Команда"
          width={0}
          onResize={() => {}}
          onCopy={() => handleCopyColumn(4)}
          showCopy={true}
          isLast={true}
        />
      </div>

      {/* Виртуализированный список или обычная таблица */}
      {useVirtualization ? (
        <List
          ref={listRef}
          height={containerHeight}
          itemCount={tableData.rows.length}
          itemSize={40}
          width="100%"
          className={styles.virtualList}
        >
          {Row}
        </List>
      ) : (
        <div className={styles.normalTableBody}>
          {tableData.rows.map((row, index) => (
            <TableRow
              key={index}
              row={row}
              tableData={tableData}
              onParamChange={onParamChange}
              onEditClick={handleEditClick}
              columnWidths={columnWidths}
              style={{}}
            />
          ))}
        </div>
      )}

      {/* Показываем счётчик */}
      {tableData.rows.length > 50 && (
        <div className={styles.rowCount}>
          Показано строк: {tableData.rows.length}
        </div>
      )}

      {/* Модальное окно редактирования */}
      <EditModal
        isOpen={editModal.isOpen}
        onClose={handleEditClose}
        paramName={editModal.row?.paramName || ''}
        strategyName={editModal.row?.strategyName || ''}
        value={editModal.row?.stgObj.params[editModal.row?.paramName] || ''}
        onSave={handleEditSave}
      />
    </div>
  );
};

export default memo(StrategyTable);
