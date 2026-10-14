import React, { useState } from 'react';
import { 
  Crop, 
  Trash2, 
  Send
} from 'lucide-react';
import { useAssistantStore } from '../store/useAssistantStore';

export const ScreenCaptureView: React.FC = () => {
  const { 
    screenCapture, 
    setScreenCapture, 
    addMessage, 
    setMode,
    settings 
  } = useAssistantStore();

  const [question, setQuestion] = useState('Explain what is on screen and highlight any key actions.');
  const [isCapturing, setIsCapturing] = useState(false);

  const handleCaptureScreen = async () => {
    setIsCapturing(true);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'monitor' }
      });
      const track = stream.getVideoTracks()[0];
      const imageCapture = new (window as any).ImageCapture(track);
      const bitmap = await imageCapture.grabFrame();
      
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        setScreenCapture({
          x: 0,
          y: 0,
          width: bitmap.width,
          height: bitmap.height,
          previewDataUrl: dataUrl
        });
      }
      track.stop();
    } catch {
      // User canceled screen selection
    } finally {
      setIsCapturing(false);
    }
  };

  const handleSendToAI = () => {
    if (!screenCapture?.previewDataUrl) return;

    addMessage({
      role: 'user',
      content: question,
      imageUrl: screenCapture.previewDataUrl
    });

    if (!settings.saveScreenshots) {
      setScreenCapture(null);
    }

    setMode('chat');
  };

  return (
    <div className="flex flex-col h-full p-4 text-zinc-200 bg-[#08090e]/70">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
        <div>
          <h2 className="text-xs font-semibold text-zinc-100 flex items-center gap-1.5">
            <Crop className="w-3.5 h-3.5 text-violet-400" />
            <span>Screen Vision</span>
          </h2>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            Analyze any window, code, or error on your screen.
          </p>
        </div>
        {screenCapture && (
          <button
            onClick={() => setScreenCapture(null)}
            className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-rose-400"
          >
            <Trash2 className="w-3 h-3" />
            <span>Discard</span>
          </button>
        )}
      </div>

      {/* Screen Area */}
      <div className="flex-1 flex flex-col items-center justify-center my-3 dark-card rounded-2xl p-3 overflow-hidden">
        {screenCapture?.previewDataUrl ? (
          <div className="relative w-full h-full flex flex-col items-center justify-center">
            <img 
              src={screenCapture.previewDataUrl} 
              alt="Screen Preview" 
              className="max-h-[200px] w-auto object-contain rounded-xl border border-white/10"
            />
            <span className="mt-2 text-[10px] text-zinc-400 font-mono">
              Captured ({screenCapture.width} × {screenCapture.height}px)
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-2.5">
              <Crop className="w-6 h-6 text-violet-400" />
            </div>
            <p className="text-xs font-medium text-zinc-200 mb-0.5">
              No screen captured yet
            </p>
            <p className="text-[11px] text-zinc-500 mb-4">
              Select any window or screen region to analyze
            </p>
            <button
              onClick={handleCaptureScreen}
              disabled={isCapturing}
              className="py-1.5 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer shadow-[0_0_12px_rgba(139,92,246,0.3)]"
            >
              <Crop className="w-3.5 h-3.5" />
              <span>{isCapturing ? 'Selecting Window...' : 'Capture Screen (Alt+S)'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Question Prompt Input */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask what you'd like Boty to explain..."
          className="flex-1 dark-input rounded-xl px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none"
        />
        <button
          onClick={handleSendToAI}
          disabled={!screenCapture?.previewDataUrl}
          className={`py-1.5 px-3 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all ${
            screenCapture?.previewDataUrl
              ? 'bg-violet-600 hover:bg-violet-500 text-white cursor-pointer shadow-[0_0_10px_rgba(139,92,246,0.3)]'
              : 'bg-white/[0.04] text-zinc-600 cursor-not-allowed'
          }`}
        >
          <Send className="w-3.5 h-3.5" />
          <span>Ask</span>
        </button>
      </div>
    </div>
  );
};
