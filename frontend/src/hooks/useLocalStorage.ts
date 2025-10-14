/**
 * LocalStorage hook with automatic sync
 */

import { useState, useEffect } from 'react';
import { storage } from '../utils/storage';

/**
 * Hook that syncs state with localStorage
 */
export function useLocalStorage<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(() => storage.get(key, defaultValue));

  useEffect(() => {
    storage.set(key, value);
  }, [key, value]);

  return [value, setValue] as const;
}

/**
 * Hook for managing Set in localStorage
 */
export function useLocalStorageSet(key: string, defaultValue: Set<string> = new Set()) {
  const [value, setValue] = useState<Set<string>>(() => {
    const stored = storage.get<string[]>(key, []);
    return new Set(stored);
  });

  useEffect(() => {
    storage.set(key, Array.from(value));
  }, [key, value]);

  const add = (item: string) => {
    setValue(prev => {
      const next = new Set(prev);
      next.add(item);
      return next;
    });
  };

  const remove = (item: string) => {
    setValue(prev => {
      const next = new Set(prev);
      next.delete(item);
      return next;
    });
  };

  const toggle = (item: string) => {
    setValue(prev => {
      const next = new Set(prev);
      if (next.has(item)) {
        next.delete(item);
      } else {
        next.add(item);
      }
      return next;
    });
  };

  return { value, setValue, add, remove, toggle };
}

/**
 * Hook for managing Map in localStorage
 */
export function useLocalStorageMap<V>(key: string, defaultValue: Map<string, V> = new Map()) {
  const [value, setValue] = useState<Map<string, V>>(() => {
    const stored = storage.get<Record<string, V>>(key, {});
    return new Map(Object.entries(stored));
  });

  useEffect(() => {
    storage.set(key, Object.fromEntries(value));
  }, [key, value]);

  const set = (k: string, v: V) => {
    setValue(prev => {
      const next = new Map(prev);
      next.set(k, v);
      return next;
    });
  };

  const remove = (k: string) => {
    setValue(prev => {
      const next = new Map(prev);
      next.delete(k);
      return next;
    });
  };

  return { value, setValue, set, remove };
}
