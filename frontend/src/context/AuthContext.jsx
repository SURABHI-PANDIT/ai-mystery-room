import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ApiError, apiRequest } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState('');

  const refreshSession = useCallback(async () => {
    setLoading(true);
    setSessionError('');
    try {
      const result = await apiRequest('/auth/me');
      setUser(result.data.user);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setUser(null);
      } else {
        setSessionError(error.message || 'Could not check your session.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const register = useCallback(async (details) => {
    const result = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(details),
    });
    setUser(result.data.user);
    return result.data.user;
  }, []);

  const login = useCallback(async (credentials) => {
    const result = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    setUser(result.data.user);
    return result.data.user;
  }, []);

  const logout = useCallback(async () => {
    await apiRequest('/auth/logout', { method: 'POST' });
    setUser(null);
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    sessionError,
    refreshSession,
    register,
    login,
    logout,
  }), [user, loading, sessionError, refreshSession, register, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}
