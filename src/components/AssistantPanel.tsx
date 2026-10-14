import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAssistantStore } from '../store/useAssistantStore';

// Tab-specific panels
import { ControlsView }  from './ControlsView';
import { TodayView }     from './TodayView';
import { StatsView }     from './StatsView';
import { ClipboardView } from './ClipboardView';
import { AppsView }      from './AppsView';
import { WallpaperView } from './WallpaperView';

export const AssistantPanel: React.FC = () => {
  const { isExpanded, currentMode } = useAssistantStore();

  const getHeightClass = () => {
    switch (currentMode) {
      case 'chat':     return 'h-[278px]'; // Controls (snug fit matching screenshot)
      case 'tasks':    return 'h-[282px]'; // Today (exact 3-column layout matching screenshot)
      case 'screen':   return 'h-[282px]'; // Stats (snug fit matching screenshot)
      case 'tools':    return 'h-[450px]'; // Clipboard
      case 'voice':    return 'h-[440px]'; // Apps (matches launcher screenshot)
      case 'settings': return 'h-[268px]'; // Wallpaper (compact snug fit matching screenshot)
      default:         return 'h-[400px]';
    }
  };

  const getWidthClass = () => {
    switch (currentMode) {
      case 'tasks':    return 'w-[610px]'; // Snug fit for 3 columns side-by-side
      case 'screen':   return 'w-[640px]'; // Snug fit for 3 gauges + right apps column
      default:         return 'w-[580px]';
    }
  };

  return (
    <AnimatePresence mode="wait">
      {isExpanded && (
        <motion.div
          key={currentMode}
          initial={{ opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 480, damping: 32 }}
          className={`notch-panel ${getWidthClass()} ${getHeightClass()} border-none bg-black`}
        >
          {currentMode === 'chat'     && <ControlsView  />}
          {currentMode === 'tasks'    && <TodayView     />}
          {currentMode === 'screen'   && <StatsView     />}
          {currentMode === 'tools'    && <ClipboardView />}
          {currentMode === 'voice'    && <AppsView      />}
          {currentMode === 'settings' && <WallpaperView />}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
