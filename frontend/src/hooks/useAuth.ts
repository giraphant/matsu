/**
 * Authentication hook
 */

import { useState, useEffect } from 'react';
import { authApi } from '../api/auth';
import { storage, STORAGE_KEYS } from '../utils/storage';

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if already logged in
    const auth = storage.get(STORAGE_KEYS.AUTH, null);
    if (auth === 'authenticated') {
      setIsAuthenticated(true);
    }
    setLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const response = await authApi.login(username, password);

      if (response.success) {
        storage.set(STORAGE_KEYS.AUTH, 'authenticated');
        storage.set(STORAGE_KEYS.USERNAME, username);
        setIsAuthenticated(true);
        return { success: true };
      }

      return { success: false, message: response.message || 'Login failed' };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to connect to server'
      };
    }
  };

  const logout = () => {
    storage.remove(STORAGE_KEYS.AUTH);
    storage.remove(STORAGE_KEYS.USERNAME);
    setIsAuthenticated(false);
  };

  return {
    isAuthenticated,
    loading,
    login,
    logout
  };
}
