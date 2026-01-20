import React from 'react';
import { FiServer, FiPlus, FiGrid, FiList, FiDollarSign, FiPlay, FiPause, FiSettings, FiEye, FiEyeOff, FiAlertTriangle } from 'react-icons/fi';
import Tooltip from '../../components/Tooltip';
import PageHeader from '../PageHeader';
import styles from '../../pages/Servers.module.css';

/**
 * Шапка страницы серверов
 */
const ServersHeader = ({ 
  viewMode, 
  autoPingEnabled, 
  pingInterval,
  showPingSettings,
  hideAddresses,
  errorsCount = 0,
  onToggleView, 
  onToggleAutoPing, 
  onOpenPingSettings,
  onClosePingSettings,
  onPingIntervalChange,
  onSavePingInterval,
  onNavigateToBalances, 
  onNavigateToErrors,
  onAddServer,
  onToggleHideAddresses
}) => {
  return (
    <>
      <PageHeader 
        icon={<FiServer />} 
        title="Серверы" 
        gradient="cyan"
      >
        <Tooltip text={hideAddresses ? 'Показать IP и порты' : 'Скрыть IP и порты'} position="bottom">
          <button 
            onClick={onToggleHideAddresses}
            className={`${styles.hideAddressBtn} ${hideAddresses ? styles.hideAddressActive : ''}`}
          >
            {hideAddresses ? <FiEyeOff /> : <FiEye />}
          </button>
        </Tooltip>
        <button 
          onClick={onToggleView} 
          className={styles.viewToggleBtn}
          title={viewMode === 'full' ? 'Переключить на компактный вид' : 'Переключить на полный вид'}
        >
          {viewMode === 'full' ? <><FiList /> Компактный</> : <><FiGrid /> Полный</>}
        </button>
        <div className={styles.autoPingGroup}>
          <button 
            onClick={onToggleAutoPing} 
            className={`${styles.autoPingBtn} ${autoPingEnabled ? styles.autoPingActive : ''}`}
            title={autoPingEnabled ? 'Автопроверка включена' : 'Автопроверка выключена'}
          >
            {autoPingEnabled ? <FiPause /> : <FiPlay />}
            {autoPingEnabled ? 'Остановить автопроверку' : 'Запустить автопроверку'}
          </button>
          <button 
            onClick={onOpenPingSettings}
            className={styles.pingSettingsBtn}
            title={`Интервал опроса: ${pingInterval} сек`}
          >
            <FiSettings />
          </button>
        </div>
        <Tooltip text={errorsCount > 0 ? `${errorsCount} ошибок API за 24ч` : 'Нет ошибок API'} position="bottom">
          <button 
            className={`${styles.errorsBtn} ${errorsCount > 0 ? styles.errorsBtnActive : styles.errorsBtnOk}`}
            onClick={onNavigateToErrors}
          >
            <FiAlertTriangle />
            {errorsCount > 0 && <span className={styles.errorsCount}>{errorsCount}</span>}
          </button>
        </Tooltip>
        <Tooltip text="Посмотреть балансы всех серверов" position="bottom">
          <button 
            className={styles.balancesBtn} 
            onClick={onNavigateToBalances}
          >
            <FiDollarSign />
            Балансы
          </button>
        </Tooltip>
        <Tooltip text="Добавить новый MoonBot сервер для удаленного управления" position="bottom">
          <button className={styles.addBtn} onClick={onAddServer}>
            <FiPlus />
            Добавить сервер
          </button>
        </Tooltip>
      </PageHeader>

      {/* Модальное окно настроек интервала */}
      {showPingSettings && (
        <div 
          className={styles.pingSettingsModal}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClosePingSettings();
          }}
        >
          <div className={styles.pingSettingsContent}>
            <div className={styles.pingSettingsHeader}>
              <h3><FiSettings /> Настройки автопроверки</h3>
              <button onClick={onClosePingSettings} className={styles.closeBtn}>×</button>
            </div>
            <div className={styles.pingSettingsBody}>
              <label>Интервал опроса серверов (секунды)</label>
              <input
                type="number"
                min="5"
                max="3600"
                value={pingInterval}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '') {
                    onPingIntervalChange('');
                  } else {
                    const parsed = parseInt(value);
                    if (!isNaN(parsed)) {
                      onPingIntervalChange(parsed);
                    }
                  }
                }}
                onBlur={(e) => {
                  const value = e.target.value;
                  if (value === '') {
                    onPingIntervalChange(5);
                    return;
                  }
                  const parsed = parseInt(value);
                  if (isNaN(parsed) || parsed < 5) {
                    onPingIntervalChange(5);
                  } else if (parsed > 3600) {
                    onPingIntervalChange(3600);
                  }
                }}
                className={styles.pingIntervalInput}
              />
              <small>От 5 до 3600 секунд</small>
            </div>
            <div className={styles.pingSettingsFooter}>
              <button onClick={onSavePingInterval} className={styles.saveBtn}>
                Сохранить
              </button>
              <button onClick={onClosePingSettings} className={styles.cancelBtn}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ServersHeader;



