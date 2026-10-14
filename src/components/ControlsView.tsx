import React, { useState, useEffect, useRef } from 'react';
import {
  Wifi,
  Bluetooth,
  Volume2,
  VolumeX,
  Moon,
  ChevronDown,
  SkipBack,
  SkipForward,
  Play,
  Pause,
  Headphones,
  CircleDot,
  Check,
  Radio,
  X
} from 'lucide-react';
import { systemService } from '../services/systemService';

interface Track {
  title: string;
  artist: string;
  duration: number; // in seconds (62:15 = 3735s)
  audioUrl?: string;
}

const TRACKS: Track[] = [
  {
    title: 'lofi beats to study and relax',
    artist: 'lofi radio',
    duration: 3735, // 62:15
    audioUrl: 'https://streams.ilovemusic.de/iloveradio17.mp3',
  },
  {
    title: 'chillhop study session',
    artist: 'chill beats fm',
    duration: 2840, // 47:20
    audioUrl: 'https://stream.zeno.fm/f3wvbbqmdg8uv',
  },
  {
    title: 'midnight rain & coffee',
    artist: 'coffee shop lofi',
    duration: 3420, // 57:00
    audioUrl: 'https://streams.ilovemusic.de/iloveradio17.mp3',
  },
];

const WIFI_NETWORKS = [
  { name: 'Home 5G', signal: 'Strong', connected: true },
  { name: 'Boty_Studio_5G', signal: 'Good', connected: false },
  { name: 'Public_Fast_WiFi', signal: 'Fair', connected: false },
];

const BT_DEVICES = [
  { name: 'AirPods Pro', type: 'Earbuds', connected: false },
  { name: 'Sony WH-1000XM4', type: 'Headphones', connected: false },
  { name: 'Logitech MX Master 3', type: 'Mouse', connected: false },
];

const AUDIO_OUTPUTS = [
  { name: 'Speakers', sublabel: 'Realtek(R) Audio', active: true },
  { name: 'Headphones', sublabel: '3.5mm Audio Jack', active: false },
  { name: 'External Display', sublabel: 'HDMI / DisplayPort', active: false },
];

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export const ControlsView: React.FC = () => {
  // ── Quick Controls State ───────────────────────────────
  const [wifi, setWifi] = useState(true);
  const [wifiName, setWifiName] = useState('Home 5G');
  const [isWifiMenuOpen, setIsWifiMenuOpen] = useState(false);

  const [bluetooth, setBluetooth] = useState(false);
  const [btDevice, setBtDevice] = useState('Off');
  const [isBtMenuOpen, setIsBtMenuOpen] = useState(false);

  const [audioDevice, setAudioDevice] = useState('Speakers');
  const [isAudioMenuOpen, setIsAudioMenuOpen] = useState(false);

  const [nightLight, setNightLight] = useState(false);

  const [darkMode, setDarkMode] = useState(true);

  // ── Volume State (Matches screenshot default: 28%) ───────
  const [volume, setVolume] = useState(28);
  const [isMuted, setIsMuted] = useState(false);
  const volDebounce = useRef<number | null>(null);

  // ── Audio Player State (Matches screenshot: 0:57 / 62:15) ─
  const [trackIndex, setTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(57); // 0:57
  const currentTrack = TRACKS[trackIndex];
  const duration = currentTrack.duration; // 3735s (62:15)

  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscIntervalRef = useRef<number | null>(null);

  // ── Sync Real Windows Volume ───────────────────────────
  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    setIsMuted(false);
    if (audioElRef.current) {
      audioElRef.current.volume = newVol / 100;
    }
    if (volDebounce.current) window.clearTimeout(volDebounce.current);
    volDebounce.current = window.setTimeout(() => {
      systemService.setVolume(newVol, false);
    }, 200);
  };

  const handleMuteToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    if (audioElRef.current) {
      audioElRef.current.muted = nextMute;
    }
    systemService.setVolume(volume, nextMute);
  };

  // ── Audio Player Logic (Web Audio fallback + Streaming) ─
  useEffect(() => {
    // Hidden background audio element
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.volume = volume / 100;
    audioElRef.current = audio;

    return () => {
      audio.pause();
      audio.src = '';
      if (oscIntervalRef.current) window.clearInterval(oscIntervalRef.current);
    };
  }, []);

  // Web Audio chill chord generator fallback for guaranteed sound
  const playChillSynthesizerNote = () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const chords = [
        [261.63, 329.63, 392.0, 493.88], // Cmaj7
        [220.0, 261.63, 329.63, 392.0],  // Am7
        [174.61, 220.0, 261.63, 329.63], // Fmaj7
        [196.0, 246.94, 293.66, 349.23], // G7
      ];
      const chord = chords[Math.floor(Math.random() * chords.length)];

      chord.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const now = ctx.currentTime + idx * 0.05;
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.04 * (volume / 100), now + 0.4);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.2);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 3.3);
      });
    } catch {}
  };

  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      audioElRef.current?.pause();
      if (oscIntervalRef.current) window.clearInterval(oscIntervalRef.current);
    } else {
      setIsPlaying(true);
      // Try streaming audio or fallback generator
      if (audioElRef.current && currentTrack.audioUrl) {
        audioElRef.current.src = currentTrack.audioUrl;
        audioElRef.current.play().catch(() => {
          // Play synth chord loop if stream is blocked by browser policies
          playChillSynthesizerNote();
          oscIntervalRef.current = window.setInterval(playChillSynthesizerNote, 3500);
        });
      }
    }
  };

  // Progress ticker
  useEffect(() => {
    if (!isPlaying) return;
    const ticker = setInterval(() => {
      setCurrentTime(prev => (prev < duration ? prev + 1 : 0));
    }, 1000);
    return () => clearInterval(ticker);
  }, [isPlaying, duration]);

  const handlePrevTrack = () => {
    setTrackIndex(prev => (prev > 0 ? prev - 1 : TRACKS.length - 1));
    setCurrentTime(0);
  };

  const handleNextTrack = () => {
    setTrackIndex(prev => (prev < TRACKS.length - 1 ? prev + 1 : 0));
    setCurrentTime(0);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    setCurrentTime(Math.round(pct * duration));
  };

  // ── Night Light Real Effect ────────────────────────────
  const toggleNightLight = () => {
    const next = !nightLight;
    setNightLight(next);
    if (next) {
      document.documentElement.style.filter = 'sepia(0.2) saturate(1.15)';
    } else {
      document.documentElement.style.filter = '';
    }
    systemService.setToggle('nightLight', next);
  };

  // ── Dark Mode Real Toggle ──────────────────────────────
  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    systemService.setToggle('darkMode', next);
  };

  // ── Wi-Fi Real Toggle ──────────────────────────────────
  const toggleWifi = () => {
    const next = !wifi;
    setWifi(next);
    systemService.setToggle('wifi', next);
  };

  // ── Bluetooth Real Toggle ──────────────────────────────
  const toggleBluetooth = () => {
    const next = !bluetooth;
    setBluetooth(next);
    setBtDevice(next ? 'Connected' : 'Off');
    systemService.setToggle('bluetooth', next);
  };

  const activeGoldClass = 'bg-app-accent shadow-sm';
  const inactiveDarkClass = 'bg-[#181921] border border-white/[0.04] text-zinc-300 hover:bg-[#20222b] hover:text-white';

  return (
    <div className="flex flex-col p-3 gap-2.5 text-zinc-200 bg-[#07080c]/90 h-full select-none overflow-hidden justify-between relative">

      {/* ── Dropdown Overlays (Wi-Fi / BT / Audio Menus) ───────── */}
      {isWifiMenuOpen && (
        <div className="absolute inset-x-3 top-12 z-30 p-2.5 rounded-2xl bg-[#0d0f17]/98 border border-white/10 shadow-2xl backdrop-blur-xl animate-fade-in flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[11px] text-zinc-400 pb-1 border-b border-white/[0.06]">
            <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
              <Wifi className="w-3.5 h-3.5 text-amber-400" />
              Available Wi-Fi Networks
            </span>
            <button onClick={() => setIsWifiMenuOpen(false)} className="p-0.5 text-zinc-500 hover:text-zinc-200">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {WIFI_NETWORKS.map(net => (
            <button
              key={net.name}
              onClick={() => {
                setWifiName(net.name);
                setWifi(true);
                setIsWifiMenuOpen(false);
              }}
              className="flex items-center justify-between p-1.5 rounded-xl hover:bg-white/[0.06] text-xs text-left cursor-pointer transition-all"
            >
              <span className="font-medium text-zinc-200">{net.name}</span>
              <span className="text-[10px] text-zinc-500 flex items-center gap-1 font-mono">
                {net.signal}
                {wifi && wifiName === net.name && <Check className="w-3 h-3 text-emerald-400 ml-1" />}
              </span>
            </button>
          ))}
        </div>
      )}

      {isBtMenuOpen && (
        <div className="absolute inset-x-3 top-12 z-30 p-2.5 rounded-2xl bg-[#0d0f17]/98 border border-white/10 shadow-2xl backdrop-blur-xl animate-fade-in flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[11px] text-zinc-400 pb-1 border-b border-white/[0.06]">
            <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
              <Bluetooth className="w-3.5 h-3.5 text-blue-400" />
              Bluetooth Devices
            </span>
            <button onClick={() => setIsBtMenuOpen(false)} className="p-0.5 text-zinc-500 hover:text-zinc-200">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {BT_DEVICES.map(dev => (
            <button
              key={dev.name}
              onClick={() => {
                setBtDevice(dev.name);
                setBluetooth(true);
                setIsBtMenuOpen(false);
              }}
              className="flex items-center justify-between p-1.5 rounded-xl hover:bg-white/[0.06] text-xs text-left cursor-pointer transition-all"
            >
              <span className="font-medium text-zinc-200">{dev.name}</span>
              <span className="text-[10px] text-zinc-500 font-mono">{dev.type}</span>
            </button>
          ))}
        </div>
      )}

      {isAudioMenuOpen && (
        <div className="absolute inset-x-3 top-12 z-30 p-2.5 rounded-2xl bg-[#0d0f17]/98 border border-white/10 shadow-2xl backdrop-blur-xl animate-fade-in flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[11px] text-zinc-400 pb-1 border-b border-white/[0.06]">
            <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
              <Headphones className="w-3.5 h-3.5 text-amber-400" />
              Sound Output Device
            </span>
            <button onClick={() => setIsAudioMenuOpen(false)} className="p-0.5 text-zinc-500 hover:text-zinc-200">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {AUDIO_OUTPUTS.map(out => (
            <button
              key={out.name}
              onClick={() => {
                setAudioDevice(out.name);
                setIsAudioMenuOpen(false);
              }}
              className="flex items-center justify-between p-1.5 rounded-xl hover:bg-white/[0.06] text-xs text-left cursor-pointer transition-all"
            >
              <div>
                <div className="font-medium text-zinc-200">{out.name}</div>
                <div className="text-[9px] text-zinc-500">{out.sublabel}</div>
              </div>
              {audioDevice === out.name && <Check className="w-3 h-3 text-emerald-400" />}
            </button>
          ))}
        </div>
      )}

      {/* ── ROW 1: Wi-Fi, Bluetooth, Audio (3 Cards) ─────────── */}
      <div className="grid grid-cols-3 gap-2">
        {/* 1. Wi-Fi Card */}
        <div
          onClick={toggleWifi}
          className={`flex items-center p-2 rounded-2xl transition-all cursor-pointer group select-none ${
            wifi ? activeGoldClass : inactiveDarkClass
          }`}
          title="Toggle Wi-Fi"
        >
          <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
            wifi ? 'bg-black/10 text-[#151206]' : 'bg-white/[0.06] text-zinc-300'
          }`}>
            <Wifi className="w-3.5 h-3.5" />
          </div>
          <div className="ml-2 flex-1 min-w-0">
            <div className="font-semibold text-xs leading-tight">Wi-Fi</div>
            <div className={`text-[10px] leading-tight truncate ${wifi ? 'opacity-80' : 'text-zinc-500'}`}>
              {wifi ? wifiName : 'Off'}
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsWifiMenuOpen(o => !o);
            }}
            className="p-1 opacity-60 hover:opacity-100 transition-opacity ml-0.5 shrink-0"
            title="Wi-Fi networks"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 2. Bluetooth Card */}
        <div
          onClick={toggleBluetooth}
          className={`flex items-center p-2 rounded-2xl transition-all cursor-pointer group select-none ${
            bluetooth ? activeGoldClass : inactiveDarkClass
          }`}
          title="Toggle Bluetooth"
        >
          <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
            bluetooth ? 'bg-black/10 text-[#151206]' : 'bg-white/[0.06] text-zinc-300'
          }`}>
            <Bluetooth className="w-3.5 h-3.5" />
          </div>
          <div className="ml-2 flex-1 min-w-0">
            <div className="font-semibold text-xs leading-tight">Bluetooth</div>
            <div className={`text-[10px] leading-tight truncate ${bluetooth ? 'opacity-80' : 'text-zinc-500'}`}>
              {bluetooth ? btDevice : 'Off'}
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsBtMenuOpen(o => !o);
            }}
            className="p-1 opacity-60 hover:opacity-100 transition-opacity ml-0.5 shrink-0"
            title="Bluetooth devices"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 3. Audio Card */}
        <div
          onClick={() => setIsAudioMenuOpen(o => !o)}
          className={`flex items-center p-2 rounded-2xl transition-all cursor-pointer group select-none ${activeGoldClass}`}
          title="Select Audio Device"
        >
          <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-black/10 text-[#151206]">
            <Volume2 className="w-3.5 h-3.5" />
          </div>
          <div className="ml-2 flex-1 min-w-0">
            <div className="font-semibold text-xs leading-tight">Audio</div>
            <div className="text-[10px] leading-tight opacity-80 truncate">
              {audioDevice}
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsAudioMenuOpen(o => !o);
            }}
            className="p-1 opacity-60 hover:opacity-100 transition-opacity ml-0.5 shrink-0"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── ROW 2: Night Light & Dark Mode (2 Cards) ─────────── */}
      <div className="flex gap-2">
        {/* Night Light Card (Takes ~55% width) */}
        <div
          onClick={toggleNightLight}
          className={`flex items-center p-2 rounded-2xl transition-all cursor-pointer group select-none flex-[1.2] ${
            nightLight ? activeGoldClass : inactiveDarkClass
          }`}
          title="Toggle Night Light"
        >
          <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
            nightLight ? 'bg-black/10 text-[#151206]' : 'bg-white/[0.06] text-zinc-300'
          }`}>
            <Moon className="w-3.5 h-3.5" />
          </div>
          <div className="ml-2 flex-1 min-w-0">
            <div className="font-semibold text-xs leading-tight">Night Light</div>
            <div className={`text-[10px] leading-tight truncate ${nightLight ? 'opacity-80' : 'text-zinc-500'}`}>
              {nightLight ? 'On' : 'Off'}
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleNightLight();
            }}
            className="p-1 opacity-60 hover:opacity-100 transition-opacity ml-0.5 shrink-0"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Dark Mode Card (Takes ~45% width) */}
        <div
          onClick={toggleDarkMode}
          className={`flex items-center p-2 rounded-2xl transition-all cursor-pointer group select-none flex-1 ${
            darkMode ? activeGoldClass : inactiveDarkClass
          }`}
          title="Toggle Dark Mode"
        >
          <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
            darkMode ? 'bg-black/10 text-[#151206]' : 'bg-white/[0.06] text-zinc-300'
          }`}>
            <CircleDot className="w-3.5 h-3.5" />
          </div>
          <div className="ml-2 flex-1 min-w-0">
            <div className="font-semibold text-xs leading-tight">Dark mode</div>
            <div className={`text-[10px] leading-tight truncate ${darkMode ? 'opacity-80' : 'text-zinc-500'}`}>
              {darkMode ? 'On' : 'Off'}
            </div>
          </div>
        </div>
      </div>

      {/* ── ROW 3: Master Volume Slider (Pill with 28% label) ── */}
      <div
        className="relative h-9 rounded-full bg-[#181921] border border-white/[0.04] flex items-center overflow-hidden cursor-pointer select-none group"
        title="Master Volume"
      >
        {/* Filled Golden Progress Pill */}
        <div
          className="h-full bg-app-accent rounded-full transition-all flex items-center"
          style={{ width: `${isMuted ? 0 : volume}%` }}
        >
          {/* Speaker Icon embedded on the left */}
          <button
            onClick={handleMuteToggle}
            className="p-1 ml-2 text-inherit hover:scale-110 active:scale-95 transition-transform cursor-pointer shrink-0 z-20"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* If volume is 0 or muted, show icon in grey on left */}
        {(volume === 0 || isMuted) && (
          <button
            onClick={handleMuteToggle}
            className="absolute left-2.5 z-20 text-zinc-400 hover:text-white"
            title="Unmute"
          >
            <VolumeX className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Volume Percentage Text on the right (e.g. 28%) */}
        <span className="absolute right-3.5 text-xs font-mono font-bold text-zinc-200 pointer-events-none drop-shadow">
          {isMuted ? 'Muted' : `${volume}%`}
        </span>

        {/* Interactive range slider overlay */}
        <input
          type="range"
          min={0}
          max={100}
          value={isMuted ? 0 : volume}
          onChange={(e) => handleVolumeChange(+e.target.value)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
      </div>

      {/* ── ROW 4: Media / Music Player Card ─────────────────── */}
      <div className="rounded-2xl bg-[#14151d] border border-white/[0.04] p-2.5 px-3 flex flex-col gap-1.5 shadow-lg relative">
        {/* Top Mini Header: Speaker Icon + Device Name */}
        <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-medium">
          <Volume2 className="w-3 h-3 text-zinc-400" />
          <span>{audioDevice}</span>
        </div>

        {/* Middle Row: Album Art + Track Info + Playback Controls */}
        <div className="flex items-center justify-between gap-3">
          {/* Square Purple Album Art Thumbnail */}
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#683b92] to-[#393f8e] flex items-center justify-center shrink-0 shadow-md relative overflow-hidden group">
            <Radio className={`w-5 h-5 text-purple-200/90 ${isPlaying ? 'animate-pulse' : ''}`} />
          </div>

          {/* Title & Artist */}
          <div className="flex-1 min-w-0 pr-1">
            <div className="text-xs font-semibold text-zinc-100 truncate tracking-tight">
              {currentTrack.title}
            </div>
            <div className="text-[10px] text-zinc-500 truncate mt-0.5 font-medium">
              {currentTrack.artist}
            </div>
          </div>

          {/* Controls: Prev / Play-Pause / Next */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handlePrevTrack}
              className="p-1 rounded-full text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title="Previous Track"
            >
              <SkipBack className="w-4 h-4 fill-current" />
            </button>

            {/* Circular Play/Pause Pill Button */}
            <button
              onClick={togglePlay}
              className="w-8 h-8 rounded-full bg-app-accent flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-md cursor-pointer"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-3.5 h-3.5 fill-current" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
              )}
            </button>

            <button
              onClick={handleNextTrack}
              className="p-1 rounded-full text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title="Next Track"
            >
              <SkipForward className="w-4 h-4 fill-current" />
            </button>
          </div>
        </div>

        {/* Bottom Progress Bar & Timestamps */}
        <div className="flex items-center gap-2 pt-0.5 text-[9.5px] text-zinc-500 font-mono">
          <span className="w-7 text-right">{fmtTime(currentTime)}</span>
          <div
            onClick={handleSeek}
            className="flex-1 h-1 rounded-full bg-white/[0.08] relative cursor-pointer group flex items-center"
            title="Seek playback"
          >
            <div
              className="h-full rounded-full bg-app-accent transition-all"
              style={{ width: `${Math.min(100, (currentTime / duration) * 100)}%` }}
            />
            {/* Scrubber thumb */}
            <div
              className="w-2 h-2 rounded-full bg-app-accent opacity-0 group-hover:opacity-100 transition-opacity absolute"
              style={{ left: `${Math.min(98, (currentTime / duration) * 100)}%` }}
            />
          </div>
          <span className="w-8 text-left">{fmtTime(duration)}</span>
        </div>
      </div>

    </div>
  );
};
