import React, { useState, useEffect, useRef } from 'react';
import { Sun, Cloud, CloudRain, Check, ArrowRight, X } from 'lucide-react';

interface TodoItem {
  id: string;
  text: string;
  done: boolean;
  pointsAwarded?: boolean;
}

interface FloatingPoints {
  id: number;
  x: number;
  y: number;
  text: string;
}

export const TodayView: React.FC = () => {
  // ── 1. CLOCK STATE ──────────────────────────────────────────
  const [currentTime, setCurrentTime] = useState(new Date());
  const [is24Hour, setIs24Hour] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatHours = () => {
    const hours = currentTime.getHours();
    if (is24Hour) {
      return String(hours).padStart(2, '0');
    }
    const h12 = hours % 12 || 12;
    return String(h12).padStart(2, '0');
  };

  const formatMinutes = () => {
    return String(currentTime.getMinutes()).padStart(2, '0');
  };

  const formatPeriod = () => {
    return currentTime.getHours() >= 12 ? 'PM' : 'AM';
  };

  const formatDayName = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[currentTime.getDay()];
  };

  const formatDayNumber = () => {
    return currentTime.getDate();
  };

  // ── 2. WEATHER STATE ────────────────────────────────────────
  const [weatherTemp, setWeatherTemp] = useState<number>(32);
  const [weatherCondition, setWeatherCondition] = useState<string>('Mostly clear');
  const [weatherCode, setWeatherCode] = useState<number>(0);
  const [tempUnit, setTempUnit] = useState<'C' | 'F'>('C');

  const fetchWeather = async () => {
    try {
      let lat = 28.6139;
      let lon = 77.2090;

      try {
        const ipRes = await fetch('https://ipapi.co/json/');
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          if (ipData.latitude && ipData.longitude) {
            lat = ipData.latitude;
            lon = ipData.longitude;
          }
        }
      } catch {
        // use default coordinates
      }

      const wRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`
      );

      if (wRes.ok) {
        const wData = await wRes.json();
        const cur = wData.current;
        const code = cur.weather_code || 0;
        let cond = 'Mostly clear';
        if (code === 0) cond = 'Clear sky';
        else if (code > 0 && code <= 3) cond = 'Mostly clear';
        else if (code >= 45 && code <= 48) cond = 'Foggy';
        else if (code >= 51 && code <= 67) cond = 'Rainy';
        else if (code >= 71 && code <= 77) cond = 'Snow';
        else if (code >= 95) cond = 'Thunderstorm';

        setWeatherCode(code);
        setWeatherTemp(Math.round(cur.temperature_2m));
        setWeatherCondition(cond);
      }
    } catch {
      // Fallback stays as default
    }
  };

  useEffect(() => {
    fetchWeather();
  }, []);

  const displayTemp = () => {
    if (tempUnit === 'F') {
      return Math.round((weatherTemp * 9) / 5 + 32);
    }
    return weatherTemp;
  };

  // ── 3. THIS WEEK CALENDAR STATE ─────────────────────────────
  // Calculate current week days (Mon -> Sun)
  const getWeekDates = () => {
    const now = new Date();
    const currentDay = now.getDay(); // 0 is Sunday, 1 is Monday...
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);

    const week = [];
    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      week.push({
        label: dayLabels[i],
        date: d.getDate(),
        fullDate: d,
        isToday: d.toDateString() === now.toDateString(),
      });
    }
    return week;
  };

  const weekDays = getWeekDates();
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(() => {
    const todayIdx = weekDays.findIndex((w) => w.isToday);
    return todayIdx >= 0 ? todayIdx : 1; // Default to Tuesday like screenshot if not found
  });

  // Format week range e.g. "Sep 28 – Oct 4"
  const getWeekRangeStr = () => {
    if (weekDays.length === 0) return 'This week';
    const first = weekDays[0].fullDate;
    const last = weekDays[6].fullDate;
    const m1 = first.toLocaleDateString([], { month: 'short' });
    const m2 = last.toLocaleDateString([], { month: 'short' });
    if (m1 === m2) {
      return `${m1} ${first.getDate()} – ${last.getDate()}`;
    }
    return `${m1} ${first.getDate()} – ${m2} ${last.getDate()}`;
  };

  // ── 4. FOCUS TIMER STATE ────────────────────────────────────
  const PRESET_DURATIONS = [
    { label: '1m', seconds: 60 },
    { label: '5m', seconds: 300 },
    { label: '10m', seconds: 600 },
    { label: '15m', seconds: 900 },
    { label: '20m', seconds: 1200 },
  ];

  const [timerPreset, setTimerPreset] = useState<number>(300); // 5m default
  const [timeLeft, setTimeLeft] = useState<number>(300);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const timerRef = useRef<number | null>(null);

  // Play audio chime on timer finish
  const playSoundChime = (type: 'beep' | 'success') => {
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'success') {
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else {
        osc.frequency.setValueAtTime(740, ctx.currentTime);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      }
    } catch {
      // AudioContext unavailable or restricted
    }
  };

  useEffect(() => {
    if (isTimerRunning) {
      timerRef.current = window.setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsTimerRunning(false);
            if (timerRef.current) clearInterval(timerRef.current);
            playSoundChime('beep');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerRunning]);

  const selectPreset = (seconds: number) => {
    setIsTimerRunning(false);
    setTimerPreset(seconds);
    setTimeLeft(seconds);
  };

  const toggleTimer = () => {
    if (timeLeft === 0) {
      setTimeLeft(timerPreset);
    }
    setIsTimerRunning((prev) => !prev);
  };

  const resetTimer = () => {
    setIsTimerRunning(false);
    setTimeLeft(timerPreset);
  };

  const timerHours = Math.floor(timeLeft / 3600);
  const timerMinutes = Math.floor((timeLeft % 3600) / 60);
  const timerSecs = timeLeft % 60;
  const timerDisplayStr = `${String(timerMinutes).padStart(2, '0')}:${String(timerSecs).padStart(2, '0')}`;

  // Circular progress math
  const ringRadius = 28;
  const circumference = 2 * Math.PI * ringRadius;
  const progressRatio = timerPreset > 0 ? timeLeft / timerPreset : 0;
  const strokeDashoffset = circumference - progressRatio * circumference;

  // ── 5. TODAY TO-DO STATE ────────────────────────────────────
  const [todos, setTodos] = useState<TodoItem[]>(() => {
    const saved = localStorage.getItem('boty_today_todos_v2');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return [{ id: 't1', text: 'Buy Hitodama!', done: false }];
  });

  const [newTodoText, setNewTodoText] = useState('');
  const [floatingPoints, setFloatingPoints] = useState<FloatingPoints[]>([]);

  useEffect(() => {
    localStorage.setItem('boty_today_todos_v2', JSON.stringify(todos));
  }, [todos]);

  const triggerPointCelebration = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const newPoint: FloatingPoints = {
      id: Date.now(),
      x: rect.left + rect.width / 2,
      y: rect.top,
      text: '+4',
    };
    setFloatingPoints((prev) => [...prev, newPoint]);
    playSoundChime('success');

    setTimeout(() => {
      setFloatingPoints((prev) => prev.filter((p) => p.id !== newPoint.id));
    }, 1200);
  };

  const toggleTodo = (id: string, e: React.MouseEvent) => {
    setTodos((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const nextDone = !item.done;
          if (nextDone) {
            triggerPointCelebration(e);
          }
          return { ...item, done: nextDone };
        }
        return item;
      })
    );
  };

  const deleteTodo = (id: string) => {
    setTodos((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAddTodo = () => {
    if (!newTodoText.trim()) return;
    setTodos((prev) => [
      ...prev,
      { id: `t-${Date.now()}`, text: newTodoText.trim(), done: false },
    ]);
    setNewTodoText('');
  };

  const doneCount = todos.filter((t) => t.done).length;
  const totalCount = todos.length;

  return (
    <div className="flex p-2.5 gap-2 text-zinc-200 bg-[#07080c]/90 h-full select-none overflow-hidden justify-between relative">
      {/* Floating "+4" Celebratory points particles */}
      {floatingPoints.map((pt) => (
        <div
          key={pt.id}
          className="pointer-events-none fixed z-50 flex items-center gap-1 font-bold text-xs text-[#f87171] animate-fade-float"
          style={{
            left: `${pt.x - 12}px`,
            top: `${pt.y - 18}px`,
          }}
        >
          <span>{pt.text}</span>
          <div className="w-1 h-1 rounded-full bg-[#DEBA5A] animate-ping" />
        </div>
      ))}

      {/* ─────────────────────────────────────────────────────────
          COLUMN 1 (LEFT ~110px): CLOCK & WEATHER CARDS
          ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 w-[114px] shrink-0">
        {/* Clock Card */}
        <div
          onClick={() => setIs24Hour(!is24Hour)}
          className="bg-[#14151b] border border-white/[0.04] rounded-2xl p-2.5 flex flex-col items-center justify-center flex-1 cursor-pointer hover:border-[#DEBA5A]/25 transition-all group"
          title="Click to toggle 12h / 24h format"
        >
          {/* Hours */}
          <div className="text-3xl font-extrabold text-white tracking-tight leading-none group-hover:text-amber-100 transition-colors">
            {formatHours()}
          </div>

          {/* Golden 3 Dots Separator */}
          <div className="flex items-center gap-1 my-1.5">
            <span className="w-1 h-1 rounded-full bg-[#DEBA5A]" />
            <span className="w-1 h-1 rounded-full bg-[#DEBA5A]" />
            <span className="w-1 h-1 rounded-full bg-[#DEBA5A]" />
          </div>

          {/* Minutes */}
          <div className="text-3xl font-extrabold text-white tracking-tight leading-none group-hover:text-amber-100 transition-colors">
            {formatMinutes()}
          </div>

          {/* AM / PM + Day */}
          <div className="text-[10px] text-zinc-400 font-medium mt-2 leading-none">
            {formatPeriod()} · {formatDayName()} {formatDayNumber()}
          </div>
        </div>

        {/* Weather Card */}
        <div
          onClick={() => setTempUnit(tempUnit === 'C' ? 'F' : 'C')}
          className="bg-[#14151b] border border-white/[0.04] rounded-2xl p-2.5 flex flex-col items-center justify-center flex-1 cursor-pointer hover:border-[#DEBA5A]/25 transition-all group"
          title="Click to toggle °C / °F"
        >
          {weatherCode >= 51 && weatherCode <= 67 ? (
            <CloudRain className="w-6 h-6 text-sky-400 mb-1" />
          ) : weatherCode > 0 && weatherCode <= 48 ? (
            <Cloud className="w-6 h-6 text-sky-200 mb-1" />
          ) : (
            <Sun className="w-6 h-6 text-[#DEBA5A] mb-1 group-hover:rotate-45 transition-transform duration-500" />
          )}

          <div className="text-xl font-bold text-white tracking-tight leading-none mt-0.5">
            {displayTemp()}°{tempUnit}
          </div>

          <div className="text-[10px] text-zinc-400 font-medium mt-1 text-center truncate max-w-full">
            {weatherCondition}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────
          COLUMN 2 (CENTER ~270px): THIS WEEK & FOCUS TIMER
          ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 w-[270px] shrink-0">
        {/* This Week Card */}
        <div className="bg-[#14151b] border border-white/[0.04] rounded-2xl p-2.5 flex flex-col justify-between h-[126px]">
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white">This week</span>
            <span className="text-[10px] text-zinc-400 font-normal">
              {getWeekRangeStr()}
            </span>
          </div>

          {/* 7 Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center mt-1">
            {weekDays.map((day, idx) => {
              const isSelected = idx === selectedDayIndex;
              return (
                <div
                  key={day.label}
                  onClick={() => setSelectedDayIndex(idx)}
                  className="flex flex-col items-center gap-1 cursor-pointer group"
                >
                  <span className="text-[9.5px] text-zinc-400 font-medium">
                    {day.label}
                  </span>
                  <div
                    className={`w-6 h-6 rounded-md flex items-center justify-center text-xs transition-all ${
                      isSelected
                        ? 'bg-[#DEBA5A] text-[#14120a] font-bold shadow-sm'
                        : 'text-zinc-200 font-medium hover:bg-white/[0.06]'
                    }`}
                  >
                    {day.date}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Next Event Pill */}
          <div className="bg-[#181921] rounded-xl p-2 flex items-center gap-2.5 border border-white/[0.03]">
            <div className="w-1 h-5 bg-[#ec4899] rounded-full shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-[10.5px] font-bold text-white leading-tight">
                Next · 11:00 AM
              </span>
              <span className="text-[9.5px] text-zinc-400 truncate leading-tight mt-0.5">
                Daily AI news research
              </span>
            </div>
          </div>
        </div>

        {/* Focus Timer (Pomodoro) Card */}
        <div className="bg-[#14151b] border border-white/[0.04] rounded-2xl p-2.5 flex items-center gap-2.5 h-[126px]">
          {/* Left: Circular Countdown Ring */}
          <div className="relative flex items-center justify-center w-[72px] h-[72px] shrink-0">
            <svg className="w-[72px] h-[72px] -rotate-90 transform" viewBox="0 0 72 72">
              {/* Background circle track */}
              <circle
                cx="36"
                cy="36"
                r={ringRadius}
                fill="none"
                stroke="rgba(255, 255, 255, 0.08)"
                strokeWidth="3.5"
              />
              {/* Dynamic Accent Progress Ring */}
              <circle
                cx="36"
                cy="36"
                r={ringRadius}
                fill="none"
                stroke="var(--app-accent)"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-500 ease-linear"
              />
            </svg>
            <span className="absolute font-bold text-xs text-white font-mono tracking-tight">
              {timerDisplayStr}
            </span>
          </div>

          {/* Right: Controls & Presets */}
          <div className="flex flex-col justify-between flex-1 h-full py-0.5">
            {/* Top row: Hour / Min inputs display */}
            <div className="flex items-center gap-1.5">
              <div
                onClick={() => selectPreset(timerPreset + 3600)}
                className="flex-1 bg-[#181921] rounded-lg py-1 px-1.5 text-center cursor-pointer hover:bg-[#20222b] transition-colors"
                title="Click to increase hours"
              >
                <span className="text-xs font-bold text-white font-mono">{timerHours}</span>
                <span className="text-[9.5px] text-zinc-400 ml-1">h</span>
              </div>
              <div
                onClick={() => selectPreset((timerPreset % 3600) + 300)}
                className="flex-1 bg-[#181921] rounded-lg py-1 px-1.5 text-center cursor-pointer hover:bg-[#20222b] transition-colors"
                title="Click to increase minutes"
              >
                <span className="text-xs font-bold text-white font-mono">
                  {String(timerMinutes).padStart(2, '0')}
                </span>
                <span className="text-[9.5px] text-zinc-400 ml-1">min</span>
              </div>
            </div>

            {/* Middle row: Preset chips */}
            <div className="flex items-center justify-between gap-1">
              {PRESET_DURATIONS.map((preset) => {
                const isActive = timerPreset === preset.seconds;
                return (
                  <button
                    key={preset.label}
                    onClick={() => selectPreset(preset.seconds)}
                    className={`text-[9.5px] px-1.5 py-0.5 rounded-md font-medium transition-all ${
                      isActive
                        ? 'bg-app-accent font-bold shadow-sm'
                        : 'bg-[#181921] text-zinc-400 hover:text-white hover:bg-[#20222b]'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            {/* Bottom row: Start / Pause & Reset buttons */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={toggleTimer}
                className="flex-1 bg-app-accent hover:opacity-90 font-bold text-xs py-1 rounded-lg transition-transform active:scale-95 shadow-sm"
              >
                {isTimerRunning ? 'Pause' : 'Start'}
              </button>
              <button
                onClick={resetTimer}
                className="bg-[#181921] hover:bg-[#20222b] text-white font-medium text-xs py-1 px-3 rounded-lg border border-white/[0.04] transition-colors active:scale-95"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────
          COLUMN 3 (RIGHT ~195px): TODAY TO-DO LIST
          ───────────────────────────────────────────────────────── */}
      <div className="bg-[#14151b] border border-white/[0.04] rounded-2xl p-2.5 flex flex-col justify-between flex-1 min-w-[195px]">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-white">Today</span>
          <span className="bg-[#0e2417] text-[#4ade80] border border-[#166534] text-[9.5px] font-mono px-2 py-0.5 rounded-full font-bold">
            {doneCount}/{totalCount}
          </span>
        </div>

        {/* To-Do Items List */}
        <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[160px] pr-0.5 flex-1 custom-scrollbar">
          {todos.map((todo) => (
            <div
              key={todo.id}
              className="bg-[#181921] rounded-xl p-2 flex items-center justify-between border border-white/[0.03] hover:bg-[#1e202a] transition-all group"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {/* Custom Checkbox matching green circle with checkmark */}
                <button
                  onClick={(e) => toggleTodo(todo.id, e)}
                  className={`w-4 h-4 rounded-full flex items-center justify-center transition-all shrink-0 ${
                    todo.done
                      ? 'bg-[#52a447] text-white shadow-sm'
                      : 'border border-zinc-600 hover:border-[#DEBA5A] bg-transparent'
                  }`}
                >
                  {todo.done && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                </button>

                <span
                  className={`text-xs truncate transition-all ${
                    todo.done
                      ? 'line-through text-zinc-500'
                      : 'text-zinc-200 group-hover:text-white'
                  }`}
                >
                  {todo.text}
                </span>
              </div>

              {/* Remove button on hover */}
              <button
                onClick={() => deleteTodo(todo.id)}
                className="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-500 hover:text-zinc-200 transition-opacity ml-1"
                title="Delete task"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}

          {todos.length === 0 && (
            <div className="text-[10px] text-zinc-500 text-center py-4">
              All tasks completed! ✨
            </div>
          )}
        </div>

        {/* Add To-Do Input Bar */}
        <div className="bg-[#181921] rounded-xl p-1 pl-2.5 flex items-center justify-between border border-white/[0.04] mt-2">
          <input
            type="text"
            value={newTodoText}
            onChange={(e) => setNewTodoText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddTodo();
            }}
            placeholder="+ Add a to-do..."
            className="bg-transparent border-none outline-none text-xs text-white placeholder-zinc-500 flex-1 mr-1"
          />
          <button
            onClick={handleAddTodo}
            className="w-6 h-6 rounded-full bg-[#DEBA5A] hover:bg-[#e6c466] text-[#14120a] flex items-center justify-center font-bold transition-transform active:scale-95 shadow-sm shrink-0"
            title="Add to-do"
          >
            <ArrowRight className="w-3 h-3 stroke-[2.5]" />
          </button>
        </div>
      </div>
    </div>
  );
};
