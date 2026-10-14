import React, { useState, useRef, useEffect } from 'react';
import {
  Sliders,
  Palette,
  Power,
  Clipboard,
  LayoutGrid,
  Sun,
  BarChart2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAssistantStore } from '../store/useAssistantStore';
import { AppMode } from '../types/assistant';

type TabId = AppMode | 'power';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const TABS: Tab[] = [
  { id: 'chat',     label: 'Controls',  icon: <Sliders    className="w-3 h-3 stroke-[2.2]" /> },
  { id: 'tasks',    label: 'Today',     icon: <Sun        className="w-3 h-3 stroke-[2.2]" /> },
  { id: 'screen',   label: 'Stats',     icon: <BarChart2  className="w-3 h-3 stroke-[2.2]" /> },
  { id: 'tools',    label: 'Clipboard', icon: <Clipboard  className="w-3 h-3 stroke-[2.2]" /> },
  { id: 'voice',    label: 'Apps',      icon: <LayoutGrid className="w-3 h-3 stroke-[2.2]" /> },
  { id: 'settings', label: 'Wallpaper', icon: <Palette    className="w-3 h-3 stroke-[2.2]" /> },
  { id: 'power',    label: 'Power',     icon: <Power      className="w-3 h-3 stroke-[2.2]" /> },
];

export const FloatingPill: React.FC = () => {
  const {
    isExpanded,
    currentMode,
    setExpanded,
    setMode,
    isHovered: storeHovered,
    setHovered: setStoreHovered,
  } = useAssistantStore();

  const [localHovered, setLocalHovered] = useState(false);
  const leaveTimerRef = useRef<number | null>(null);

  const isVisible = localHovered || storeHovered || isExpanded;

  const handleMouseEnter = () => {
    if (leaveTimerRef.current) {
      window.clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    setLocalHovered(true);
    setStoreHovered(true);
  };

  const handleMouseLeave = () => {
    leaveTimerRef.current = window.setTimeout(() => {
      setLocalHovered(false);
      setStoreHovered(false);
    }, 380);
  };

  useEffect(() => {
    return () => {
      if (leaveTimerRef.current) {
        window.clearTimeout(leaveTimerRef.current);
      }
    };
  }, []);

  const handleTabClick = (tab: Tab) => {
    if (tab.id === 'power') {
      setExpanded(false);
      setLocalHovered(false);
      setStoreHovered(false);
      return;
    }
    const mode = tab.id as AppMode;
    if (isExpanded && currentMode === mode) {
      setExpanded(false);
    } else {
      setMode(mode);
      setExpanded(true);
    }
  };

  return (
    <div
      className="notch-hover-wrapper pt-0 pb-4 px-10 cursor-pointer flex justify-center tauri-no-drag"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={() => {
        if (!isVisible) {
          setLocalHovered(true);
          setStoreHovered(true);
        }
      }}
    >
      <motion.header
        layout
        initial={false}
        animate={
          isVisible
            ? {
                height: 28,
                borderRadius: '0 0 14px 14px',
                paddingLeft: 8,
                paddingRight: 8,
                backgroundColor: '#000000',
                boxShadow: 'none',
              }
            : {
                height: 3,
                borderRadius: '0 0 0 0',
                paddingLeft: 0,
                paddingRight: 0,
                backgroundColor: 'transparent',
                boxShadow: 'none',
              }
        }
        transition={{
          type: 'spring',
          stiffness: 460,
          damping: 32,
        }}
        style={{
          backdropFilter: isVisible ? 'blur(40px)' : 'none',
          WebkitBackdropFilter: isVisible ? 'blur(40px)' : 'none',
          overflow: isVisible ? 'hidden' : 'visible',
        }}
        className="notch-island tauri-no-drag flex items-center justify-center border-none"
      >
        <AnimatePresence mode="wait">
          {isVisible ? (
            <motion.nav
              key="tabs-expanded"
              initial={{ opacity: 0, y: -4, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -3, scale: 0.94 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              aria-label="Assistant modes"
              className="notch-tabs tauri-no-drag flex items-center"
            >
              {TABS.map((tab) => {
                const isActive = isExpanded && tab.id !== 'power' && currentMode === (tab.id as AppMode);
                const isPower  = tab.id === 'power';

                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabClick(tab)}
                    className={
                      'notch-tab relative flex items-center gap-1.5 ' +
                      (isActive ? ' text-white font-medium' : '') +
                      (isPower  ? ' notch-tab--power'  : '')
                    }
                    title={tab.label}
                    aria-pressed={isActive}
                  >
                    {/* Animated gliding active pill background */}
                    {isActive && (
                      <motion.div
                        layoutId="activeTabPill"
                        className="absolute inset-0 subtle-app-accent border border-app-accent rounded-full -z-10"
                        style={{
                          boxShadow: '0 0 12px var(--app-accent-glow)',
                        }}
                        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                      />
                    )}
                    <span className="relative z-10" style={{ color: isActive ? 'var(--app-accent)' : undefined }}>
                      {tab.icon}
                    </span>
                    <span className="notch-tab-label relative z-10" style={{ color: isActive ? '#ffffff' : undefined }}>
                      {tab.label}
                    </span>
                  </button>
                );
              })}
            </motion.nav>
          ) : (
            <motion.div
              key="notch-line"
              initial={{ opacity: 0, scaleX: 0.8 }}
              animate={{ opacity: 1, scaleX: 1 }}
              exit={{ opacity: 0, scaleX: 0.8 }}
              transition={{ duration: 0.15 }}
              className="flex items-center justify-center cursor-pointer group bg-transparent py-0 px-0"
            >
              <div
                className="w-24 h-[3px] rounded-full transition-all group-hover:scale-105 bg-white opacity-100"
                style={{
                  backgroundColor: '#ffffff',
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>
    </div>
  );
};
