import React from 'react';
import styles from './Servers.module.css';
import {
  ServersHeader,
  ServerCard,
  EmptyState,
  ServerModal,
  useServers
} from '../components/Servers';

/**
 * Страница управления серверами
 */
const Servers = () => {
  const {
    servers,
    loading,
    showModal,
    setShowModal,
    editingServer,
    testingServer,
    testingServers,
    listenerStatuses,
    actionLoading,
    viewMode,
    autoPingEnabled,
    pingInterval,
    showPingSettings,
    setShowPingSettings,
    hideAddresses,
    errorsCount,
    formData,
    setFormData,
    navigate,
    handleSubmit,
    handleDelete,
    handleTest,
    handleEdit,
    handleCloseModal,
    handleListenerStart,
    handleListenerStop,
    toggleViewMode,
    toggleAutoPing,
    toggleHideAddresses,
    handlePingIntervalChange,
    savePingInterval
  } = useServers();

  if (loading) {
    return <div className={styles.loading}>Загрузка...</div>;
  }

  return (
    <div className={styles.servers}>
      <ServersHeader
        viewMode={viewMode}
        autoPingEnabled={autoPingEnabled}
        pingInterval={pingInterval}
        showPingSettings={showPingSettings}
        hideAddresses={hideAddresses}
        errorsCount={errorsCount}
        onToggleView={toggleViewMode}
        onToggleAutoPing={toggleAutoPing}
        onOpenPingSettings={() => setShowPingSettings(true)}
        onClosePingSettings={() => setShowPingSettings(false)}
        onPingIntervalChange={handlePingIntervalChange}
        onSavePingInterval={savePingInterval}
        onNavigateToBalances={() => navigate('/balances')}
        onNavigateToErrors={() => navigate('/api-errors')}
        onAddServer={() => setShowModal(true)}
        onToggleHideAddresses={toggleHideAddresses}
      />

      {servers.length === 0 ? (
        <EmptyState onAddServer={() => setShowModal(true)} />
      ) : (
        <div className={`${styles.serverGrid} ${viewMode === 'compact' ? styles.compactView : ''}`}>
          {servers.map((server) => (
            <ServerCard
              key={server.id}
              server={server}
              viewMode={viewMode}
              isTesting={testingServer === server.id}
              listenerStatus={listenerStatuses[server.id]}
              actionLoading={actionLoading}
              hideAddresses={hideAddresses}
              onTest={handleTest}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onListenerStart={handleListenerStart}
              onListenerStop={handleListenerStop}
            />
          ))}
        </div>
      )}

      <ServerModal
        show={showModal}
        editingServer={editingServer}
        formData={formData}
        onFormChange={setFormData}
        onSubmit={handleSubmit}
        onClose={handleCloseModal}
      />
    </div>
  );
};

export default Servers;
