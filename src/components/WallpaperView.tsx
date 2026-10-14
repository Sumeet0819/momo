import React, { useState, useEffect, useRef } from 'react';
import {
  Folder,
  FolderOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Loader2,
  HardDrive,
  X,
  Image as ImageIcon
} from 'lucide-react';
import { systemService, WallpaperItem } from '../services/systemService';
import { accentService } from '../services/accentService';

type TabMode = 'Recent' | 'My folder';

// Fallback real Windows default wallpapers (if API is loading)
const WINDOWS_DEFAULT_WALLPAPERS: WallpaperItem[] = [
  {
    id: 'win-bloom-1',
    label: 'Windows 11 Bloom',
    path: 'C:\\Windows\\Web\\Wallpaper\\Windows\\img0.jpg',
    src: '/api/system/wallpaper-file?path=C%3A%5CWindows%5CWeb%5CWallpaper%5CWindows%5Cimg0.jpg',
  },
  {
    id: 'win-bloom-dark',
    label: 'Windows 11 Dark',
    path: 'C:\\Windows\\Web\\Wallpaper\\Windows\\img19.jpg',
    src: '/api/system/wallpaper-file?path=C%3A%5CWindows%5CWeb%5CWallpaper%5CWindows%5Cimg19.jpg',
  },
  {
    id: 'win-spotlight',
    label: 'Windows Spotlight',
    path: 'C:\\Windows\\Web\\Wallpaper\\Spotlight\\img50.jpg',
    src: '/api/system/wallpaper-file?path=C%3A%5CWindows%5CWeb%5CWallpaper%5CSpotlight%5Cimg50.jpg',
  },
  {
    id: 'win-flow-1',
    label: 'Captured Motion',
    path: 'C:\\Windows\\Web\\Wallpaper\\ThemeA\\img20.jpg',
    src: '/api/system/wallpaper-file?path=C%3A%5CWindows%5CWeb%5CWallpaper%5CThemeA%5Cimg20.jpg',
  },
  {
    id: 'win-flow-2',
    label: 'Sunrise Glow',
    path: 'C:\\Windows\\Web\\Wallpaper\\ThemeB\\img24.jpg',
    src: '/api/system/wallpaper-file?path=C%3A%5CWindows%5CWeb%5CWallpaper%5CThemeB%5Cimg24.jpg',
  },
];

export const WallpaperView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabMode>('Recent');
  const [activeIndex, setActiveIndex] = useState(0);

  // Real recent wallpapers from Windows Explorer history / themes
  const [recentWallpapers, setRecentWallpapers] = useState<WallpaperItem[]>(() => {
    const saved = localStorage.getItem('boty_recent_wallpapers');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return WINDOWS_DEFAULT_WALLPAPERS;
  });

  const [folderWallpapers, setFolderWallpapers] = useState<WallpaperItem[]>(() => {
    const saved = localStorage.getItem('boty_folder_wallpapers');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return [];
  });

  const [currentFolder, setCurrentFolder] = useState<string>(() => {
    return localStorage.getItem('boty_current_wallpaper_folder') || 'Pictures';
  });

  const [isFolderPickerOpen, setIsFolderPickerOpen] = useState(false);
  const [customPathInput, setCustomPathInput] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [appliedId, setAppliedId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [isLoadingFolder, setIsLoadingFolder] = useState(false);
  const [isLoadingRecent, setIsLoadingRecent] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastScrollTime = useRef<number>(0);

  // Fetch real recent wallpapers from Windows registry & theme on mount
  useEffect(() => {
    let mounted = true;
    const fetchRecent = async () => {
      setIsLoadingRecent(true);
      try {
        const realRecent = await systemService.getRecentWallpapers();
        if (mounted && realRecent && realRecent.length > 0) {
          setRecentWallpapers(realRecent);
          localStorage.setItem('boty_recent_wallpapers', JSON.stringify(realRecent));
        }
      } catch {
        // Fallback to defaults
      } finally {
        if (mounted) setIsLoadingRecent(false);
      }
    };
    fetchRecent();
    return () => {
      mounted = false;
    };
  }, []);

  // Pick active items list based on selected tab
  const items = activeTab === 'Recent'
    ? recentWallpapers
    : (folderWallpapers.length > 0 ? folderWallpapers : recentWallpapers);

  // Ensure activeIndex is valid
  const safeIndex = items.length > 0 ? Math.max(0, Math.min(items.length - 1, activeIndex)) : 0;
  const activeWallpaper = items[safeIndex] || items[0];

  // Dynamically sync application accent whenever active wallpaper changes
  useEffect(() => {
    if (activeWallpaper) {
      accentService.updateFromWallpaper(activeWallpaper);
    }
  }, [activeWallpaper?.id, activeWallpaper?.path, activeWallpaper?.src]);

  // Load wallpapers from local Windows folder
  const loadFolderWallpapers = async (folderPath?: string) => {
    setIsLoadingFolder(true);
    setStatusMsg('Scanning wallpaper folder...');
    try {
      const res = await systemService.getFolderWallpapers(folderPath);
      if (res.wallpapers && res.wallpapers.length > 0) {
        setFolderWallpapers(res.wallpapers);
        setCurrentFolder(res.folder || folderPath || 'Pictures');
        localStorage.setItem('boty_folder_wallpapers', JSON.stringify(res.wallpapers));
        localStorage.setItem('boty_current_wallpaper_folder', res.folder || folderPath || 'Pictures');
        setActiveIndex(0);
        setStatusMsg(`Loaded ${res.wallpapers.length} pictures`);
      } else {
        setStatusMsg('No image files found in folder');
      }
    } catch {
      setStatusMsg('Unable to access folder');
    } finally {
      setIsLoadingFolder(false);
      setTimeout(() => setStatusMsg(null), 3000);
    }
  };

  // Trigger Native Windows Folder Dialog
  const handleBrowseFolder = async () => {
    setIsLoadingFolder(true);
    const picked = await systemService.pickFolder();
    if (picked) {
      await loadFolderWallpapers(picked);
      setIsFolderPickerOpen(false);
      setActiveTab('My folder');
      return;
    }

    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
    setIsLoadingFolder(false);
  };

  // HTML5 directory input change fallback
  const handleHtml5FolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const validFiles: WallpaperItem[] = [];
    const validExts = ['.jpg', '.jpeg', '.png', '.webp', '.bmp'];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const ext = '.' + f.name.split('.').pop()?.toLowerCase();
      if (validExts.includes(ext)) {
        const objectUrl = URL.createObjectURL(f);
        validFiles.push({
          id: `local-${i}-${f.name}`,
          label: f.name.replace(/\.[^/.]+$/, ''),
          src: objectUrl,
        });
      }
    }

    if (validFiles.length > 0) {
      setFolderWallpapers(validFiles);
      const folderName = files[0].webkitRelativePath?.split('/')[0] || 'Selected Folder';
      setCurrentFolder(folderName);
      setActiveTab('My folder');
      setActiveIndex(0);
      setIsFolderPickerOpen(false);
      setStatusMsg(`Loaded ${validFiles.length} pictures from ${folderName}`);
      setTimeout(() => setStatusMsg(null), 3500);
    }
  };

  // Apply selected wallpaper to Windows desktop
  const handleApplyWallpaper = async (item: WallpaperItem) => {
    if (!item) return;
    setIsApplying(true);
    setStatusMsg(`Setting ${item.label}...`);
    accentService.updateFromWallpaper(item);

    try {
      const res = await systemService.setWallpaper({
        path: item.path,
        url: item.src.startsWith('http') ? item.src : undefined,
        name: item.label,
      });

      setAppliedId(item.id);
      setStatusMsg(res.message || 'Wallpaper applied to Windows desktop!');
    } catch {
      setStatusMsg('Wallpaper updated');
    } finally {
      setIsApplying(false);
      setTimeout(() => {
        setStatusMsg(null);
        setAppliedId(null);
      }, 3500);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1));
      } else if (e.key === 'ArrowRight') {
        setActiveIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'Enter') {
        if (activeWallpaper) handleApplyWallpaper(activeWallpaper);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items, activeWallpaper]);

  // Compute 5 visible slots around safeIndex
  const getVisibleCards = () => {
    if (items.length === 0) return [];
    if (items.length <= 5) {
      return items.map((item, idx) => ({
        item,
        actualIndex: idx,
        isCenter: idx === safeIndex,
        slot: idx - safeIndex,
      }));
    }

    const n = items.length;
    const offsets = [-2, -1, 0, 1, 2];
    return offsets.map((offset) => {
      const idx = (safeIndex + offset + n) % n;
      return {
        item: items[idx],
        actualIndex: idx,
        isCenter: offset === 0,
        slot: offset,
      };
    });
  };

  const visibleCards = getVisibleCards();

  // Handle smooth mouse wheel carousel cycling
  const handleWheel = (e: React.WheelEvent) => {
    const now = Date.now();
    if (now - lastScrollTime.current < 180) return; // Smooth scroll throttle

    if (e.deltaY > 15 || e.deltaX > 15) {
      lastScrollTime.current = now;
      setActiveIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0));
    } else if (e.deltaY < -15 || e.deltaX < -15) {
      lastScrollTime.current = now;
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1));
    }
  };

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      className="relative flex flex-col p-3 px-4 text-zinc-200 bg-[#07080c]/90 h-full select-none overflow-hidden justify-between"
    >
      {/* Hidden HTML5 folder picker */}
      <input
        type="file"
        ref={fileInputRef}
        {...({ webkitdirectory: '', directory: '' } as any)}
        multiple
        className="hidden"
        onChange={handleHtml5FolderChange}
      />

      {/* ── Sub-header ────────────────────────────────────────── */}
      <div className="flex items-center justify-between pb-1 pt-0.5">
        <div className="flex items-center gap-2">
          {/* Recent Pill */}
          <button
            onClick={() => {
              setActiveTab('Recent');
              setActiveIndex(0);
            }}
            className={`px-3.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'Recent'
                ? 'bg-[#E5C365] text-[#161307] shadow-sm hover:brightness-105'
                : 'bg-white/[0.05] text-zinc-400 hover:text-white hover:bg-white/[0.08]'
            }`}
          >
            Recent
          </button>

          {/* My folder Pill */}
          <button
            onClick={() => {
              setActiveTab('My folder');
              if (folderWallpapers.length === 0) {
                loadFolderWallpapers();
              }
            }}
            className={`px-3.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer border ${
              activeTab === 'My folder'
                ? 'bg-[#E5C365] text-[#161307] font-semibold border-transparent shadow-sm'
                : 'bg-[#181920] border-white/[0.05] text-zinc-300 hover:bg-[#22242e] hover:text-white'
            }`}
          >
            My folder
          </button>

          {/* Picture Count */}
          <span className="text-[11px] text-zinc-500 font-mono ml-1 flex items-center gap-1">
            {isLoadingRecent ? (
              <Loader2 className="w-2.5 h-2.5 animate-spin text-zinc-400" />
            ) : null}
            {items.length} pictures
          </span>
        </div>

        {/* Right side: Status / Folder Picker Button */}
        <div className="flex items-center gap-2">
          {statusMsg && (
            <span className="text-[10px] text-amber-300 font-medium px-2 py-0.5 rounded-full bg-amber-950/40 border border-amber-500/20 animate-fade-in flex items-center gap-1">
              <Check className="w-2.5 h-2.5 text-emerald-400" />
              {statusMsg}
            </span>
          )}

          {/* Folder Icon Button */}
          <button
            onClick={() => setIsFolderPickerOpen((o) => !o)}
            className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
              isFolderPickerOpen
                ? 'bg-app-accent border-app-accent shadow-sm'
                : 'bg-white/[0.04] border-white/[0.07] text-zinc-400 hover:text-white hover:bg-white/[0.08]'
            }`}
            title="Choose folder on Windows PC"
          >
            <Folder className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Folder Selection Panel (Floating Popover) ──────── */}
      {isFolderPickerOpen && (
        <div className="absolute inset-x-4 top-12 z-30 p-3 rounded-2xl bg-[#0b0d14]/98 border border-white/[0.12] flex flex-col gap-2.5 shadow-[0_20px_50px_rgba(0,0,0,0.95)] backdrop-blur-2xl animate-fade-in">
          <div className="flex items-center justify-between text-[11px] text-zinc-400">
            <span className="flex items-center gap-1.5 font-medium text-zinc-200">
              <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
              Wallpaper Folder:
              <span className="text-zinc-400 font-mono text-[10px] truncate max-w-[260px]">
                {currentFolder}
              </span>
            </span>
            <button
              onClick={() => setIsFolderPickerOpen(false)}
              className="p-1 rounded-lg hover:bg-white/[0.06] text-zinc-500 hover:text-zinc-200"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={customPathInput}
              onChange={(e) => setCustomPathInput(e.target.value)}
              placeholder="Enter folder path (e.g. C:\Users\...\Pictures)"
              className="flex-1 dark-input rounded-xl px-2.5 py-1 text-[11px] text-white placeholder-zinc-500 focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && customPathInput.trim()) {
                  loadFolderWallpapers(customPathInput.trim());
                  setIsFolderPickerOpen(false);
                }
              }}
            />

            <button
              onClick={() => {
                if (customPathInput.trim()) {
                  loadFolderWallpapers(customPathInput.trim());
                  setIsFolderPickerOpen(false);
                }
              }}
              className="px-2.5 py-1 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-zinc-200 text-[11px] cursor-pointer"
            >
              Load
            </button>

            <button
              onClick={handleBrowseFolder}
              disabled={isLoadingFolder}
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-app-accent hover:opacity-90 text-[11px] font-semibold transition-all cursor-pointer shadow-sm"
            >
              {isLoadingFolder ? <Loader2 className="w-3 h-3 animate-spin" /> : <HardDrive className="w-3 h-3" />}
              Browse PC...
            </button>
          </div>

          <div className="flex items-center gap-1.5 pt-1 text-[10px] text-zinc-500">
            <span>Quick presets:</span>
            <button
              onClick={() => {
                loadFolderWallpapers('default');
                setIsFolderPickerOpen(false);
              }}
              className="px-2 py-0.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-zinc-200"
            >
              Pictures
            </button>
            <button
              onClick={() => {
                loadFolderWallpapers('C:\\Windows\\Web\\Wallpaper');
                setIsFolderPickerOpen(false);
              }}
              className="px-2 py-0.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-zinc-200"
            >
              Windows Defaults
            </button>
          </div>
        </div>
      )}

      {/* ── Parallelogram Coverflow Carousel (Smooth Fluid Transitions) ── */}
      <div className="relative flex items-center justify-center my-auto py-1 overflow-hidden">
        {/* Previous Button */}
        <button
          onClick={() => setActiveIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1))}
          className="absolute left-1 z-20 p-1.5 rounded-full bg-black/60 hover:bg-black/85 text-white/70 hover:text-white border border-white/10 opacity-40 hover:opacity-100 transition-all cursor-pointer backdrop-blur-sm shadow-md"
          title="Previous wallpaper"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* The Slanted Cards Array */}
        <div className="flex items-center justify-center gap-2.5 px-2">
          {visibleCards.map(({ item, actualIndex, isCenter, slot }) => {
            // Precise width, opacity, and scale per slot
            const isMid = Math.abs(slot) === 1;

            let cardWidth = 'w-[44px]';
            let opacityClass = 'opacity-40 hover:opacity-75';
            let filterStyle = 'brightness(0.65)';
            let zIndexStyle = 1;
            let scaleStyle = 0.96;

            if (isCenter) {
              cardWidth = 'w-[290px]';
              opacityClass = 'opacity-100';
              filterStyle = 'brightness(1)';
              zIndexStyle = 10;
              scaleStyle = 1.0;
            } else if (isMid) {
              cardWidth = 'w-[54px]';
              opacityClass = 'opacity-70 hover:opacity-95';
              filterStyle = 'brightness(0.85)';
              zIndexStyle = 5;
              scaleStyle = 0.98;
            }

            return (
              <div
                key={item.path || item.id} // Stable identity key for smooth CSS transitions
                onClick={() => {
                  if (isCenter) {
                    handleApplyWallpaper(item);
                  } else {
                    setActiveIndex(actualIndex);
                  }
                }}
                className={`relative h-[162px] cursor-pointer group rounded-2xl overflow-hidden shrink-0 ${cardWidth} ${opacityClass} ${
                  isCenter
                    ? 'border-2 border-white/25 shadow-[0_16px_40px_rgba(0,0,0,0.85)]'
                    : 'border border-white/5'
                }`}
                style={{
                  transform: `skewX(-12deg) scale(${scaleStyle})`,
                  zIndex: zIndexStyle,
                  filter: filterStyle,
                  transition:
                    'width 420ms cubic-bezier(0.16, 1, 0.3, 1), transform 420ms cubic-bezier(0.16, 1, 0.3, 1), opacity 350ms ease, filter 350ms ease',
                }}
                title={
                  isCenter
                    ? `Click to apply "${item.label}" to Windows desktop`
                    : `Select "${item.label}"`
                }
              >
                {/* Parallelogram Inner Image (Counter-Skewed to maintain natural aspect ratio) */}
                <div
                  className="w-full h-full relative overflow-hidden"
                  style={{
                    transform: 'skewX(12deg) scale(1.36)',
                    transformOrigin: 'center center',
                  }}
                >
                  <img
                    src={item.src}
                    alt={item.label}
                    className="w-full h-full object-cover select-none pointer-events-none transition-transform duration-500 group-hover:scale-105"
                    loading="eager"
                    onError={(e) => {
                      // Fallback placeholder image if local file path had an error
                      (e.currentTarget as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&auto=format&fit=crop&q=80';
                    }}
                  />
                </div>

                {/* Dark Vignette Overlay for non-center cards */}
                {!isCenter && (
                  <div className="absolute inset-0 bg-black/35 group-hover:bg-black/10 transition-colors pointer-events-none" />
                )}

                {/* Center card hover overlay / apply trigger */}
                {isCenter && (
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-between p-3 pointer-events-none">
                    <span className="text-[11px] text-white/95 font-semibold truncate max-w-[170px] drop-shadow-md">
                      {item.label}
                    </span>
                    <span className="text-[9.5px] font-bold px-2.5 py-1 rounded-full bg-app-accent shadow-lg flex items-center gap-1 pointer-events-auto">
                      {isApplying ? (
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      ) : appliedId === item.id ? (
                        <Check className="w-2.5 h-2.5 text-emerald-800" />
                      ) : (
                        <Sparkles className="w-2.5 h-2.5" />
                      )}
                      {isApplying ? 'Applying...' : appliedId === item.id ? 'Applied!' : 'Click to Set'}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Next Button */}
        <button
          onClick={() => setActiveIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0))}
          className="absolute right-1 z-20 p-1.5 rounded-full bg-black/60 hover:bg-black/85 text-white/70 hover:text-white border border-white/10 opacity-40 hover:opacity-100 transition-all cursor-pointer backdrop-blur-sm shadow-md"
          title="Next wallpaper"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* ── Bottom Info & Hint ──────────────────────────────── */}
      <div className="flex items-center justify-between pt-1 text-[10px] text-zinc-500 font-mono">
        <span className="truncate max-w-[280px] text-zinc-400 flex items-center gap-1.5">
          <ImageIcon className="w-3 h-3 text-app-accent" />
          {activeWallpaper?.label || 'Select wallpaper'}
        </span>
        <span className="text-zinc-500">
          Click center image to apply · Scroll or Arrows to browse
        </span>
      </div>
    </div>
  );
};
