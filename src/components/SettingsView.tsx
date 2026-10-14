import React, { useState } from 'react';
import { 
  Settings, 
  Key, 
  Cpu, 
  Eye, 
  EyeOff, 
  Trash2, 
  Check,
  ExternalLink
} from 'lucide-react';
import { useAssistantStore } from '../store/useAssistantStore';

export const SettingsView: React.FC = () => {
  const { settings, updateSettings, clearMessages } = useAssistantStore();
  const [showKey, setShowKey] = useState(false);
  const [keyInput, setKeyInput] = useState(settings.apiKey);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSaveKey = () => {
    updateSettings({ apiKey: keyInput.trim() });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  return (
    <div className="flex flex-col h-full p-4 text-zinc-200 bg-[#08090e]/70 overflow-y-auto space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
        <div>
          <h2 className="text-xs font-semibold text-zinc-100 flex items-center gap-1.5">
            <Settings className="w-3.5 h-3.5 text-violet-400" />
            <span>Settings</span>
          </h2>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            API key, model preferences, and shortcuts.
          </p>
        </div>
      </div>

      {/* Gemini API Key */}
      <div className="p-3 rounded-2xl dark-card space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-zinc-200 flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-amber-400" />
            <span>Google Gemini API Key</span>
          </label>
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noreferrer"
            className="text-[10px] text-violet-400 hover:text-violet-300 flex items-center gap-1"
          >
            <span>Get free key</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type={showKey ? 'text' : 'password'}
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="Paste AI Studio Key (AIzaSy...)"
              className="w-full dark-input rounded-xl pl-3 pr-8 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none font-mono"
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2.5 top-2 text-zinc-400 hover:text-zinc-200"
            >
              {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
          <button
            onClick={handleSaveKey}
            className="py-1.5 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium flex items-center gap-1 cursor-pointer shadow-[0_0_8px_rgba(139,92,246,0.3)]"
          >
            {savedSuccess ? <Check className="w-3 h-3 text-emerald-300" /> : null}
            <span>{savedSuccess ? 'Saved' : 'Save'}</span>
          </button>
        </div>
      </div>

      {/* Model Selection */}
      <div className="p-3 rounded-2xl dark-card space-y-1.5">
        <label className="text-xs font-medium text-zinc-200 flex items-center gap-1.5">
          <Cpu className="w-3.5 h-3.5 text-violet-400" />
          <span>AI Model</span>
        </label>
        <select
          value={settings.model}
          onChange={(e) => updateSettings({ model: e.target.value })}
          className="w-full dark-input rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
        >
          <option value="gemini-2.0-flash">Gemini 2.0 Flash (Fast, Multimodal)</option>
          <option value="gemini-1.5-pro">Gemini 1.5 Pro (Deep Reasoning)</option>
          <option value="gemini-1.5-flash">Gemini 1.5 Flash (Lightweight)</option>
        </select>
      </div>

      {/* Global Shortcuts Reference */}
      <div className="p-3 rounded-2xl dark-card space-y-2">
        <span className="text-xs font-medium text-zinc-200 block">Global Shortcuts</span>
        <div className="space-y-1.5 text-xs text-zinc-400">
          <div className="flex justify-between items-center">
            <span>Toggle Window</span>
            <kbd className="px-1.5 py-0.5 rounded bg-white/[0.04] text-zinc-300 font-mono text-[10px]">Alt + Space</kbd>
          </div>
          <div className="flex justify-between items-center">
            <span>Voice Dictation</span>
            <kbd className="px-1.5 py-0.5 rounded bg-white/[0.04] text-zinc-300 font-mono text-[10px]">Alt + D</kbd>
          </div>
          <div className="flex justify-between items-center">
            <span>Screen Vision</span>
            <kbd className="px-1.5 py-0.5 rounded bg-white/[0.04] text-zinc-300 font-mono text-[10px]">Alt + S</kbd>
          </div>
        </div>
      </div>

      {/* Data Clear */}
      <div className="pt-1 flex justify-end">
        <button
          onClick={() => {
            clearMessages();
            localStorage.clear();
            alert("History cleared.");
          }}
          className="text-[11px] text-zinc-500 hover:text-rose-400 flex items-center gap-1 transition-colors"
        >
          <Trash2 className="w-3 h-3" />
          <span>Clear Local Data</span>
        </button>
      </div>
    </div>
  );
};
