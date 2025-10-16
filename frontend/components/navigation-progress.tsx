'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import NProgress from 'nprogress';

// Configure NProgress
NProgress.configure({
  showSpinner: false,
  trickleSpeed: 80,
  minimum: 0.2,
  speed: 400,
  easing: 'ease',
  positionUsing: 'translate3d',
});

export function NavigationProgress() {
  const pathname = usePathname();

  useEffect(() => {
    // Use event delegation to handle all link clicks
    const handleClick = (event: MouseEvent) => {
      const target = (event.target as HTMLElement).closest('a');

      if (target && target.href) {
        const url = new URL(target.href);
        const currentUrl = new URL(window.location.href);

        // Only start progress for internal navigation to different pages
        if (
          url.origin === currentUrl.origin &&
          url.pathname !== currentUrl.pathname &&
          !target.getAttribute('target')
        ) {
          console.log('[NProgress] Starting navigation to:', url.pathname);
          NProgress.start();
        }
      }
    };

    // Listen for browser back/forward
    const handlePopState = () => {
      NProgress.start();
    };

    // Use event delegation on document
    document.addEventListener('click', handleClick);
    window.addEventListener('popstate', handlePopState);

    return () => {
      document.removeEventListener('click', handleClick);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Complete progress when pathname changes
  useEffect(() => {
    console.log('[NProgress] Navigation complete, pathname:', pathname);
    NProgress.done();
  }, [pathname]);

  return null;
}
