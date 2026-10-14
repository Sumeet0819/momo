import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Square, 
  Trash2, 
  Sparkles, 
  Copy, 
  Check, 
  Image as ImageIcon,
  X,
  AlertCircle
} from 'lucide-react';
import { useAssistantStore } from '../store/useAssistantStore';
import { aiService } from '../services/aiService';

export const ChatView: React.FC = () => {
  const { 
    messages, 
    isGenerating, 
    tools, 
    settings, 
    screenCapture, 
    addMessage, 
    appendToLastMessage, 
    setGenerating, 
    clearMessages, 
    setScreenCapture,
    setMode 
  } = useAssistantStore();

  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed && !screenCapture) return;

    if (!settings.apiKey) {
      setErrorMessage("Gemini API key is required. Please set your key in Settings.");
      return;
    }

    setErrorMessage(null);
    setInput('');

    // Attach screen capture image if present
    const imageUrl = screenCapture?.previewDataUrl;
    setScreenCapture(null); // Clear after attaching

    addMessage({
      role: 'user',
      content: trimmed,
      imageUrl
    });

    // Add initial placeholder message for assistant
    addMessage({
      role: 'assistant',
      content: ''
    });

    setGenerating(true);

    const updatedMessages = [
      ...messages,
      {
        id: 'tmp-user',
        role: 'user' as const,
        content: trimmed,
        imageUrl,
        timestamp: Date.now()
      }
    ];

    await aiService.streamChat(
      settings.apiKey,
      settings.model,
      updatedMessages,
      tools,
      {
        onChunk: (chunk) => {
          appendToLastMessage(chunk);
        },
        onToolCall: (toolCall) => {
          appendToLastMessage(`\n\n*[Triggered Tool: \`${toolCall.name}\` with arguments ${JSON.stringify(toolCall.args)}]*\n`);
        },
        onError: (err) => {
          setGenerating(false);
          setErrorMessage(err.message);
          appendToLastMessage(`\n\n⚠️ Error: ${err.message}`);
        },
        onComplete: () => {
          setGenerating(false);
        }
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleStop = () => {
    aiService.cancelStream();
    setGenerating(false);
  };

  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex flex-col h-full text-zinc-200 bg-[#07080c]/60">
      {/* Top action bar */}
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-white/[0.06] bg-[#090b12]/80 text-[11px] text-zinc-400">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-violet-950/60 border border-violet-500/30 text-violet-300 font-medium">
            <Sparkles className="w-3 h-3 text-violet-400" />
            <span className="text-[10px] tracking-wide">{settings.model}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clearMessages}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05] transition-all"
            title="Clear conversation"
          >
            <Trash2 className="w-3 h-3 text-zinc-500" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Error banner */}
      {errorMessage && (
        <div className="mx-3.5 my-2.5 p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
          <button 
            onClick={() => setMode('settings')} 
            className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-[11px] font-semibold border border-rose-500/30"
          >
            Settings
          </button>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 select-text">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div 
              key={msg.id} 
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              <div 
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed transition-all ${
                  isUser 
                    ? 'accent-gradient-btn text-white rounded-br-none' 
                    : 'bg-[#0e1017]/95 text-zinc-200 border border-white/[0.07] rounded-bl-none shadow-xl shadow-black/50'
                }`}
              >
                {/* Embedded screenshot if present */}
                {msg.imageUrl && (
                  <div className="mb-2.5 rounded-xl overflow-hidden border border-white/10 max-h-48 bg-[#050608] shadow-inner">
                    <img 
                      src={msg.imageUrl} 
                      alt="Screen Capture" 
                      className="w-full object-contain" 
                    />
                  </div>
                )}
                
                {/* Content */}
                <div className="whitespace-pre-wrap break-words font-sans">
                  {msg.content || (isGenerating && !isUser ? (
                    <span className="inline-flex items-center gap-1.5 text-zinc-400 animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shadow-[0_0_6px_#8b5cf6]"></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shadow-[0_0_6px_#8b5cf6] animation-delay-200"></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shadow-[0_0_6px_#8b5cf6] animation-delay-400"></span>
                      <span className="text-[11px]">Reasoning...</span>
                    </span>
                  ) : null)}
                </div>
              </div>

              {/* Message metadata / copy */}
              {!isUser && msg.content && (
                <div className="flex items-center gap-2 mt-1 px-1.5 text-[10px] text-zinc-500">
                  <button
                    onClick={() => copyToClipboard(msg.id, msg.content)}
                    className="flex items-center gap-1 hover:text-zinc-300 transition-colors"
                  >
                    {copiedId === msg.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedId === msg.id ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Screen capture preview badge */}
      {screenCapture && (
        <div className="mx-3.5 mb-2 p-2 rounded-xl bg-violet-950/40 border border-violet-500/30 flex items-center justify-between text-xs text-violet-200 shadow-lg">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-violet-400" />
            <span className="font-medium text-[11px]">Screenshot Attached ({screenCapture.width}×{screenCapture.height}px)</span>
          </div>
          <button 
            onClick={() => setScreenCapture(null)}
            className="p-1 hover:text-white rounded-md hover:bg-white/10 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Quick suggestions if few messages */}
      {messages.length <= 1 && (
        <div className="px-3.5 pb-2.5 flex gap-2 overflow-x-auto text-[11px] text-zinc-400 no-scrollbar">
          <button 
            onClick={() => setInput("What are best practices for high performance desktop apps in Tauri?")}
            className="px-2.5 py-1 rounded-full dark-card text-zinc-300 hover:text-white whitespace-nowrap transition-all"
          >
            ⚡ Tauri Performance
          </button>
          <button 
            onClick={() => setInput("Draft a quick email summarizing project status")}
            className="px-2.5 py-1 rounded-full dark-card text-zinc-300 hover:text-white whitespace-nowrap transition-all"
          >
            ✉️ Draft Status Email
          </button>
          <button 
            onClick={() => setInput("Explain this error message")}
            className="px-2.5 py-1 rounded-full dark-card text-zinc-300 hover:text-white whitespace-nowrap transition-all"
          >
            🔍 Explain Error
          </button>
        </div>
      )}

      {/* Input Form */}
      <div className="p-3 border-t border-white/[0.06] bg-[#07080d]/95">
        <div className="flex items-end gap-2 dark-input rounded-xl p-2.5 transition-all">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Boty anything (Enter to send, Shift+Enter for newline)..."
            rows={2}
            className="flex-1 bg-transparent resize-none text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none leading-relaxed"
          />
          {isGenerating ? (
            <button
              onClick={handleStop}
              className="p-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-md shadow-rose-600/30"
              title="Stop generating"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim() && !screenCapture}
              className={`p-2 rounded-lg transition-all ${
                input.trim() || screenCapture 
                  ? 'accent-gradient-btn text-white cursor-pointer' 
                  : 'bg-white/[0.04] text-zinc-600 cursor-not-allowed border border-white/[0.02]'
              }`}
              title="Send prompt"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
