import React, { createContext, useState, useContext, useEffect } from 'react';
import { authAPI } from '../api/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      checkAuth();
    } else {
      setLoading(false);
    }
  }, [token]);

  const checkAuth = async () => {
    try {
      const response = await authAPI.me();
      setUser(response.data);
    } catch (error) {
      console.error('Auth check failed:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    try {
      const response = await authAPI.login(username, password);
      const { access_token, token_type, username: returnedUsername } = response.data;
      
      // Проверяем нужен ли 2FA
      if (token_type === '2fa_required') {
        return { 
          success: true, 
          requires2FA: true,
          username: returnedUsername 
        };
      }
      
      localStorage.setItem('token', access_token);
      setToken(access_token);
      await checkAuth();
      return { success: true, requires2FA: false };
    } catch (error) {
      return { 
        success: false, 
        requires2FA: false,
        error: error.response?.data?.detail || 'Ошибка входа' 
      };
    }
  };

  const register = async (username, email, password) => {
    try {
      const response = await authAPI.register({ username, email, password });
      // Не логиним автоматически - сначала показываем recovery коды
      return { 
        success: true,
        recovery_codes: response.data.recovery_codes
      };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.detail || 'Ошибка регистрации' 
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};



