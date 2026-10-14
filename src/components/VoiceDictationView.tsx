import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  MicOff, 
  Check, 
  ArrowRightCircle, 
  Sparkles,
  RotateCcw
} from 'lucide-react';
import { useAssistantStore } from '../store/useAssistantStore';

interface IWindow extends Window {
  webkitSpeechRecognition?: any;
  SpeechRecognition?: any;
}

export const VoiceDictationView: React.FC = () => {
  const { 
    isRecording, 
    dictatedText, 
    audioLevel, 
    setRecording, 
    setDictatedText, 
    setAudioLevel,
    addMessage,
    setMode
  } = useAssistantStore();

  const [inserted, setInserted] = useState(false);
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const win = window as unknown as IWindow;
    const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (SpeechRecognitionClass) {
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        setDictatedText(transcript);
      };

      recognition.onerror = () => {
        setRecording(false);
      };

      recognition.onend = () => {
        setRecording(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      stopAudioVisualizer();
    };
  }, []);

  const startAudioVisualizer = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        const sum = dataArray.reduce((acc, val) => acc + val, 0);
        const avg = sum / dataArray.length;
        setAudioLevel(Math.min(100, Math.round((avg / 255) * 100)));
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();
    } catch {
      // Audio level visualizer fallback
    }
  };

  const stopAudioVisualizer = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setAudioLevel(0);
  };

  const toggleRecording = () => {
    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      stopAudioVisualizer();
      setRecording(false);
    } else {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch {
          // Ignore
        }
      }
      startAudioVisualizer();
      setRecording(true);
    }
  };

  const handleInsertText = () => {
    navigator.clipboard.writeText(dictatedText);
    setInserted(true);
    setTimeout(() => setInserted(false), 2000);
  };

  const handleSendToChat = () => {
    if (!dictatedText.trim()) return;
    addMessage({
      role: 'user',
      content: dictatedText
    });
    setDictatedText('');
    setMode('chat');
  };

  return (
    <div className="flex flex-col h-full p-4 text-zinc-200 bg-[#08090e]/70">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
        <div>
          <h2 className="text-xs font-semibold text-zinc-100 flex items-center gap-1.5">
            <Mic className="w-3.5 h-3.5 text-violet-400" />
            <span>Voice Dictation</span>
          </h2>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            Speak to transcribe text instantly.
          </p>
        </div>
        {dictatedText && (
          <button
            onClick={() => setDictatedText('')}
            className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* Mic Trigger */}
      <div className="flex flex-col items-center justify-center py-4">
        <button
          onClick={toggleRecording}
          className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer shadow-lg ${
            isRecording 
              ? 'bg-rose-500 text-white shadow-rose-500/40 ring-4 ring-rose-500/20 animate-pulse' 
              : 'bg-violet-600 hover:bg-violet-500 text-white shadow-[0_0_16px_rgba(139,92,246,0.35)]'
          }`}
          title={isRecording ? 'Stop listening' : 'Start dictation'}
        >
          {isRecording ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>

        <span className={`text-[11px] font-medium mt-2.5 ${isRecording ? 'text-rose-400' : 'text-zinc-400'}`}>
          {isRecording ? `Listening... ${audioLevel > 5 ? '•' : ''}` : 'Click to speak or press Alt+D'}
        </span>
      </div>

      {/* Transcript Box */}
      <div className="flex-1 dark-card rounded-2xl p-3 flex flex-col mb-3">
        <textarea
          value={dictatedText}
          onChange={(e) => setDictatedText(e.target.value)}
          placeholder="Transcription appears here in real time as you speak..."
          className="flex-1 w-full bg-transparent resize-none text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none leading-relaxed"
        />
      </div>

      {/* Bottom Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleInsertText}
          disabled={!dictatedText.trim()}
          className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
            dictatedText.trim()
              ? 'bg-violet-600 hover:bg-violet-500 text-white cursor-pointer shadow-[0_0_10px_rgba(139,92,246,0.3)]'
              : 'bg-white/[0.04] text-zinc-600 cursor-not-allowed'
          }`}
        >
          {inserted ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <ArrowRightCircle className="w-3.5 h-3.5" />}
          <span>{inserted ? 'Copied to Clipboard' : 'Copy / Insert'}</span>
        </button>

        <button
          onClick={handleSendToChat}
          disabled={!dictatedText.trim()}
          className="py-1.5 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-all disabled:opacity-40"
        >
          <Sparkles className="w-3.5 h-3.5 text-violet-400" />
          <span>Ask AI</span>
        </button>
      </div>
    </div>
  );
};
