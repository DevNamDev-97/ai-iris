import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Send,
  Paperclip,
  Camera,
  Image as ImageIcon,
  Video as VideoIcon,
  FileCode,
  Sparkles,
  Bot,
  User,
  Trash2,
  Volume2,
  Loader2,
  AlertCircle,
  FileText,
  CornerDownLeft,
  ChevronRight,
} from 'lucide-react';
import { DeviceActionBridge, ToolExecutionResult } from '../services/deviceActionBridge.ts';
import { MarkdownRenderer } from './MarkdownRenderer.tsx';
import { FuturisticScrollTrack } from './FuturisticScrollTrack.tsx';
import { locationService } from '../services/locationService.ts';
import { crossSessionMemory } from '../services/crossSessionMemory.ts';
import { toEnglishAlphabets } from '../utils/transliteration.ts';

export interface AttachedFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  data: string; // base64 string
  previewUrl?: string;
  type: 'image' | 'video' | 'document';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'iris';
  text: string;
  files?: AttachedFile[];
  timestamp: number;
  isStreaming?: boolean;
}

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  deviceBridge: DeviceActionBridge;
  onToolExecuted?: (info: { name: string; args: any; result: ToolExecutionResult }) => void;
  hasMicError?: boolean;
  theme?: 'light' | 'dark';
  isDeveloperAuthenticated?: boolean;
  hasDeveloperAuthenticationFailed?: boolean;
  onTriggerDevChallenge?: () => void;
  onTriggerRebootChallenge?: () => void;
}

const QUICK_PROMPTS = [
  'What meetings do I have today?',
  'Search for PDF 1 in memory',
  'Set a reminder to drink water in 30 minutes',
  'Where am I and show live map',
  'Open AI Image Modification Lab',
  'Write a Python script to parse JSON',
];

const WELCOME_MESSAGES = [
  (name: string) => `Haan bol na ${name}! Main sun rahi hoon. Aaj teri kya help karu? Kuch files analyze karwani hain ya code check karna hai?`,
  (name: string) => `Oye ${name} yaar! Bol na, kya chal raha hai? Koi photo inspect karwani hai ya screen share start karein?`,
  (name: string) => `Arey ${name}! Aaja, bta kya help chahiye aaj teri personal assistant Iris ko? Mujhse kuch bhi pooch le!`,
  (name: string) => `Haan ${name} yaar! Bilkul sun rahi hoon. Bata aaj kya interesting cheez discuss karni hai hume?`,
  (name: string) => `Hey ${name}! Mast dosti wali vibes ke sath hazir hoon! Chal bata, aaj tera kya plan hai aur main kaise help karu?`,
];

const getRandomWelcomeMessage = (isDeveloper: boolean) => {
  const userName = isDeveloper ? 'Dev' : 'yaar';
  const randomIndex = Math.floor(Math.random() * WELCOME_MESSAGES.length);
  return WELCOME_MESSAGES[randomIndex](userName);
};

const ChatPanelComponent: React.FC<ChatPanelProps> = ({
  isOpen,
  onClose,
  deviceBridge,
  onToolExecuted,
  hasMicError,
  theme = 'light',
  isDeveloperAuthenticated = false,
  hasDeveloperAuthenticationFailed = false,
  onTriggerDevChallenge,
  onTriggerRebootChallenge,
}) => {
  const isDark = theme === 'dark';
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome-1',
      role: 'iris',
      text: getRandomWelcomeMessage(isDeveloperAuthenticated),
      timestamp: Date.now(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlayingAudioId, setIsPlayingAudioId] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (textareaRef.current) {
        setTimeout(() => textareaRef.current?.focus(), 150);
      }
      // Regenerate dynamic greeting with active speaker name on refresh
      setMessages((prev) => {
        if (prev.length <= 1) {
          return [
            {
              id: `welcome_${Date.now()}`,
              role: 'iris',
              text: getRandomWelcomeMessage(isDeveloperAuthenticated),
              timestamp: Date.now(),
            }
          ];
        }
        return prev;
      });
    }
  }, [isOpen, isDeveloperAuthenticated]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const fileList = Array.from(e.target.files);

    fileList.forEach((file) => {
      const reader = new FileReader();
      const mimeType = file.type || 'application/octet-stream';
      let type: 'image' | 'video' | 'document' = 'document';

      if (mimeType.startsWith('image/')) type = 'image';
      else if (mimeType.startsWith('video/')) type = 'video';

      reader.onload = () => {
        const result = reader.result as string;
        const base64Data = result.includes(';base64,') ? result.split(';base64,')[1] : result;
        const previewUrl = type === 'image' || type === 'video' ? URL.createObjectURL(file) : undefined;

        setAttachedFiles((prev) => [
          ...prev,
          {
            id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            name: file.name,
            mimeType,
            size: file.size,
            data: base64Data,
            previewUrl,
            type,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend !== undefined ? textToSend : inputText).trim();
    if (!text && attachedFiles.length === 0) return;

    if (text.toLowerCase() === 'open ai image modification lab') {
      deviceBridge.modifyImage('Open Lab', 'general');
      setInputText('');
      return;
    }

    // Intercept if they say they are Dev and are not yet authenticated
    const hasDevKeyword = text.toLowerCase().match(/\b(dev|developer)\b/i);
    if (hasDevKeyword && !isDeveloperAuthenticated) {
      if (onTriggerDevChallenge) {
        onTriggerDevChallenge();
        setInputText('');
        return;
      }
    }

    // Intercept if they request a reboot
    const lowerText = text.toLowerCase();
    const isRebootRequested = 
      lowerText.includes("iris! reboot") || 
      lowerText.includes("iris reboot") || 
      lowerText.includes("system reboot") ||
      lowerText.includes("reboot system") ||
      (lowerText.includes("reboot") && lowerText.includes("iris"));

    if (isRebootRequested) {
      if (onTriggerRebootChallenge) {
        onTriggerRebootChallenge();
        setInputText('');
        return;
      }
    }

    const currentFiles = [...attachedFiles];
    const userMsgId = `user_${Date.now()}`;
    const newUserMessage: ChatMessage = {
      id: userMsgId,
      role: 'user',
      text,
      files: currentFiles.length > 0 ? currentFiles : undefined,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, newUserMessage]);
    setInputText('');
    setAttachedFiles([]);
    setIsLoading(true);
    setAudioError(null);

    // Save to cross-session memory
    crossSessionMemory.recordInteraction(
      'user',
      text,
      currentFiles.map((f) => ({ name: f.name, mimeType: f.mimeType }))
    );

    try {
      const locInfo = locationService.getLocation();
      const historyPayload = messages.slice(-10).map((m) => ({
        role: m.role,
        text: m.text,
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          files: currentFiles.map((f) => ({
            name: f.name,
            mimeType: f.mimeType,
            data: f.data,
            type: f.type,
          })),
          history: historyPayload,
          location: locInfo.city || 'Detected Location',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          time: new Date().toLocaleTimeString(),
          date: new Date().toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' }),
          voice: localStorage.getItem('iris_preferred_voice') || 'Leda',
          isDeveloperAuthenticated,
          hasDeveloperAuthenticationFailed,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with status ${res.status}`);
      }

      const data = await res.json();
      const replyText = toEnglishAlphabets(data.reply || 'Main samajh gayi!');

      const irisMsgId = `iris_${Date.now()}`;
      const newIrisMessage: ChatMessage = {
        id: irisMsgId,
        role: 'iris',
        text: replyText,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, newIrisMessage]);
      crossSessionMemory.recordInteraction('iris', replyText);

      // Handle function calls returned by Iris
      if (Array.isArray(data.functionCalls) && data.functionCalls.length > 0) {
        for (const call of data.functionCalls) {
          try {
            console.log(`🛠️ [ChatPanel] Executing tool ${call.name} with args:`, call.args);
            const toolResult = await deviceBridge.executeTool(call.name, call.args || {});
            if (onToolExecuted) {
              onToolExecuted({
                name: call.name,
                args: call.args || {},
                result: toolResult,
              });
            }
          } catch (toolErr) {
            console.warn(`Tool execution error for ${call.name}:`, toolErr);
          }
        }
      }
    } catch (err: any) {
      console.error('Chat error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: 'iris',
          text: `⚠️ Error: ${err?.message || 'Could not connect to Iris server.'}`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayTTS = async (messageId: string, text: string) => {
    if (isPlayingAudioId === messageId) {
      setIsPlayingAudioId(null);
      return;
    }

    try {
      setIsPlayingAudioId(messageId);
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voice: localStorage.getItem('iris_preferred_voice') || 'Leda',
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to generate speech audio');
      }

      const data = await res.json();
      if (data.audio) {
        const audio = new Audio(`data:audio/mp3;base64,${data.audio}`);
        audio.onended = () => setIsPlayingAudioId(null);
        audio.onerror = () => setIsPlayingAudioId(null);
        await audio.play();
      } else {
        setIsPlayingAudioId(null);
      }
    } catch (e: any) {
      console.warn('TTS playback error:', e);
      setAudioError('Could not play audio for this message');
      setIsPlayingAudioId(null);
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={`fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-[3px] animate-motion-blur-in cursor-pointer transition-colors duration-200 ${
        isDark ? 'bg-black/40' : 'bg-slate-900/20'
      }`}
    >
      {/* 40% Transparent Glass Window (Adapts to Light / Dark Theme) */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-3xl h-[92vh] sm:h-[88vh] rounded-2xl sm:rounded-3xl flex flex-col overflow-hidden relative backdrop-blur-2xl backdrop-saturate-150 cursor-default transition-all duration-200 ${
          isDark
            ? 'bg-slate-950/50 border border-cyan-500/40 shadow-[0_20px_60px_rgba(6,182,212,0.25)] ring-1 ring-cyan-500/30 text-white'
            : 'bg-white/40 border border-white/80 shadow-[0_20px_60px_rgba(14,165,233,0.22)] ring-1 ring-white/70 text-slate-900'
        }`}
      >
        {/* Floating Center-Top Close Button */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30">
          <button
            onClick={onClose}
            title="Close Chat Panel"
            className={`px-4 py-1.5 rounded-full border transition-all spring-button flex items-center gap-1.5 font-bold text-xs shadow-lg cursor-pointer ${
              isDark
                ? 'text-cyan-400 border-cyan-500/45 hover:text-white hover:bg-slate-800 bg-slate-900/90 shadow-cyan-500/15'
                : 'text-blue-600 border-blue-200 hover:text-blue-800 hover:bg-slate-100 bg-white shadow-blue-500/10'
            }`}
          >
            <span>Close Chat</span>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Glossy Top Specular Highlight */}
        <div className={`absolute top-0 inset-x-0 h-16 pointer-events-none z-10 ${
          isDark ? 'bg-gradient-to-b from-cyan-500/15 to-transparent' : 'bg-gradient-to-b from-white/70 to-transparent'
        }`} />

        {/* Ambient Glow Highlight */}
        <div className={`absolute top-0 right-1/4 w-96 h-32 rounded-full blur-3xl pointer-events-none ${
          isDark ? 'bg-cyan-500/20' : 'bg-cyan-400/20'
        }`} />

        {/* Header Bar with increased top padding to accommodate the centered Close pill */}
        <div className={`px-4 pt-11 pb-3.5 backdrop-blur-md flex items-center justify-between z-20 shrink-0 border-b ${
          isDark ? 'bg-slate-950/70 border-cyan-500/25' : 'bg-white/50 border-slate-200/60'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center shadow-md shadow-blue-500/25 text-white">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className={`font-bold text-sm sm:text-base tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  I.R.I.S. Multimodal Chat & File Lab
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                  isDark
                    ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-300'
                    : 'bg-blue-100/90 border-blue-300/60 text-blue-800'
                }`}>
                  AI v3.5
                </span>
              </div>
              <p className={`text-[11px] font-mono truncate font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Analyze files, code, images, videos & execute live device actions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setMessages([])}
              title="Clear chat history"
              className={`p-2 rounded-xl transition-colors spring-button ${
                isDark ? 'text-slate-400 hover:text-rose-400 hover:bg-slate-800/80' : 'text-slate-500 hover:text-rose-600 hover:bg-rose-50/80'
              }`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mic Standby Banner if applicable */}
        {hasMicError && (
          <div className={`px-4 py-2 border-b flex items-center gap-2 text-xs shrink-0 font-medium z-10 backdrop-blur-md ${
            isDark ? 'bg-amber-500/15 border-amber-500/30 text-amber-300' : 'bg-amber-50/90 border-amber-200/80 text-amber-900'
          }`}>
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
            <span>Voice mic is in standby. You can type, attach files, and chat with Iris seamlessly here!</span>
          </div>
        )}

        {/* Message Stream */}
        <div className="flex-1 overflow-hidden p-3 sm:p-4 relative z-10">
          <FuturisticScrollTrack className="h-full pr-1.5" autoScrollOnUpdate={messages}>
            <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} space-y-1.5 animate-item-blur`}
                >
                  {/* Sender Badge */}
                  <div className={`flex items-center gap-1.5 text-[10px] font-mono px-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {msg.role === 'user' ? (
                      <span className={`${isDark ? 'text-cyan-400' : 'text-blue-700'} font-bold flex items-center gap-1`}>
                        YOU <User className="w-3 h-3" />
                      </span>
                    ) : (
                      <span className={`${isDark ? 'text-blue-400' : 'text-indigo-700'} font-bold flex items-center gap-1`}>
                        <Bot className="w-3 h-3" /> I.R.I.S.
                      </span>
                    )}
                    <span>•</span>
                    <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={`max-w-[92%] sm:max-w-[85%] rounded-2xl px-4 py-3 text-xs sm:text-sm font-medium shadow-md transition-all ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-tr-xs shadow-blue-500/20'
                        : isDark
                        ? 'bg-slate-900/85 hover:bg-slate-900/95 border border-slate-700 text-slate-100 rounded-tl-xs shadow-slate-950/30 backdrop-blur-md'
                        : 'bg-white/80 hover:bg-white/90 border border-white/90 text-slate-900 rounded-tl-xs shadow-slate-900/5 backdrop-blur-md'
                    }`}
                  >
                    {/* Attached Files rendering */}
                    {msg.files && msg.files.length > 0 && (
                      <div className="mb-3 space-y-2">
                        {msg.files.map((file) => (
                          <div
                            key={file.id}
                            className={`p-2 rounded-xl flex items-center gap-2.5 text-xs shadow-2xs ${
                              isDark ? 'bg-slate-950/70 border border-white/10 text-slate-200' : 'bg-white/90 border border-slate-200/80 text-slate-800'
                            }`}
                          >
                            {file.type === 'image' && file.previewUrl ? (
                              <img
                                src={file.previewUrl}
                                alt={file.name}
                                className="w-12 h-12 object-cover rounded-lg border border-slate-200/30 shrink-0"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                                {file.type === 'video' ? <VideoIcon className="w-4 h-4" /> : <FileCode className="w-4 h-4" />}
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className={`font-semibold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{file.name}</div>
                              <div className="text-[10px] text-slate-400 uppercase font-mono">
                                {file.type} • {(file.size / 1024).toFixed(1)} KB
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Text Body */}
                    <div className={`break-words leading-relaxed ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                      <MarkdownRenderer content={msg.text} />
                    </div>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className={`flex items-start gap-2 text-xs font-mono animate-pulse ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <Bot className="w-4 h-4 animate-spin" />
                  </div>
                  <div className={`p-3 rounded-2xl flex items-center gap-2 shadow-sm backdrop-blur-md ${
                    isDark ? 'bg-slate-900/90 border border-slate-700 text-slate-200' : 'bg-white/85 border border-slate-200 text-slate-800'
                  }`}>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                    <span>Iris is analyzing and thinking...</span>
                  </div>
                </div>
              )}
            </div>
          </FuturisticScrollTrack>
        </div>

        {/* Quick Prompts Carousel */}
        <div className={`px-3 py-2 border-t backdrop-blur-md flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0 z-20 ${
          isDark ? 'bg-slate-950/60 border-cyan-500/20' : 'bg-white/50 border-slate-200/60'
        }`}>
          <span className={`text-[10px] font-mono font-bold uppercase shrink-0 ${isDark ? 'text-cyan-400' : 'text-blue-700'}`}>
            Suggested:
          </span>
          {QUICK_PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendMessage(prompt)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all shrink-0 active:scale-95 shadow-2xs spring-button ${
                isDark
                  ? 'bg-slate-900/80 hover:bg-cyan-950/60 hover:border-cyan-500/50 border border-slate-700 text-slate-300 hover:text-cyan-200'
                  : 'bg-white/80 hover:bg-blue-50/95 hover:border-blue-300 border border-slate-200 text-slate-700 hover:text-blue-700'
              }`}
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Attachment Tray */}
        {attachedFiles.length > 0 && (
          <div className={`px-4 py-2 border-t backdrop-blur-md flex items-center gap-2 overflow-x-auto shrink-0 z-20 ${
            isDark ? 'bg-slate-950/80 border-cyan-500/20' : 'bg-white/60 border-slate-200/60'
          }`}>
            {attachedFiles.map((file) => (
              <div
                key={file.id}
                className={`px-2.5 py-1.5 rounded-xl border flex items-center gap-2 text-xs shadow-xs shrink-0 animate-item-blur ${
                  isDark ? 'bg-slate-900 border-cyan-500/30 text-slate-200' : 'bg-white/90 border-blue-200 text-slate-800'
                }`}
              >
                {file.type === 'image' && <ImageIcon className="w-3.5 h-3.5 text-blue-500" />}
                {file.type === 'video' && <VideoIcon className="w-3.5 h-3.5 text-emerald-500" />}
                {file.type === 'document' && <FileCode className="w-3.5 h-3.5 text-indigo-500" />}
                <span className="max-w-[120px] truncate font-medium">{file.name}</span>
                <button
                  onClick={() => setAttachedFiles((prev) => prev.filter((f) => f.id !== file.id))}
                  className="text-slate-400 hover:text-rose-500 ml-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input Bar */}
        <div className={`p-3 sm:p-4 border-t backdrop-blur-xl shrink-0 z-20 ${
          isDark ? 'bg-slate-950/80 border-cyan-500/25' : 'bg-white/60 border-slate-200/70'
        }`}>
          {audioError && <p className="text-xs text-rose-500 mb-2 font-medium">{audioError}</p>}
          <div className={`flex items-end gap-2 border rounded-2xl p-2 shadow-xs transition-all ${
            isDark
              ? 'bg-slate-900/90 border-cyan-500/30 focus-within:border-cyan-400 focus-within:ring-2 focus-within:ring-cyan-500/20'
              : 'bg-white/90 border-slate-300/80 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20'
          }`}>
            {/* Hidden File Inputs */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              multiple
              accept="image/*,video/*,.txt,.py,.js,.ts,.tsx,.jsx,.json,.csv,.pdf,.md,.html,.css,.sql"
              className="hidden"
            />
            <input
              type="file"
              ref={cameraInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              capture="environment"
              className="hidden"
            />

            {/* Action Buttons */}
            <div className="flex items-center gap-1 pb-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Attach file, photo, video, or code"
                className={`p-2 rounded-xl transition-colors spring-button ${
                  isDark ? 'text-slate-400 hover:text-cyan-300 hover:bg-slate-800' : 'text-slate-500 hover:text-blue-600 hover:bg-blue-50/80'
                }`}
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                title="Snap photo with camera"
                className={`p-2 rounded-xl transition-colors spring-button ${
                  isDark ? 'text-slate-400 hover:text-cyan-300 hover:bg-slate-800' : 'text-slate-500 hover:text-blue-600 hover:bg-blue-50/80'
                }`}
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Ask Iris anything in Hinglish or English, or send files/photos..."
              rows={1}
              className={`flex-1 bg-transparent border-0 text-xs sm:text-sm resize-none focus:outline-none max-h-28 py-1.5 px-2 font-medium ${
                isDark ? 'text-white placeholder-slate-500' : 'text-slate-900 placeholder-slate-400'
              }`}
            />

            {/* Send Button */}
            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={isLoading || (!inputText.trim() && attachedFiles.length === 0)}
              className="p-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold disabled:opacity-30 disabled:cursor-not-allowed shadow-md shadow-blue-500/25 transition-all active:scale-95 shrink-0 spring-button"
              title="Send message (Enter)"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ChatPanel = React.memo(ChatPanelComponent);
