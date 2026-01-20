import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { ConfirmProvider } from './context/ConfirmContext';
import { AutoPingProvider } from './context/AutoPingContext';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './pages/Login';
import Register from './pages/Register';
import RecoveryCodes from './pages/RecoveryCodes';
import RecoverPassword from './pages/RecoverPassword';
import ChangePassword from './pages/ChangePassword';
import TwoFactorSetup from './pages/TwoFactorSetup';
import TwoFactorSetupRegister from './pages/TwoFactorSetupRegister';
import TwoFactorVerify from './pages/TwoFactorVerify';
import Recover2FAPassword from './pages/Recover2FAPassword';
import Dashboard from './pages/Dashboard';
import Servers from './pages/Servers';
import Balances from './pages/Balances';
import CommandsNew from './pages/CommandsNew';
import ScheduledCommands from './pages/ScheduledCommands';
import History from './pages/History';
import Groups from './pages/Groups';
import Trading from './pages/Trading';
import Layout from './components/Layout';
import InstallPWA from './components/InstallPWA';
import NetworkStatus from './components/NetworkStatus';
import ColumnSettings from './pages/ColumnSettings';
import APIErrors from './pages/APIErrors';
import Updates from './pages/Updates';
import DataBackup from './pages/DataBackup';
import Documentation from './pages/Documentation';
import UpdateNotification from './components/UpdateNotification';

const PrivateRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <div>Загрузка...</div>
    </div>;
  }
  
  return isAuthenticated ? children : <Navigate to="/login" />;
};

const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <div>Загрузка...</div>
    </div>;
  }
  
  return !isAuthenticated ? children : <Navigate to="/dashboard" />;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      <Route path="/recovery-codes" element={<RecoveryCodes />} />
      <Route path="/recover-password" element={<PublicRoute><RecoverPassword /></PublicRoute>} />
      <Route path="/2fa-verify" element={<TwoFactorVerify />} />
      <Route path="/2fa-recover" element={<PublicRoute><Recover2FAPassword /></PublicRoute>} />
      <Route path="/2fa-setup-register" element={<TwoFactorSetupRegister />} />
      
      <Route path="/" element={<PrivateRoute><AutoPingProvider><Layout /></AutoPingProvider></PrivateRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="servers" element={<Servers />} />
        <Route path="balances" element={<Balances />} />
        <Route path="groups" element={<Groups />} />
        <Route path="commands" element={<CommandsNew />} />
        <Route path="scheduled-commands" element={<ScheduledCommands />} />
        <Route path="history" element={<History />} />
        <Route path="trading/*" element={<Trading />} />
        <Route path="column-settings" element={<ColumnSettings />} />
        <Route path="api-errors" element={<APIErrors />} />
        <Route path="updates" element={<Updates />} />
        <Route path="backup" element={<DataBackup />} />
        <Route path="docs" element={<Documentation />} />
        <Route path="change-password" element={<ChangePassword />} />
        <Route path="2fa-setup" element={<TwoFactorSetup />} />
      </Route>
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function AppContent() {
  const { token } = useAuth();
  
  return (
    <NotificationProvider>
      <ConfirmProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <NetworkStatus />
          <AppRoutes />
          <InstallPWA />
          {token && <UpdateNotification token={token} />}
        </Router>
      </ConfirmProvider>
    </NotificationProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <ErrorBoundary>
        <AppContent />
      </ErrorBoundary>
    </AuthProvider>
  );
}

export default App;

