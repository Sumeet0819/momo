import React, { useState } from 'react';
import { 
  Calendar, 
  Plus, 
  Trash2, 
  Clock, 
  Play,
  X
} from 'lucide-react';
import { useAssistantStore } from '../store/useAssistantStore';
import { ScheduledTaskItem } from '../types/assistant';

export const TasksView: React.FC = () => {
  const { tasks, addTask, toggleTask, deleteTask, addMessage, setMode } = useAssistantStore();
  const [showAddForm, setShowAddForm] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [scheduleTime, setScheduleTime] = useState('09:00 AM');
  const [recurrence, setRecurrence] = useState<ScheduledTaskItem['recurrence']>('daily');
  const [actionPayload, setActionPayload] = useState('');

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !actionPayload.trim()) return;

    addTask({
      name: name.trim(),
      scheduleTime,
      recurrence,
      actionType: 'prompt',
      actionPayload: actionPayload.trim(),
      enabled: true
    });

    setName('');
    setActionPayload('');
    setShowAddForm(false);
  };

  const handleTriggerNow = (task: ScheduledTaskItem) => {
    addMessage({
      role: 'user',
      content: `[Manual Execution of Routine: "${task.name}"]\n${task.actionPayload}`
    });
    setMode('chat');
  };

  return (
    <div className="flex flex-col p-4 text-zinc-200 bg-[#08090e]/70">
      {/* Clean Minimal Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
        <div>
          <h2 className="text-xs font-semibold text-zinc-100 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-violet-400" />
            <span>Routines</span>
            <span className="text-[10px] text-zinc-400 font-normal ml-1">
              ({tasks.filter(t => t.enabled).length} active)
            </span>
          </h2>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            Automated tasks that execute in the background.
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className={`flex items-center gap-1.5 py-1 px-3 rounded-full text-xs font-medium transition-all cursor-pointer ${
            showAddForm 
              ? 'bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1]' 
              : 'bg-violet-600 hover:bg-violet-500 text-white shadow-[0_0_12px_rgba(139,92,246,0.3)]'
          }`}
        >
          {showAddForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          <span>{showAddForm ? 'Cancel' : 'New Routine'}</span>
        </button>
      </div>

      {/* New Routine Form (when opened) */}
      {showAddForm && (
        <form 
          onSubmit={handleCreateTask}
          className="my-3 p-3.5 rounded-2xl dark-card flex flex-col gap-2.5 animate-fadeIn"
        >
          <div className="text-xs font-medium text-zinc-200">New Automated Routine</div>
          
          <input
            type="text"
            placeholder="Routine name (e.g. Daily Standup Prep)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full dark-input rounded-xl px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none"
          />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-zinc-400 block mb-1">Time</label>
              <input
                type="text"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                placeholder="09:00 AM"
                className="w-full dark-input rounded-xl px-2.5 py-1 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-400 block mb-1">Frequency</label>
              <select
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as any)}
                className="w-full dark-input rounded-xl px-2.5 py-1 text-xs text-white focus:outline-none"
              >
                <option value="daily">Daily</option>
                <option value="weekdays">Weekdays</option>
                <option value="hourly">Hourly</option>
                <option value="once">Once</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] text-zinc-400 block mb-1">Instruction for Boty</label>
            <textarea
              value={actionPayload}
              onChange={(e) => setActionPayload(e.target.value)}
              placeholder="What should Boty summarize or execute?"
              rows={2}
              required
              className="w-full dark-input rounded-xl p-2 text-xs text-white placeholder-zinc-500 focus:outline-none resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1 rounded-xl text-xs text-zinc-400 hover:text-zinc-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3.5 py-1 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium cursor-pointer"
            >
              Save Routine
            </button>
          </div>
        </form>
      )}

      {/* Routine Cards List */}
      <div className="space-y-2.5 py-3 pr-1 max-h-[260px] overflow-y-auto">
        {tasks.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500">
            <Clock className="w-8 h-8 stroke-[1.2] mb-2 text-zinc-600" />
            <p className="text-xs font-medium text-zinc-400">No active routines</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">Click "+ New Routine" to create an automated scheduled task.</p>
          </div>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className={`p-3.5 rounded-2xl dark-card flex flex-col gap-2 transition-all ${
                task.enabled ? 'border-white/[0.08]' : 'opacity-60'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-medium text-zinc-100">{task.name}</h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono text-zinc-400 bg-white/[0.04] border border-white/[0.04]">
                    {task.recurrence} · {task.scheduleTime}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleTriggerNow(task)}
                    className="p-1 rounded-lg text-zinc-400 hover:text-violet-300 hover:bg-white/[0.06] transition-colors"
                    title="Run routine now"
                  >
                    <Play className="w-3 h-3 fill-current" />
                  </button>
                  <button
                    onClick={() => toggleTask(task.id)}
                    className={`w-7 h-4 rounded-full transition-all relative ${
                      task.enabled ? 'bg-violet-600' : 'bg-zinc-800'
                    }`}
                    title={task.enabled ? 'Active' : 'Paused'}
                  >
                    <span 
                      className={`block w-3 h-3 rounded-full bg-white transition-transform ${
                        task.enabled ? 'translate-x-3.5' : 'translate-x-0.5'
                      }`} 
                    />
                  </button>
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="p-1 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/20 transition-colors ml-0.5"
                    title="Delete"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">
                {task.actionPayload}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Footer Minimal Tip */}
      <div className="pt-2 border-t border-white/[0.04] text-[10px] text-zinc-400 text-center">
        Routines execute in background and notify you when summaries are ready.
      </div>
    </div>
  );
};
