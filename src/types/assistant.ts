export type AppMode = 'chat' | 'voice' | 'screen' | 'tools' | 'tasks' | 'settings';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  imageUrl?: string;
  isStreaming?: boolean;
  toolCalls?: ToolExecutionCall[];
}

export interface ToolExecutionCall {
  id: string;
  toolId: string;
  toolName: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  status: 'pending' | 'requires_confirmation' | 'executing' | 'success' | 'error';
  errorMessage?: string;
}

export interface DesktopTool {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  requiresConfirmation: boolean;
  category: 'system' | 'browser' | 'productivity' | 'clipboard';
  inputSchema: Record<string, string>;
}

export interface ScheduledTaskItem {
  id: string;
  name: string;
  scheduleTime: string;
  recurrence: 'once' | 'daily' | 'weekdays' | 'hourly';
  actionType: 'prompt' | 'tool_call' | 'notification';
  actionPayload: string;
  enabled: boolean;
  lastRun?: number;
  lastStatus?: 'success' | 'failed';
  nextRun: number;
}

export interface AssistantSettings {
  apiKey: string;
  model: string;
  hoverCollapseDelayMs: number;
  autoStartOnBoot: boolean;
  alwaysOnTop: boolean;
  saveScreenshots: boolean;
  globalShortcuts: {
    toggleAssistant: string;
    startDictation: string;
    captureScreen: string;
  };
}

export interface ScreenRegionSelection {
  x: number;
  y: number;
  width: number;
  height: number;
  previewDataUrl?: string;
}
