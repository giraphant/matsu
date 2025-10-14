/**
 * Theme management hook
 */

import { useState, useEffect } from 'react';
import { storage, STORAGE_KEYS } from '../utils/storage';

export function useTheme() {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = storage.get<string>(STORAGE_KEYS.THEME, 'light');
    return savedTheme === 'dark';
  });

  useEffect(() => {
    // Apply theme to document
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      storage.set(STORAGE_KEYS.THEME, 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      storage.set(STORAGE_KEYS.THEME, 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

  return {
    isDarkMode,
    toggleTheme,
    setDarkMode: setIsDarkMode
  };
}
