/**
 * Main application header with navigation
 */

import React from 'react';
import {
  LayoutGrid,
  LineChart as LineChartIcon,
  TrendingUp,
  Moon,
  Sun,
  Menu,
  X,
  Settings,
  Sliders,
  PanelLeft
} from 'lucide-react';

export type ViewMode = 'overview' | 'detail' | 'dex' | 'monitors' | 'settings';

interface HeaderProps {
  viewMode: ViewMode;
  isMobile: boolean;
  isDarkMode: boolean;
  showMobileMenu: boolean;
  onViewModeChange: (mode: ViewMode) => void;
  onToggleDarkMode: () => void;
  onLogout: () => void;
  onToggleMobileMenu: () => void;
  onShowMobileLayoutEditor: () => void;
}

export function Header({
  viewMode,
  isMobile,
  isDarkMode,
  showMobileMenu,
  onViewModeChange,
  onToggleDarkMode,
  onLogout,
  onToggleMobileMenu,
  onShowMobileLayoutEditor
}: HeaderProps) {
  return (
    <header>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Matsu</h1>
          {!isMobile && <p>Monitor your Distill data in real-time</p>}
        </div>

        {isMobile ? (
          <>
            <button
              className="btn-secondary mobile-menu-btn"
              onClick={onToggleMobileMenu}
              style={{ padding: '8px' }}
            >
              {showMobileMenu ? <X size={20} /> : <Menu size={20} />}
            </button>

            {showMobileMenu && (
              <div className="mobile-menu-overlay" onClick={onToggleMobileMenu}>
                <div className="mobile-menu" onClick={(e) => e.stopPropagation()}>
                  <button
                    className={`mobile-menu-item ${viewMode === 'overview' ? 'active' : ''}`}
                    onClick={() => { onViewModeChange('overview'); onToggleMobileMenu(); }}
                  >
                    <LayoutGrid size={20} />
                    <span>Overview</span>
                  </button>
                  <button
                    className={`mobile-menu-item ${viewMode === 'detail' ? 'active' : ''}`}
                    onClick={() => { onViewModeChange('detail'); onToggleMobileMenu(); }}
                  >
                    <PanelLeft size={20} />
                    <span>Detail View</span>
                  </button>
                  <button
                    className={`mobile-menu-item ${viewMode === 'dex' ? 'active' : ''}`}
                    onClick={() => { onViewModeChange('dex'); onToggleMobileMenu(); }}
                  >
                    <TrendingUp size={20} />
                    <span>DEX Rates</span>
                  </button>
                  <button
                    className={`mobile-menu-item ${viewMode === 'monitors' ? 'active' : ''}`}
                    onClick={() => { onViewModeChange('monitors'); onToggleMobileMenu(); }}
                  >
                    <Sliders size={20} />
                    <span>Monitors</span>
                  </button>
                  <button
                    className={`mobile-menu-item ${viewMode === 'settings' ? 'active' : ''}`}
                    onClick={() => { onViewModeChange('settings'); onToggleMobileMenu(); }}
                  >
                    <Settings size={20} />
                    <span>Settings</span>
                  </button>
                  {viewMode === 'overview' && (
                    <button
                      className="mobile-menu-item"
                      onClick={() => { onShowMobileLayoutEditor(); onToggleMobileMenu(); }}
                    >
                      <Settings size={20} />
                      <span>Edit Layout</span>
                    </button>
                  )}
                  <button
                    className="mobile-menu-item"
                    onClick={() => { onToggleDarkMode(); onToggleMobileMenu(); }}
                  >
                    {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                    <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
                  </button>
                  <button
                    className="mobile-menu-item"
                    onClick={() => { onLogout(); onToggleMobileMenu(); }}
                  >
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              className={`btn-secondary ${viewMode === 'overview' ? 'active' : ''}`}
              onClick={() => onViewModeChange('overview')}
              title="Overview"
              style={{ padding: '8px 12px' }}
            >
              <LayoutGrid size={18} />
            </button>
            <button
              className={`btn-secondary ${viewMode === 'detail' ? 'active' : ''}`}
              onClick={() => onViewModeChange('detail')}
              title="Detail View"
              style={{ padding: '8px 12px' }}
            >
              <PanelLeft size={18} />
            </button>
            <button
              className={`btn-secondary ${viewMode === 'dex' ? 'active' : ''}`}
              onClick={() => onViewModeChange('dex')}
              title="DEX Rates"
              style={{ padding: '8px 12px' }}
            >
              <TrendingUp size={18} />
            </button>
            <button
              className={`btn-secondary ${viewMode === 'monitors' ? 'active' : ''}`}
              onClick={() => onViewModeChange('monitors')}
              title="Monitors"
              style={{ padding: '8px 12px' }}
            >
              <Sliders size={18} />
            </button>
            <button
              className={`btn-secondary ${viewMode === 'settings' ? 'active' : ''}`}
              onClick={() => onViewModeChange('settings')}
              title="Settings"
              style={{ padding: '8px 12px' }}
            >
              <Settings size={18} />
            </button>
            <button
              className="btn-secondary"
              onClick={onToggleDarkMode}
              title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              style={{ padding: '8px 12px' }}
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="btn-secondary" onClick={onLogout}>
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
