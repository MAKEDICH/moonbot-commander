import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
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
import Commands from './pages/Commands';
import CommandsNew from './pages/CommandsNew';
import ScheduledCommands from './pages/ScheduledCommands';
import History from './pages/History';
import Groups from './pages/Groups';
import Trading from './pages/Trading';
import Layout from './components/Layout';
import InstallPWA from './components/InstallPWA';
import NetworkStatus from './components/NetworkStatus';

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
      
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="servers" element={<Servers />} />
        <Route path="groups" element={<Groups />} />
        <Route path="commands" element={<CommandsNew />} />
        <Route path="scheduled-commands" element={<ScheduledCommands />} />
        <Route path="history" element={<History />} />
        <Route path="trading/*" element={<Trading />} />
        <Route path="change-password" element={<ChangePassword />} />
        <Route path="2fa-setup" element={<TwoFactorSetup />} />
      </Route>
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  // РАЗМЫШЛЕНИЕ: ErrorBoundary должен обернуть ВСЕ приложение,
  // чтобы любая ошибка в любом компоненте была поймана
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <NetworkStatus />
          <AppRoutes />
          <InstallPWA />
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;

