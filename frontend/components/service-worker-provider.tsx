'use client';

import { useEffect } from 'react';
import { useServiceWorker } from '@/hooks/useServiceWorker';

/**
 * Service Worker Provider Component
 * Registers and manages the Service Worker for background alert monitoring
 */
export function ServiceWorkerProvider({ children }: { children: React.ReactNode }) {
  const { requestNotificationPermission, isSupported } = useServiceWorker();

  useEffect(() => {
    if (isSupported) {
      // Request notification permission on first load
      requestNotificationPermission();
    }
  }, [isSupported, requestNotificationPermission]);

  return <>{children}</>;
}
