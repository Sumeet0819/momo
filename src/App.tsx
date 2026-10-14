import { useEffect, useRef } from 'react';
import { FloatingPill } from './components/FloatingPill';
import { AssistantPanel } from './components/AssistantPanel';
import { useAssistantStore } from './store/useAssistantStore';
import { accentService } from './services/accentService';

export function App() {
  const { isExpanded, isPinned, setExpanded, setHovered, setMode, settings } = useAssistantStore();
  const leaveTimerRef = useRef<number | null>(null);

  // Initialize wallpaper-driven accent on mount
  useEffect(() => {
    const initAccent = async () => {
      try {
        const saved = localStorage.getItem('boty_recent_wallpapers');
        if (saved) {
          const list = JSON.parse(saved);
          if (Array.isArray(list) && list[0]) {
            accentService.updateFromWallpaper(list[0]);
          }
        }
      } catch {}
    };
    initAccent();
  }, []);

  const handleMouseEnter = () => {
    if (leaveTimerRef.current) {
      window.clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    setHovered(true);
  };

  const handleMouseLeave = () => {
    setHovered(false);
    if (!isPinned && isExpanded) {
      leaveTimerRef.current = window.setTimeout(() => {
        setExpanded(false);
      }, settings.hoverCollapseDelayMs);
    }
  };

  // Try to communicate with Tauri native window resizing if running in Tauri
  useEffect(() => {
    const syncTauriWindow = async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('set_window_expanded', { expanded: isExpanded });
      } catch {
        // Running in standard browser or dev server without native Tauri wrapper
      }
    };
    syncTauriWindow();
  }, [isExpanded]);

  // Global hotkey listener for web/browser environment
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape collapses panel unless pinned
      if (e.key === 'Escape') {
        setExpanded(false);
      }
      // Alt+Space toggles assistant
      if (e.altKey && e.code === 'Space') {
        e.preventDefault();
        setExpanded(!isExpanded);
      }
      // Alt+D triggers dictation
      if (e.altKey && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        setMode('voice');
      }
      // Alt+S triggers screen capture
      if (e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        setMode('screen');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded, setExpanded, setMode]);

  return (
    <div 
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="w-full h-full flex flex-col items-center pt-0 px-0 pb-3 overflow-hidden pointer-events-auto tauri-no-drag"
    >
      <FloatingPill />
      <AssistantPanel />
    </div>
  );
}

export default App;
