import { create } from 'zustand';
import { 
  AppMode, 
  ChatMessage, 
  DesktopTool, 
  ScheduledTaskItem, 
  AssistantSettings, 
  ScreenRegionSelection 
} from '../types/assistant';

interface AssistantState {
  // Shell UI State
  isExpanded: boolean;
  isPinned: boolean;
  isHovered: boolean;
  currentMode: AppMode;
  statusText: string;
  
  // Chat State
  messages: ChatMessage[];
  isGenerating: boolean;
  
  // Voice Dictation
  isRecording: boolean;
  dictatedText: string;
  audioLevel: number;
  
  // Screen Capture
  screenCapture: ScreenRegionSelection | null;
  isCapturingScreen: boolean;
  
  // Desktop Tools
  tools: DesktopTool[];
  
  // Tasks & Routines
  tasks: ScheduledTaskItem[];
  
  // Settings
  settings: AssistantSettings;
  
  // Actions
  setExpanded: (expanded: boolean) => void;
  togglePinned: () => void;
  setHovered: (hovered: boolean) => void;
  setMode: (mode: AppMode) => void;
  setStatusText: (status: string) => void;
  
  // Chat Actions
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => string;
  appendToLastMessage: (delta: string) => void;
  setGenerating: (generating: boolean) => void;
  clearMessages: () => void;
  
  // Dictation Actions
  setRecording: (recording: boolean) => void;
  setDictatedText: (text: string) => void;
  setAudioLevel: (level: number) => void;
  
  // Screen Capture Actions
  setScreenCapture: (capture: ScreenRegionSelection | null) => void;
  setCapturingScreen: (capturing: boolean) => void;
  
  // Tool Actions
  toggleTool: (toolId: string) => void;
  toggleToolConfirmation: (toolId: string) => void;
  
  // Task Actions
  addTask: (task: Omit<ScheduledTaskItem, 'id' | 'nextRun'>) => void;
  toggleTask: (taskId: string) => void;
  deleteTask: (taskId: string) => void;
  
  // Settings Actions
  updateSettings: (settings: Partial<AssistantSettings>) => void;
}

const defaultTools: DesktopTool[] = [
  {
    id: 'open_app',
    name: 'Open Application',
    description: 'Launch an allowlisted Windows desktop application (e.g. Notepad, Terminal, Calculator).',
    enabled: true,
    requiresConfirmation: false,
    category: 'system',
    inputSchema: { appName: 'string' }
  },
  {
    id: 'open_url',
    name: 'Open URL',
    description: 'Open a safe web link in your default system browser.',
    enabled: true,
    requiresConfirmation: false,
    category: 'browser',
    inputSchema: { url: 'string' }
  },
  {
    id: 'web_search',
    name: 'Web Search',
    description: 'Search using approved search provider without opening full browser.',
    enabled: true,
    requiresConfirmation: false,
    category: 'browser',
    inputSchema: { query: 'string' }
  },
  {
    id: 'insert_text',
    name: 'Insert Text',
    description: 'Insert user-approved transcribed or generated text into active window.',
    enabled: true,
    requiresConfirmation: true,
    category: 'clipboard',
    inputSchema: { text: 'string' }
  },
  {
    id: 'get_clipboard',
    name: 'Read Clipboard',
    description: 'Read the currently selected or copied text when explicitly requested.',
    enabled: true,
    requiresConfirmation: true,
    category: 'clipboard',
    inputSchema: {}
  }
];

const defaultTasks: ScheduledTaskItem[] = [
  {
    id: 'task-1',
    name: 'Daily Morning Briefing',
    scheduleTime: '09:00 AM',
    recurrence: 'weekdays',
    actionType: 'prompt',
    actionPayload: 'Summarize today\'s priority tasks and weather forecast.',
    enabled: true,
    nextRun: Date.now() + 3600000 * 10
  },
  {
    id: 'task-2',
    name: 'Focus Break Reminder',
    scheduleTime: 'Every 60m',
    recurrence: 'hourly',
    actionType: 'notification',
    actionPayload: 'Time to rest eyes for 20 seconds and stretch.',
    enabled: true,
    nextRun: Date.now() + 3600000
  }
];

export const useAssistantStore = create<AssistantState>((set, get) => ({
  isExpanded: false,
  isPinned: false,
  isHovered: false,
  currentMode: 'chat',
  statusText: 'Ready',
  
  messages: [
    {
      id: 'welcome-1',
      role: 'assistant',
      content: "Hello! I'm your desktop assistant. Hover over me anytime, use global shortcuts, or tap the microphone to dictate.",
      timestamp: Date.now()
    }
  ],
  isGenerating: false,
  
  isRecording: false,
  dictatedText: '',
  audioLevel: 0,
  
  screenCapture: null,
  isCapturingScreen: false,
  
  tools: defaultTools,
  tasks: defaultTasks,
  
  settings: {
    apiKey: localStorage.getItem('boty_gemini_api_key') || '',
    model: 'gemini-2.0-flash',
    hoverCollapseDelayMs: 350,
    autoStartOnBoot: false,
    alwaysOnTop: true,
    saveScreenshots: false,
    globalShortcuts: {
      toggleAssistant: 'Alt+Space',
      startDictation: 'Alt+D',
      captureScreen: 'Alt+S'
    }
  },

  setExpanded: (expanded) => {
    // If pinned, prevent automatic collapsing
    if (!expanded && get().isPinned) return;
    set({ isExpanded: expanded });
  },

  togglePinned: () => set((state) => ({ isPinned: !state.isPinned, isExpanded: true })),
  
  setHovered: (hovered) => set({ isHovered: hovered }),
  
  setMode: (mode) => set({ currentMode: mode, isExpanded: true }),
  
  setStatusText: (statusText) => set({ statusText }),

  addMessage: (msg) => {
    const id = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    set((state) => ({
      messages: [...state.messages, { ...msg, id, timestamp: Date.now() }]
    }));
    return id;
  },

  appendToLastMessage: (delta) => {
    set((state) => {
      if (state.messages.length === 0) return state;
      const last = { ...state.messages[state.messages.length - 1] };
      last.content += delta;
      return {
        messages: [...state.messages.slice(0, -1), last]
      };
    });
  },

  setGenerating: (generating) => set({ isGenerating: generating }),

  clearMessages: () => set({ messages: [] }),

  setRecording: (recording) => set({ isRecording: recording }),
  
  setDictatedText: (dictatedText) => set({ dictatedText }),
  
  setAudioLevel: (audioLevel) => set({ audioLevel }),

  setScreenCapture: (screenCapture) => set({ screenCapture }),
  
  setCapturingScreen: (isCapturingScreen) => set({ isCapturingScreen }),

  toggleTool: (toolId) => {
    set((state) => ({
      tools: state.tools.map((t) => (t.id === toolId ? { ...t, enabled: !t.enabled } : t))
    }));
  },

  toggleToolConfirmation: (toolId) => {
    set((state) => ({
      tools: state.tools.map((t) => (t.id === toolId ? { ...t, requiresConfirmation: !t.requiresConfirmation } : t))
    }));
  },

  addTask: (task) => {
    const id = `task-${Date.now()}`;
    set((state) => ({
      tasks: [...state.tasks, { ...task, id, nextRun: Date.now() + 3600000 }]
    }));
  },

  toggleTask: (taskId) => {
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, enabled: !t.enabled } : t))
    }));
  },

  deleteTask: (taskId) => {
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== taskId)
    }));
  },

  updateSettings: (newSettings) => {
    set((state) => {
      const merged = { ...state.settings, ...newSettings };
      if (newSettings.apiKey !== undefined) {
        localStorage.setItem('boty_gemini_api_key', newSettings.apiKey);
      }
      return { settings: merged };
    });
  }
}));
