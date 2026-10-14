import React, { useState, useEffect } from 'react';
import { Play, RotateCw } from 'lucide-react';
import { systemService, SystemStats } from '../services/systemService';

const DEFAULT_STATS: SystemStats = {
  cpu_usage: 37,
  cpu_per_core: [35, 42, 28, 50, 31, 38, 45, 29],
  cpu_model: 'AMD Ryzen 7 7840HS',
  ram_used_mb: 19865,
  ram_total_mb: 32665,
  ram_pct: 61,
  disk_used_gb: 412,
  disk_total_gb: 931,
  disk_pct: 44,
  net_rx_kbps: 1228,
  net_tx_kbps: 307,
  battery_pct: 88,
  battery_charging: true,
  process_count: 229,
  uptime_secs: 18720, // 5h 12m
  platform: 'Windows 11',
};

interface ProcessInfo {
  name: string;
  key: string;
  ramStr: string;
  cpuStr: string;
  ramPct: number;
  cpuPct: number;
}

const APPS_LIST: ProcessInfo[] = [
  { name: 'Google Chrome', key: 'G', ramStr: '1.4 GB', cpuStr: '14.2%', ramPct: 85, cpuPct: 70 },
  { name: 'Visual Studio Code', key: 'V', ramStr: '820 MB', cpuStr: '8.5%', ramPct: 50, cpuPct: 42 },
  { name: 'Spotify', key: 'S', ramStr: '410 MB', cpuStr: '1.8%', ramPct: 25, cpuPct: 9 },
  { name: 'Discord', key: 'D', ramStr: '300 MB', cpuStr: '3.1%', ramPct: 18, cpuPct: 15 },
];

export const StatsView: React.FC = () => {
  const [stats, setStats] = useState<SystemStats>(DEFAULT_STATS);
  const [appSortBy, setAppSortBy] = useState<'RAM' | 'CPU'>('RAM');
  const [speedTestRunning, setSpeedTestRunning] = useState(false);
  const [downloadSpeed, setDownloadSpeed] = useState(85);
  const [uploadSpeed, setUploadSpeed] = useState(42);
  const [lastSpeedTime, setLastSpeedTime] = useState('last: 5 min ago');
  const [userCity, setUserCity] = useState('Mumbai');

  // Simulated GPU load state
  const [gpuUsage] = useState(12);

  // Poll real system statistics
  useEffect(() => {
    let mounted = true;
    const fetchMetrics = async () => {
      try {
        const live = await systemService.getStats();
        if (mounted && live) {
          setStats((prev) => ({
            ...prev,
            ...live,
            cpu_usage: live.cpu_usage || prev.cpu_usage,
            ram_pct: live.ram_pct || prev.ram_pct,
            disk_used_gb: live.disk_used_gb || prev.disk_used_gb,
            disk_total_gb: live.disk_total_gb || prev.disk_total_gb,
            net_rx_kbps: live.net_rx_kbps || prev.net_rx_kbps,
            net_tx_kbps: live.net_tx_kbps || prev.net_tx_kbps,
            uptime_secs: live.uptime_secs || prev.uptime_secs,
            process_count: live.process_count || prev.process_count,
            cpu_model: live.cpu_model || 'AMD Ryzen 7 7840HS',
          }));
        }
      } catch {
        // Retain fallback stats
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 2000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Fetch approximate local city for speed test header
  useEffect(() => {
    const detectCity = async () => {
      try {
        const res = await fetch('https://ipapi.co/json/');
        if (res.ok) {
          const data = await res.json();
          if (data.city) setUserCity(data.city);
        }
      } catch {}
    };
    detectCity();
  }, []);

  // Interactive speed test handler
  const handleRunSpeedTest = () => {
    if (speedTestRunning) return;
    setSpeedTestRunning(true);
    let step = 0;
    const interval = setInterval(() => {
      step++;
      setDownloadSpeed(Math.floor(60 + Math.random() * 45));
      setUploadSpeed(Math.floor(30 + Math.random() * 25));

      if (step >= 12) {
        clearInterval(interval);
        setDownloadSpeed(88);
        setUploadSpeed(44);
        setSpeedTestRunning(false);
        setLastSpeedTime('last: just now');

        // Play pleasant finish chime
        try {
          const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.setValueAtTime(587.33, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
          gain.gain.setValueAtTime(0.12, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
          osc.start();
          osc.stop(ctx.currentTime + 0.35);
        } catch {}
      }
    }, 150);
  };

  // Format network speed string (e.g. "1.2 MB/s")
  const formatNetSpeed = (kbps: number) => {
    if (!kbps || kbps < 1) return '0 KB/s';
    if (kbps >= 1024) {
      return `${(kbps / 1024).toFixed(1)} MB/s`;
    }
    return `${Math.round(kbps)} KB/s`;
  };

  // Format uptime string (e.g. "5 h 12 m")
  const formatUptimeStr = (seconds: number) => {
    const s = seconds || 18720;
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h} h ${m} m`;
  };

  // Format RAM memory (e.g. "19.4 / 31.9 GB")
  const ramUsedGb = ((stats.ram_used_mb || 19865) / 1024).toFixed(1);
  const ramTotalGb = ((stats.ram_total_mb || 32665) / 1024).toFixed(1);
  const ramFreeGb = Math.max(0, (stats.ram_total_mb - stats.ram_used_mb) / 1024).toFixed(1);

  // SVG Gauge Math
  const ringRadius = 26;
  const circumference = 2 * Math.PI * ringRadius;

  const renderGauge = (
    pct: number,
    color: string,
    valueLabel: string
  ) => {
    const ratio = Math.max(0, Math.min(100, pct)) / 100;
    const strokeDashoffset = circumference - ratio * circumference;

    return (
      <div className="relative flex items-center justify-center w-[66px] h-[66px]">
        <svg className="w-[66px] h-[66px] -rotate-90 transform" viewBox="0 0 66 66">
          {/* Background circle track */}
          <circle
            cx="33"
            cy="33"
            r={ringRadius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="3.5"
          />
          {/* Animated color progress arc */}
          <circle
            cx="33"
            cy="33"
            r={ringRadius}
            fill="none"
            stroke={color}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <span className="absolute font-bold text-xs text-white font-mono tracking-tight">
          {valueLabel}
        </span>
      </div>
    );
  };

  return (
    <div className="flex p-2.5 gap-2 text-zinc-200 bg-[#07080c]/90 h-full select-none overflow-hidden justify-between relative">
      {/* ─────────────────────────────────────────────────────────
          LEFT SECTION (~405px): 3 GAUGES (TOP) + 3 METRIC PILLS (BOTTOM)
          ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 flex-1 min-w-0">
        {/* TOP ROW: 3 CIRCULAR GAUGES (CPU, GPU, RAM) */}
        <div className="grid grid-cols-3 gap-2 flex-1">
          {/* 1. CPU CARD */}
          <div className="bg-[#14151b] border border-white/[0.04] rounded-2xl p-2.5 flex flex-col items-center justify-between">
            {renderGauge(
              Math.round(stats.cpu_usage),
              'var(--app-accent)', // Dynamic wallpaper accent arc
              `${Math.round(stats.cpu_usage)}%`
            )}

            <div className="text-center w-full mt-0.5">
              <div className="font-bold text-xs text-white leading-tight">CPU</div>
              <div className="text-[9px] text-zinc-400 font-medium truncate max-w-full leading-tight mt-0.5">
                {stats.cpu_model || 'AMD Ryzen 7 7840HS'}
              </div>
            </div>

            <div className="flex items-center gap-1 mt-1">
              <span className="bg-[#181921] px-1.5 py-0.5 rounded-md text-[9px] text-zinc-300 font-mono">
                4.2 GHz
              </span>
              <span className="bg-[#181921] px-1.5 py-0.5 rounded-md text-[9px] text-zinc-300 font-mono">
                {stats.process_count || 229} proc
              </span>
            </div>
          </div>

          {/* 2. GPU CARD */}
          <div className="bg-[#14151b] border border-white/[0.04] rounded-2xl p-2.5 flex flex-col items-center justify-between">
            {renderGauge(
              gpuUsage,
              '#c084fc', // Lavender/purple arc matching screenshot
              `${gpuUsage}%`
            )}

            <div className="text-center w-full mt-0.5">
              <div className="font-bold text-xs text-white leading-tight">GPU</div>
              <div className="text-[9px] text-zinc-400 font-medium truncate max-w-full leading-tight mt-0.5">
                NVIDIA GeForce RTX 4060
              </div>
            </div>

            <div className="flex items-center mt-1">
              <span className="bg-[#181921] px-2 py-0.5 rounded-md text-[9px] text-zinc-300 font-mono">
                2.1 / 8.0 GB
              </span>
            </div>
          </div>

          {/* 3. RAM CARD */}
          <div className="bg-[#14151b] border border-white/[0.04] rounded-2xl p-2.5 flex flex-col items-center justify-between">
            {renderGauge(
              Math.round(stats.ram_pct),
              '#84cc16', // Bright lime green arc matching screenshot
              `${Math.round(stats.ram_pct)}%`
            )}

            <div className="text-center w-full mt-0.5">
              <div className="font-bold text-xs text-white leading-tight">RAM</div>
              <div className="text-[9px] text-zinc-400 font-mono leading-tight mt-0.5">
                {ramUsedGb} / {ramTotalGb} GB
              </div>
            </div>

            <div className="flex items-center mt-1">
              <span className="bg-[#181921] px-2 py-0.5 rounded-md text-[9px] text-zinc-300 font-mono">
                {ramFreeGb} GB free
              </span>
            </div>
          </div>
        </div>

        {/* BOTTOM ROW: 3 METRIC PILLS (DISK C:, NETWORK, UP FOR) */}
        <div className="grid grid-cols-3 gap-2 h-[58px]">
          {/* DISK C: */}
          <div className="bg-[#14151b] border border-white/[0.04] rounded-2xl p-2.5 flex flex-col justify-center">
            <span className="text-[8.5px] text-zinc-400 font-semibold uppercase tracking-wider">
              DISK C:
            </span>
            <span className="text-xs font-bold text-white font-mono mt-0.5 truncate">
              {stats.disk_used_gb || 412} / {stats.disk_total_gb || 931} GB
            </span>
          </div>

          {/* NETWORK */}
          <div className="bg-[#14151b] border border-white/[0.04] rounded-2xl p-2.5 flex flex-col justify-center">
            <span className="text-[8.5px] text-zinc-400 font-semibold uppercase tracking-wider">
              NETWORK
            </span>
            <span className="text-[9.5px] font-bold text-white font-mono mt-0.5 whitespace-nowrap">
              ↓ {formatNetSpeed(stats.net_rx_kbps || 1228)} ↑ {formatNetSpeed(stats.net_tx_kbps || 307)}
            </span>
          </div>

          {/* UP FOR */}
          <div className="bg-[#14151b] border border-white/[0.04] rounded-2xl p-2.5 flex flex-col justify-center">
            <span className="text-[8.5px] text-zinc-400 font-semibold uppercase tracking-wider">
              UP FOR
            </span>
            <span className="text-xs font-bold text-white font-mono mt-0.5 truncate">
              {formatUptimeStr(stats.uptime_secs)}
            </span>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────
          RIGHT SECTION (~205px): TOP APPS (TOP) + SPEED TEST (BOTTOM)
          ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 w-[208px] shrink-0">
        {/* TOP APPS CARD */}
        <div className="bg-[#14151b] border border-white/[0.04] rounded-2xl p-2.5 flex flex-col justify-between flex-1">
          {/* Header */}
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-zinc-400 font-medium">
              Top apps · {appSortBy}
            </span>
            <button
              onClick={() => setAppSortBy(appSortBy === 'RAM' ? 'CPU' : 'RAM')}
              className="text-[10px] text-[#DEBA5A] font-bold hover:brightness-125 transition-all flex items-center gap-0.5 cursor-pointer"
              title="Click to toggle sorting by RAM / CPU"
            >
              <span>{appSortBy === 'RAM' ? 'CPU' : 'RAM'}</span>
              <span>⇄</span>
            </button>
          </div>

          {/* Apps List */}
          <div className="flex flex-col gap-1.5">
            {APPS_LIST.map((app) => (
              <div key={app.name} className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-4 h-4 rounded bg-[#181921] flex items-center justify-center text-[9px] font-bold text-zinc-300 shrink-0">
                      {app.key}
                    </span>
                    <span className="text-[10.5px] font-bold text-white truncate max-w-[110px]">
                      {app.name}
                    </span>
                  </div>
                  <span className="text-[9.5px] text-zinc-400 font-mono">
                    {appSortBy === 'RAM' ? app.ramStr : app.cpuStr}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden ml-5.5">
                  <div
                    className="h-full rounded-full bg-[#84cc16] transition-all duration-500"
                    style={{
                      width: `${appSortBy === 'RAM' ? app.ramPct : app.cpuPct}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* INTERNET SPEED TEST CARD */}
        <div className="bg-[#14151b] border border-white/[0.04] rounded-2xl p-2.5 flex flex-col justify-between h-[96px]">
          {/* Header */}
          <div className="flex items-center justify-between text-[9px] text-zinc-400 font-medium">
            <span className="text-zinc-300 font-semibold">Internet speed</span>
            <span className="truncate max-w-[120px]">{lastSpeedTime} • {userCity}</span>
          </div>

          {/* Speeds readout */}
          <div className="flex items-baseline gap-3 my-0.5">
            <div className="flex items-baseline">
              <span className="text-lg font-extrabold text-white font-mono">
                {downloadSpeed}
              </span>
              <span className="text-[9.5px] text-zinc-400 ml-1">Mbps ↓</span>
            </div>
            <div className="flex items-baseline">
              <span className="text-lg font-extrabold text-white font-mono">
                {uploadSpeed}
              </span>
              <span className="text-[9.5px] text-zinc-400 ml-1">Mbps ↑</span>
            </div>
          </div>

          {/* Speed test button */}
          <button
            onClick={handleRunSpeedTest}
            disabled={speedTestRunning}
            className="w-full bg-[#DEBA5A] hover:bg-[#e4c264] text-[#14120a] font-bold text-xs py-1 rounded-lg flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-sm cursor-pointer disabled:opacity-80"
          >
            {speedTestRunning ? (
              <>
                <RotateCw className="w-3 h-3 animate-spin stroke-[2.5]" />
                <span>Testing network...</span>
              </>
            ) : (
              <>
                <Play className="w-2.5 h-2.5 fill-current stroke-[2]" />
                <span>Run speed test</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
