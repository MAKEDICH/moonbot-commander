import React from 'react';
import { FiCheck } from 'react-icons/fi';
import styles from '../../pages/Groups.module.css';

// Модальное окно создания группы
export const CreateGroupModal = ({
  show,
  newGroupName,
  setNewGroupName,
  servers,
  selectedServers,
  onToggleServerSelection,
  onToggleSelectAll,
  onClose,
  onCreate
}) => {
  if (!show) return null;

  return (
    <div className={styles.modal} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modalContent}>
        <h2>Создать новую группу</h2>
        <div className={styles.formGroup}>
          <label>Название группы</label>
          <input
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="Например: Production"
            className={styles.input}
            autoFocus
          />
        </div>
        <div className={styles.formGroup}>
          <label>Серверы (необязательно)</label>
          <small style={{ display: 'block', marginBottom: '10px', color: 'var(--text-muted)' }}>
            Выберите серверы для добавления в группу или оставьте пустым
          </small>
          <div style={{ marginBottom: '12px' }}>
            <button type="button" className={styles.selectAllBtn} onClick={onToggleSelectAll}>
              {selectedServers.length === servers.length ? 'Снять все' : 'Выбрать все'}
            </button>
          </div>
          <div className={styles.serverSelectList}>
            {servers.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>Нет доступных серверов</p>
            ) : (
              servers.map(server => (
                <div
                  key={server.id}
                  className={`${styles.serverSelectItem} ${selectedServers.includes(server.id) ? styles.selected : ''}`}
                  onClick={() => onToggleServerSelection(server.id)}
                >
                  <div className={styles.checkbox}>
                    {selectedServers.includes(server.id) ? <FiCheck /> : <div className={styles.emptyCheckbox} />}
                  </div>
                  <div className={styles.serverInfo}>
                    <div className={styles.serverName}>{server.name}</div>
                    <div className={styles.serverHost}>
                      {server.host}:{server.port}
                      {server.group_name && ` • ${server.group_name}`}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        <div className={styles.modalActions}>
          <button className={styles.cancelBtn} onClick={onClose}>Отмена</button>
          <button className={styles.saveBtn} onClick={onCreate} disabled={!newGroupName.trim()}>
            Создать группу {selectedServers.length > 0 && `(${selectedServers.length})`}
          </button>
        </div>
      </div>
    </div>
  );
};

// Модальное окно перемещения серверов
export const MoveServersModal = ({
  show,
  targetGroup,
  setTargetGroup,
  groups,
  servers,
  selectedServers,
  onToggleServerSelection,
  onToggleSelectAll,
  onClose,
  onMove
}) => {
  if (!show) return null;

  return (
    <div className={styles.modal} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modalContent}>
        <h2>Добавить серверы в группу</h2>
        <div className={styles.formGroup}>
          <label>Целевая группа</label>
          <select value={targetGroup} onChange={(e) => setTargetGroup(e.target.value)} className={styles.input}>
            <option value="">Без группы</option>
            {groups.map(g => (
              <option key={g.name} value={g.name}>{g.name} ({g.servers.length})</option>
            ))}
          </select>
          <small>Или введите название новой группы:</small>
          <input
            type="text"
            value={targetGroup}
            onChange={(e) => setTargetGroup(e.target.value)}
            placeholder="Новая группа"
            className={styles.input}
          />
        </div>
        <div className={styles.formGroup}>
          <div className={styles.selectAllContainer}>
            <label>Выберите серверы ({selectedServers.length} выбрано)</label>
            <button type="button" className={styles.selectAllBtn} onClick={onToggleSelectAll}>
              {selectedServers.length === servers.filter(s => !targetGroup || s.group_name !== targetGroup).length
                ? '✓ Снять все' : '☐ Выбрать все'}
            </button>
          </div>
          <div className={styles.serverSelectList}>
            {servers.filter(s => !targetGroup || s.group_name !== targetGroup).map(server => (
              <div
                key={server.id}
                className={`${styles.serverSelectItem} ${selectedServers.includes(server.id) ? styles.selected : ''}`}
                onClick={() => onToggleServerSelection(server.id)}
              >
                <div className={styles.checkbox}>
                  {selectedServers.includes(server.id) ? <FiCheck /> : <div className={styles.emptyCheckbox} />}
                </div>
                <div className={styles.serverInfo}>
                  <div className={styles.serverName}>{server.name}</div>
                  <div className={styles.serverHost}>
                    {server.host}:{server.port}
                    {server.group_name && ` • ${server.group_name}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.modalActions}>
          <button className={styles.cancelBtn} onClick={onClose}>Отмена</button>
          <button className={styles.saveBtn} onClick={onMove} disabled={selectedServers.length === 0}>
            Добавить ({selectedServers.length})
          </button>
        </div>
      </div>
    </div>
  );
};

// Модальное окно переименования
export const RenameGroupModal = ({
  show,
  groupName,
  newRenameValue,
  setNewRenameValue,
  onClose,
  onRename
}) => {
  if (!show) return null;

  return (
    <div className={styles.modal} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modalContent}>
        <h2>Переименовать группу</h2>
        <div className={styles.formGroup}>
          <label>Новое название</label>
          <input
            type="text"
            value={newRenameValue}
            onChange={(e) => setNewRenameValue(e.target.value)}
            placeholder="Введите новое название"
            className={styles.input}
            autoFocus
            onKeyPress={(e) => e.key === 'Enter' && newRenameValue.trim() && onRename(groupName, newRenameValue)}
          />
        </div>
        <div className={styles.modalActions}>
          <button className={styles.cancelBtn} onClick={onClose}>Отмена</button>
          <button className={styles.saveBtn} onClick={() => onRename(groupName, newRenameValue)} disabled={!newRenameValue.trim()}>
            Переименовать
          </button>
        </div>
      </div>
    </div>
  );
};

// Модальное окно удаления
export const DeleteGroupModal = ({
  show,
  groupName,
  getGroupServers,
  onClose,
  onDelete
}) => {
  if (!show) return null;

  const serverCount = getGroupServers(groupName).length;

  return (
    <div className={styles.modal} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modalContent}>
        <h2>Удалить группу</h2>
        <p style={{ marginBottom: '20px', color: 'var(--text-secondary)' }}>
          {serverCount === 0
            ? `Вы уверены, что хотите удалить пустую группу "${groupName}"?`
            : `Вы уверены, что хотите удалить группу "${groupName}"? Серверы останутся в других группах (если есть).`
          }
        </p>
        <div className={styles.modalActions}>
          <button className={styles.cancelBtn} onClick={onClose}>Отмена</button>
          <button className={styles.saveBtn} onClick={onDelete} style={{ background: 'var(--error)' }}>
            Удалить
          </button>
        </div>
      </div>
    </div>
  );
};



