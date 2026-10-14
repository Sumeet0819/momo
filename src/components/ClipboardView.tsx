import React, { useState, useEffect } from 'react';
import { Clipboard, Copy, Trash2, Pin, PinOff, Search, Check, Plus } from 'lucide-react';
import { systemService } from '../services/systemService';

interface ClipItem {
  id: string;
  text: string;
  ts: number;
  pinned: boolean;
}

const DEFAULT_CLIPS: ClipItem[] = [
  { id: '1', text: 'npm run dev', ts: Date.now() - 60000, pinned: true },
  { id: '2', text: 'https://ai.google.dev/gemini-api/docs', ts: Date.now() - 120000, pinned: false },
  { id: '3', text: 'const stats = await systemService.getStats();', ts: Date.now() - 300000, pinned: false },
  { id: '4', text: 'backdrop-filter: blur(40px) saturate(220%);', ts: Date.now() - 600000, pinned: false },
];

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export const ClipboardView: React.FC = () => {
  const [items, setItems] = useState<ClipItem[]>(() => {
    const saved = localStorage.getItem('boty_clipboard_history');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return DEFAULT_CLIPS;
  });

  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('boty_clipboard_history', JSON.stringify(items));
  }, [items]);

  const filtered = items
    .filter(i => i.text.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.ts - a.ts);

  const handleCopy = async (item: ClipItem) => {
    await systemService.writeClipboard(item.text);
    setCopied(item.id);
    setStatusMsg('Copied to Windows clipboard!');
    setTimeout(() => {
      setCopied(null);
      setStatusMsg(null);
    }, 1800);
  };

  const handlePin = (id: string) => {
    setItems(items.map(i => i.id === id ? { ...i, pinned: !i.pinned } : i));
  };

  const handleDelete = (id: string) => {
    setItems(items.filter(i => i.id !== id));
  };

  const handleClearAll = () => {
    setItems(items.filter(i => i.pinned));
  };

  const handleCaptureCurrent = async () => {
    try {
      const text = await systemService.readClipboard();
      if (!text.trim()) {
        setStatusMsg('Clipboard is empty');
        setTimeout(() => setStatusMsg(null), 1500);
        return;
      }

      // Check if already top item
      if (items.length > 0 && items[0].text === text.trim()) {
        setStatusMsg('Already in history');
        setTimeout(() => setStatusMsg(null), 1500);
        return;
      }

      const newItem: ClipItem = {
        id: `clip-${Date.now()}`,
        text: text.trim(),
        ts: Date.now(),
        pinned: false,
      };
      setItems(prev => [newItem, ...prev]);
      setStatusMsg('Added current clipboard snippet!');
      setTimeout(() => setStatusMsg(null), 1800);
    } catch {
      setStatusMsg('Unable to access clipboard');
      setTimeout(() => setStatusMsg(null), 1500);
    }
  };

  return (
    <div className="flex flex-col p-4 gap-3 text-zinc-200 bg-[#08090e]/70 h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold text-zinc-100 flex items-center gap-1.5">
            <Clipboard className="w-3.5 h-3.5 text-violet-400"/>
            Clipboard History
          </h2>
          <span className="text-[10px] text-zinc-500 font-mono">({items.length} items)</span>
        </div>
        <div className="flex items-center gap-2">
          {statusMsg && (
            <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1 animate-pulse">
              <Check className="w-3 h-3"/>
              {statusMsg}
            </span>
          )}
          <button
            onClick={handleCaptureCurrent}
            className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-violet-600/80 hover:bg-violet-500 text-white cursor-pointer transition-all shadow-sm shadow-violet-600/30"
            title="Read and save current system clipboard"
          >
            <Plus className="w-3 h-3"/>
            Add Current
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2 w-3 h-3 text-zinc-500 pointer-events-none"/>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search copied text..."
          className="w-full dark-input rounded-xl pl-7 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none"
        />
      </div>

      {/* List */}
      <div className="flex-1 space-y-2 overflow-y-auto pr-0.5">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-zinc-500 text-xs">
            <Clipboard className="w-8 h-8 mb-2 stroke-[1.2] opacity-40"/>
            No clipboard entries found
          </div>
        )}
        {filtered.map(item => (
          <div
            key={item.id}
            className={`group p-3 rounded-2xl dark-card flex items-start gap-2.5 transition-all border ${
              item.pinned 
                ? 'border-violet-500/30 bg-violet-950/20' 
                : 'border-white/[0.05] hover:border-white/[0.1]'
            }`}
          >
            {item.pinned && (
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-1.5 shrink-0 shadow-[0_0_6px_#8b5cf6]"/>
            )}
            <p className="flex-1 text-[11px] text-zinc-300 font-mono leading-relaxed break-all line-clamp-2 select-text">
              {item.text}
            </p>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className="text-[9px] text-zinc-500 font-mono">{timeAgo(item.ts)}</span>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleCopy(item)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-violet-300 hover:bg-white/[0.06] transition-colors cursor-pointer"
                  title="Copy to Windows clipboard"
                >
                  {copied === item.id ? <Check className="w-3.5 h-3.5 text-emerald-400"/> : <Copy className="w-3.5 h-3.5"/>}
                </button>
                <button
                  onClick={() => handlePin(item.id)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-amber-300 hover:bg-white/[0.06] transition-colors cursor-pointer"
                  title={item.pinned ? 'Unpin' : 'Pin to top'}
                >
                  {item.pinned ? <PinOff className="w-3.5 h-3.5 text-amber-400"/> : <Pin className="w-3.5 h-3.5"/>}
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="p-1 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/20 transition-colors cursor-pointer"
                  title="Delete from history"
                >
                  <Trash2 className="w-3.5 h-3.5"/>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-2 border-t border-white/[0.04] text-[10px] text-zinc-500 flex items-center justify-between">
        <span>Click item actions to copy, pin or remove</span>
        {items.length > 0 && (
          <button
            onClick={handleClearAll}
            className="hover:text-rose-400 transition-colors cursor-pointer"
          >
            Clear unpinned
          </button>
        )}
      </div>
    </div>
  );
};
