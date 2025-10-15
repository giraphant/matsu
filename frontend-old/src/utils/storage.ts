/**
 * LocalStorage utility functions
 */

export const storage = {
  /**
   * Get item from localStorage with type safety
   */
  get<T>(key: string, defaultValue: T): T {
    try {
      const item = localStorage.getItem(key);
      if (!item) return defaultValue;
      return JSON.parse(item);
    } catch {
      return defaultValue;
    }
  },

  /**
   * Set item in localStorage
   */
  set(key: string, value: any): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }
  },

  /**
   * Remove item from localStorage
   */
  remove(key: string): void {
    localStorage.removeItem(key);
  },

  /**
   * Clear all items from localStorage
   */
  clear(): void {
    localStorage.clear();
  }
};

/**
 * Storage keys constants
 */
export const STORAGE_KEYS = {
  AUTH: 'auth',
  USERNAME: 'username',
  THEME: 'theme',
  HIDDEN_MONITORS: 'hiddenMonitors',
  MONITOR_TAGS: 'monitorTags',
  MONITOR_NAMES: 'monitorNames',
  GRID_LAYOUT: 'gridLayout',
} as const;
