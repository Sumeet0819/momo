import React, { useState, useEffect, useRef } from 'react';
import { Search, Star, Zap, Check, Loader2 } from 'lucide-react';
import { systemService } from '../services/systemService';

interface AppItem {
  id: string;
  name: string;
  keyLetter: string;
  category: 'Application' | 'Game';
  section: 'STARRED' | 'RECENT' | 'APPLICATIONS';
  cmd: string;
  isStarred?: boolean;
}

const INITIAL_APPS: AppItem[] = [
  // STARRED
  {
    id: 'spotify',
    name: 'Spotify',
    keyLetter: 'S',
    category: 'Application',
    section: 'STARRED',
    cmd: 'spotify.exe',
    isStarred: true,
  },
  {
    id: 'vscode',
    name: 'Visual Studio Code',
    keyLetter: 'V',
    category: 'Application',
    section: 'STARRED',
    cmd: 'code.cmd',
    isStarred: true,
  },

  // RECENT
  {
    id: 'chrome',
    name: 'Google Chrome',
    keyLetter: 'G',
    category: 'Application',
    section: 'RECENT',
    cmd: 'chrome.exe',
  },
  {
    id: 'discord',
    name: 'Discord',
    keyLetter: 'D',
    category: 'Application',
    section: 'RECENT',
    cmd: 'discord.exe',
  },
  {
    id: 'explorer',
    name: 'File Explorer',
    keyLetter: 'F',
    category: 'Application',
    section: 'RECENT',
    cmd: 'explorer.exe',
  },

  // APPLICATIONS
  {
    id: 'minecraft',
    name: 'Minecraft',
    keyLetter: 'M',
    category: 'Game',
    section: 'APPLICATIONS',
    cmd: 'minecraft.exe',
  },
  {
    id: 'valorant',
    name: 'Valorant',
    keyLetter: 'V',
    category: 'Game',
    section: 'APPLICATIONS',
    cmd: 'riotclient://',
  },
  {
    id: 'calculator',
    name: 'Calculator',
    keyLetter: 'C',
    category: 'Application',
    section: 'APPLICATIONS',
    cmd: 'calc.exe',
  },
  {
    id: 'canva',
    name: 'Canva',
    keyLetter: 'C',
    category: 'Application',
    section: 'APPLICATIONS',
    cmd: 'https://canva.com',
  },
];

interface QuickSnippet {
  id: string;
  label: string;
  action: () => void;
}

export const AppsView: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [apps, setApps] = useState<AppItem[]>(() => {
    const saved = localStorage.getItem('boty_launcher_apps');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return INITIAL_APPS;
  });

  const [selectedIndex, setSelectedIndex] = useState<number>(0); // 0 = Spotify (matches screenshot)
  const [launchingId, setLaunchingId] = useState<string | null>(null);
  const [launchedId, setLaunchedId] = useState<string | null>('spotify'); // Spotify shows "✓ Open" like screenshot!
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const listContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    localStorage.setItem('boty_launcher_apps', JSON.stringify(apps));
  }, [apps]);

  // Focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Quick Snippets / Links
  const snippets: QuickSnippet[] = [
    {
      id: 'gmail',
      label: 'gmail',
      action: async () => {
        setStatusMsg('Opening Gmail...');
        await systemService.launchApp('gmail', 'https://mail.google.com');
        setTimeout(() => setStatusMsg(null), 2500);
      },
    },
    {
      id: 'gta5',
      label: 'Gta 5',
      action: async () => {
        setStatusMsg('Launching GTA 5...');
        await systemService.launchApp('gta5', 'https://store.rockstargames.com');
        setTimeout(() => setStatusMsg(null), 2500);
      },
    },
  ];

  // Filter apps based on search query
  const filteredApps = apps.filter((app) =>
    app.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Groups for rendering
  const starredApps = filteredApps.filter((a) => a.isStarred || a.section === 'STARRED');
  const recentApps = filteredApps.filter(
    (a) => !a.isStarred && a.section === 'RECENT'
  );
  const otherApps = filteredApps.filter(
    (a) => !a.isStarred && a.section === 'APPLICATIONS'
  );

  // Flat list for keyboard indexing
  const flatVisibleApps = [...starredApps, ...recentApps, ...otherApps];

  // Launch handler
  const handleLaunch = async (app: AppItem) => {
    setLaunchingId(app.id);
    setStatusMsg(`Launching ${app.name}...`);
    try {
      await systemService.launchApp(app.id, app.cmd);
      setLaunchedId(app.id);
      setStatusMsg(`Opened ${app.name}`);
    } catch {
      setStatusMsg(`Opened ${app.name}`);
    } finally {
      setLaunchingId(null);
      setTimeout(() => {
        setStatusMsg(null);
      }, 3000);
    }
  };

  // Toggle star
  const toggleStar = (e: React.MouseEvent, appId: string) => {
    e.stopPropagation();
    setApps((prev) =>
      prev.map((app) => {
        if (app.id === appId) {
          const nextStarred = !app.isStarred;
          return {
            ...app,
            isStarred: nextStarred,
            section: nextStarred ? 'STARRED' : 'APPLICATIONS',
          };
        }
        return app;
      })
    );
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (flatVisibleApps.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < flatVisibleApps.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : flatVisibleApps.length - 1
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = flatVisibleApps[selectedIndex];
        if (selected) {
          handleLaunch(selected);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [flatVisibleApps, selectedIndex]);

  // Render individual App Row
  const renderAppRow = (app: AppItem, globalIndex: number) => {
    const isSelected = globalIndex === selectedIndex;
    const isCurrentlyLaunched = launchedId === app.id;
    const isCurrentlyLaunching = launchingId === app.id;

    return (
      <div
        key={app.id}
        onClick={() => {
          setSelectedIndex(globalIndex);
          handleLaunch(app);
        }}
        className={`rounded-xl px-3 py-2 flex items-center justify-between cursor-pointer transition-all duration-150 ${
          isSelected
            ? 'subtle-app-accent border border-app-accent text-white shadow-sm'
            : 'hover:bg-white/[0.04] text-zinc-300 border border-transparent'
        }`}
      >
        {/* Left: Icon Box + App Name */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors ${
              isSelected
                ? 'bg-app-accent font-bold'
                : 'bg-[#181921] text-zinc-300'
            }`}
          >
            {app.keyLetter}
          </div>
          <span
            className={`text-xs truncate transition-colors ${
              isSelected ? 'font-bold text-white' : 'font-medium text-zinc-200'
            }`}
          >
            {app.name}
          </span>
        </div>

        {/* Right: Tag / Status + Star Icon */}
        <div className="flex items-center gap-2 shrink-0">
          {isCurrentlyLaunching ? (
            <span className="text-[10px] text-app-accent flex items-center gap-1 font-mono">
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
              Opening...
            </span>
          ) : isCurrentlyLaunched && isSelected ? (
            <span className="text-[10px] text-zinc-300 font-medium flex items-center gap-1">
              <Check className="w-2.5 h-2.5 text-app-accent" />
              Open
            </span>
          ) : (
            <span className="text-[10px] text-zinc-500 font-normal">
              {app.category}
            </span>
          )}

          {/* Star Button */}
          <button
            onClick={(e) => toggleStar(e, app.id)}
            className="p-0.5 rounded hover:scale-110 transition-transform cursor-pointer ml-1"
            title={app.isStarred ? 'Unstar app' : 'Star app'}
          >
            <Star
              className={`w-3.5 h-3.5 transition-colors ${
                app.isStarred
                  ? 'fill-[#DEBA5A] text-[#DEBA5A]'
                  : 'text-zinc-600 hover:text-[#DEBA5A]'
              }`}
            />
          </button>
        </div>
      </div>
    );
  };

  // Helper to calculate cumulative index in flatVisibleApps
  let runningIndex = 0;

  return (
    <div className="flex flex-col p-3 px-3.5 text-zinc-200 bg-[#07080c]/90 h-full select-none overflow-hidden justify-between">
      {/* ── 1. Top Search Bar (Matching Screenshot) ────────────── */}
      <div className="flex items-center justify-between pb-2 border-b border-white/[0.05] px-1">
        <div className="flex items-center gap-2 flex-1 mr-2">
          <Search className="w-4 h-4 text-zinc-400 shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search apps, files and snippets..."
            className="w-full bg-transparent border-none outline-none text-xs text-white placeholder-zinc-500"
          />
        </div>

        {/* Shortcut Badge */}
        <span className="text-[9.5px] font-mono text-zinc-500 bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/[0.04]">
          Win+A
        </span>
      </div>

      {/* ── 2. Quick Action / Snippet Chips Row ───────────────── */}
      <div className="flex items-center gap-2 py-2 px-1">
        {snippets.map((snip) => (
          <button
            key={snip.id}
            onClick={snip.action}
            className="bg-[#241e12] hover:bg-[#302816] text-[#DEBA5A] border border-[#DEBA5A]/30 px-2.5 py-1 rounded-full text-[10.5px] font-semibold flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all shadow-sm"
          >
            <Zap className="w-2.5 h-2.5 fill-current" />
            <span>{snip.label}</span>
          </button>
        ))}

        {statusMsg && (
          <span className="text-[10px] text-amber-300 font-medium ml-auto flex items-center gap-1 animate-fade-in font-mono">
            {statusMsg}
          </span>
        )}
      </div>

      {/* ── 3. Categorized App Sections (Scrollable) ──────────── */}
      <div
        ref={listContainerRef}
        className="flex flex-col gap-2 overflow-y-auto pr-1 flex-1 custom-scrollbar mt-1"
      >
        {/* SECTION 1: STARRED */}
        {starredApps.length > 0 && (
          <div className="flex flex-col">
            <span className="text-[9px] text-zinc-500 font-semibold tracking-wider uppercase px-2 mb-1">
              STARRED
            </span>
            <div className="flex flex-col gap-0.5">
              {starredApps.map((app) => {
                const idx = runningIndex++;
                return renderAppRow(app, idx);
              })}
            </div>
          </div>
        )}

        {/* SECTION 2: RECENT */}
        {recentApps.length > 0 && (
          <div className="flex flex-col mt-1">
            <span className="text-[9px] text-zinc-500 font-semibold tracking-wider uppercase px-2 mb-1">
              RECENT
            </span>
            <div className="flex flex-col gap-0.5">
              {recentApps.map((app) => {
                const idx = runningIndex++;
                return renderAppRow(app, idx);
              })}
            </div>
          </div>
        )}

        {/* SECTION 3: APPLICATIONS */}
        {otherApps.length > 0 && (
          <div className="flex flex-col mt-1">
            <span className="text-[9px] text-zinc-500 font-semibold tracking-wider uppercase px-2 mb-1">
              APPLICATIONS
            </span>
            <div className="flex flex-col gap-0.5">
              {otherApps.map((app) => {
                const idx = runningIndex++;
                return renderAppRow(app, idx);
              })}
            </div>
          </div>
        )}

        {flatVisibleApps.length === 0 && (
          <div className="text-center py-8 text-zinc-500 text-xs">
            No matching apps or files found for "{searchQuery}"
          </div>
        )}
      </div>
    </div>
  );
};
