import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Image as ImageIcon,
  Video as VideoIcon,
  FileText,
  X,
  Volume2,
  Sparkles,
  Bot,
  User,
  Paperclip,
  AlertTriangle,
  Pause,
  Loader2,
} from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer.tsx';
import { DeviceActionBridge, ToolExecutionResult } from '../services/deviceActionBridge.ts';
import { toEnglishAlphabets } from '../utils/transliteration.ts';
import { FuturisticScrollTrack } from './FuturisticScrollTrack.tsx';
import { crossSessionMemory } from '../services/crossSessionMemory.ts';
import { triggerHaptic } from '../utils/haptics.ts';

export interface AttachedFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  data: string; // base64
  previewUrl?: string;
  type: 'image' | 'video' | 'document';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  files?: AttachedFile[];
  timestamp: number;
  toolCalls?: any[];
}

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  deviceBridge: DeviceActionBridge;
  onToolExecuted?: (action: { name: string; args: any; result: ToolExecutionResult }) => void;
  hasMicError?: boolean;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  isOpen,
  onClose,
  deviceBridge,
  onToolExecuted,
  hasMicError,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: "Hey! Main hoon Iris. Chahe mic kaam na kare ya tujhe koi photo, video, code ya file bhejni ho—tu yahan direct upload kar sakta hai. Main sab read, edit aur analyze karke dungi!",
      timestamp: Date.now(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatusText, setLoadingStatusText] = useState('Iris is thinking...');
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, attachments]);

  if (!isOpen) return null;

  const processFile = (file: File): Promise<AttachedFile> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      const mimeType = file.type || 'application/octet-stream';
      let type: 'image' | 'video' | 'document' = 'document';

      if (mimeType.startsWith('image/')) {
        type = 'image';
      } else if (mimeType.startsWith('video/')) {
        type = 'video';
      }

      reader.onload = () => {
        const result = reader.result as string;
        const base64Data = result.includes(';base64,') ? result.split(';base64,')[1] : result;
        const previewUrl = type === 'image' || type === 'video' ? URL.createObjectURL(file) : undefined;

        resolve({
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name: file.name,
          mimeType,
          size: file.size,
          data: base64Data,
          previewUrl,
          type,
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const fileList = Array.from(e.target.files);
    try {
      const processed = await Promise.all(fileList.map((f) => processFile(f)));
      setAttachments((prev) => [...prev, ...processed]);
      triggerHaptic('light');
    } catch (err) {
      console.error('File reading error:', err);
    }
    e.target.value = '';
  };

  const handleRemoveAttachment = (id: string) => {
    triggerHaptic('light');
    setAttachments((prev) => {
      const removed = prev.find((a) => a.id === id);
      if (removed?.previewUrl) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return prev.filter((a) => a.id !== id);
    });
  };

  const handleSendMessage = async (textToSend?: string) => {
    triggerHaptic('medium');
    const text = (textToSend !== undefined ? textToSend : inputText).trim();
    if (!text && attachments.length === 0) return;

    const currentAttachments = [...attachments];
    const cleanUserText = toEnglishAlphabets(text);
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: cleanUserText,
      files: currentAttachments.length > 0 ? currentAttachments : undefined,
      timestamp: Date.now(),
    };

    crossSessionMemory.recordInteraction(
      'user',
      cleanUserText,
      currentAttachments.map((a) => ({ name: a.name, mimeType: a.mimeType }))
    );

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setAttachments([]);
    setIsLoading(true);

    if (currentAttachments.some((a) => a.type === 'video')) {
      setLoadingStatusText('Iris is watching and analyzing your video...');
    } else if (currentAttachments.some((a) => a.type === 'image')) {
      setLoadingStatusText('Iris is inspecting your photo...');
    } else if (currentAttachments.some((a) => a.type === 'document')) {
      setLoadingStatusText('Iris is reading and reviewing your file...');
    } else {
      setLoadingStatusText('Iris is thinking...');
    }

    try {
      const history = messages
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({
          role: m.role,
          text: m.text,
        }));

      const locInfo = deviceBridge.getLocationInfo();
      const payload = {
        message: text,
        files: currentAttachments.map((a) => ({
          name: a.name,
          mimeType: a.mimeType,
          data: a.data,
        })),
        history,
        location: locInfo.city,
        timezone: locInfo.timezone,
        time: locInfo.formattedTime,
        date: locInfo.formattedDate,
      };

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server responded with ${res.status}`);
      }

      const data = await res.json();
      const functionCalls = data.functionCalls || [];
      let replyText = data.reply?.trim();

      if (!replyText) {
        if (functionCalls.some((c: any) => c.name === 'requestFileUpload')) {
          replyText = "Arey yaar, tune koi photo ya file attach hi nahi ki hai! Niche camera ya attachment icon par click karke photo/file add kar na, phir main dekh ke sab batati hoon!";
        } else if (currentAttachments.length === 0 && text.toLowerCase().match(/(photo|image|picture|video|file|code|screenshot|isme kya hai|ye dekh)/)) {
          replyText = "Arey sun, tune abhi tak koi photo ya file attach nahi ki hai! Niche camera ya attachment icon par click karke pehle photo/file add kar na, phir main dekh ke batati hoon!";
        } else {
          replyText = "Haan bol na yaar! Main sun rahi hoon.";
        }
      }

      if (functionCalls.length > 0) {
        for (const call of functionCalls) {
          try {
            if (call.name === 'requestFileUpload') {
              if (call.args?.fileType === 'image') {
                imageInputRef.current?.click();
              } else if (call.args?.fileType === 'video') {
                videoInputRef.current?.click();
              } else {
                fileInputRef.current?.click();
              }
            }

            const toolResult = await deviceBridge.executeTool(call.name, call.args || {});
            if (onToolExecuted) {
              onToolExecuted({
                name: call.name,
                args: call.args,
                result: toolResult,
              });
            }
          } catch (tErr) {
            console.error('Tool execution error:', tErr);
          }
        }
      }

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: replyText,
        timestamp: Date.now(),
        toolCalls: functionCalls,
      };

      crossSessionMemory.recordInteraction('iris', replyText);
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error('Chat error:', err);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: `Arey yaar, error aa gaya: ${err.message || 'Network issue'}. Ek baar phir se try kar na.`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSpeakMessage = async (msgId: string, text: string) => {
    triggerHaptic('light');
    if (playingAudioId === msgId) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setPlayingAudioId(null);
      return;
    }

    try {
      setPlayingAudioId(msgId);
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) throw new Error('TTS failed');
      const data = await res.json();

      if (data.audio) {
        const byteCharacters = atob(data.audio);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const wavBlob = createWavBlob(byteArray, 24000);
        const audioUrl = URL.createObjectURL(wavBlob);

        if (audioRef.current) {
          audioRef.current.pause();
        }

        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        audio.onended = () => {
          setPlayingAudioId(null);
          URL.revokeObjectURL(audioUrl);
        };
        audio.onerror = () => {
          setPlayingAudioId(null);
        };
        await audio.play();
      }
    } catch (err) {
      console.error('TTS playback error:', err);
      if ('speechSynthesis' in window) {
        const clean = text.replace(/```[\s\S]*?```/g, '').slice(0, 200);
        const utter = new SpeechSynthesisUtterance(clean);
        utter.onend = () => setPlayingAudioId(null);
        utter.onerror = () => setPlayingAudioId(null);
        window.speechSynthesis.speak(utter);
      } else {
        setPlayingAudioId(null);
      }
    }
  };

  const createWavBlob = (pcmData: Uint8Array, sampleRate: number): Blob => {
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const wavHeader = new ArrayBuffer(44);
    const view = new DataView(wavHeader);

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + pcmData.length, true);
    writeString(view, 8, 'WAVE');

    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);

    writeString(view, 36, 'data');
    view.setUint32(40, pcmData.length, true);

    return new Blob([wavHeader, pcmData.buffer as ArrayBuffer], { type: 'audio/wav' });
  };

  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  const promptSuggestions = [
    { label: '📷 Analyze Photo', prompt: 'Tell me what is in this photo, analyze details and any text.', type: 'image' },
    { label: '🎥 Explain Video', prompt: 'Summarize what happens in this video clip step by step.', type: 'video' },
    { label: '💻 Edit / Fix Code', prompt: 'Inspect this code, find any bugs or improvements, and output the updated version.', type: 'document' },
    { label: '🤝 Who is Dev?', prompt: 'Dev kaun hai? Tumhara relation kya hai?' },
    { label: '💬 WhatsApp kholo', prompt: 'WhatsApp open karo.' },
  ];

  const handleSuggestionClick = (item: { label: string; prompt: string; type?: string }) => {
    triggerHaptic('light');
    if (item.type === 'image' && attachments.length === 0) {
      setInputText(item.prompt);
      imageInputRef.current?.click();
      return;
    }
    if (item.type === 'video' && attachments.length === 0) {
      setInputText(item.prompt);
      videoInputRef.current?.click();
      return;
    }
    if (item.type === 'document' && attachments.length === 0) {
      setInputText(item.prompt);
      fileInputRef.current?.click();
      return;
    }
    handleSendMessage(item.prompt);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/10 backdrop-blur-xs animate-in fade-in duration-200">
      {/* White Theme Glossy Container: 35% glass transparency so live background is visible through the panel */}
      <div className="w-full max-w-3xl h-[92vh] sm:h-[88vh] bg-white/35 border border-white/70 rounded-2xl shadow-2xl shadow-blue-500/10 backdrop-blur-xl ring-1 ring-white/60 flex flex-col overflow-hidden animate-drawer-in relative backdrop-saturate-150">
        {/* Glossy Top Specular Highlight Overlay */}
        <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-white/60 to-transparent pointer-events-none z-10" />

        {/* White Theme Header */}
        <div className="px-4 py-3.5 border-b border-white/50 bg-white/40 backdrop-blur-md flex items-center justify-between shrink-0 relative z-20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20 animate-pulse-glow">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-slate-900">Iris Chat & Multimodal Lab</h3>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-blue-100/90 text-blue-800 border border-blue-200/80 shadow-2xs">
                  Files • Photos • Videos
                </span>
              </div>
              <p className="text-[11px] text-slate-700 font-medium">
                Send files, code, pictures, or video clips to read, edit & analyze
              </p>
            </div>
          </div>
          <button
            onClick={() => { triggerHaptic('light'); onClose(); }}
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-white/60 transition-colors spring-button"
            title="Close Chat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Microphone Warning Fallback Banner */}
        {hasMicError && (
          <div className="px-4 py-2 bg-amber-50/80 border-b border-amber-200/80 text-amber-900 text-xs flex items-center gap-2 shrink-0 animate-fadeIn backdrop-blur-sm z-20">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 animate-bounce" />
            <span className="font-medium">
              Microphone issue detected in browser? You can seamlessly chat, send voice requests in text, and analyze files with Iris right here!
            </span>
          </div>
        )}

        {/* Messages Scroll Area */}
        <FuturisticScrollTrack
          className="flex-1 p-4 bg-transparent relative z-20"
          autoScrollOnUpdate={messages.length + (isLoading ? 1 : 0)}
        >
          <div className="space-y-4 pr-2">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-3 animate-bubble-pop ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-lg bg-blue-100 border border-blue-200 flex items-center justify-center shrink-0 mt-1 shadow-xs">
                    <Bot className="w-4 h-4 text-blue-600" />
                  </div>
                )}

                <div
                  className={`chat-bubble-interactive max-w-[85%] sm:max-w-[78%] rounded-2xl p-3.5 shadow-sm backdrop-blur-md transition-all ${
                    m.role === 'user'
                      ? 'bg-gradient-to-r from-blue-600/90 to-indigo-600/90 text-white rounded-tr-none shadow-blue-500/20'
                      : 'bg-white/70 hover:bg-white/80 text-slate-900 border border-white/80 rounded-tl-none hover:border-blue-300 shadow-xs'
                  }`}
                >
                  {/* Render Attachments if any */}
                  {m.files && m.files.length > 0 && (
                    <div className="mb-2.5 space-y-2">
                      {m.files.map((file) => (
                        <div
                          key={file.id}
                          className="rounded-xl overflow-hidden bg-white/90 border border-slate-200 p-2 text-xs transition-transform hover:scale-[1.01]"
                        >
                          {file.type === 'image' && file.previewUrl && (
                            <div className="mb-1.5 rounded-lg overflow-hidden max-h-48 flex justify-center bg-slate-100">
                              <img
                                src={file.previewUrl}
                                alt={file.name}
                                className="object-contain max-h-48 w-auto rounded-lg"
                              />
                            </div>
                          )}
                          {file.type === 'video' && file.previewUrl && (
                            <div className="mb-1.5 rounded-lg overflow-hidden max-h-48 bg-slate-100">
                              <video
                                src={file.previewUrl}
                                controls
                                className="w-full max-h-48 rounded-lg"
                              />
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-slate-800">
                            {file.type === 'image' && <ImageIcon className="w-3.5 h-3.5 text-blue-600" />}
                            {file.type === 'video' && <VideoIcon className="w-3.5 h-3.5 text-emerald-600" />}
                            {file.type === 'document' && <FileText className="w-3.5 h-3.5 text-indigo-600" />}
                            <span className="font-semibold truncate">{file.name}</span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              ({(file.size / 1024).toFixed(1)} KB)
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Message Text with Markdown Rendering */}
                  {m.role === 'assistant' ? (
                    <MarkdownRenderer content={m.text} />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.text}</p>
                  )}

                  {/* Assistant Message Actions (TTS Speak) */}
                  {m.role === 'assistant' && (
                    <div className="mt-2.5 pt-2 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-500">
                      <span className="text-[10px] text-blue-600 font-mono font-bold">Iris • Gemini 3.8 Flash</span>
                      <button
                        onClick={() => handleSpeakMessage(m.id, m.text)}
                        className="flex items-center gap-1 text-blue-700 hover:text-blue-900 transition-all spring-button px-2 py-0.5 rounded-lg bg-blue-50 border border-blue-200 font-bold"
                        title="Speak response aloud"
                      >
                        {playingAudioId === m.id ? (
                          <>
                            <Pause className="w-3 h-3 text-blue-600" />
                            <span>Stop</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3 h-3 text-blue-600" />
                            <span>Listen</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {m.role === 'user' && (
                  <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0 mt-1 shadow-md shadow-blue-500/20">
                    <User className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
            ))}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex gap-3 justify-start items-center animate-bubble-pop">
                <div className="w-7 h-7 rounded-lg bg-blue-100 border border-blue-200 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-blue-600" />
                </div>
                <div className="px-4 py-2.5 rounded-2xl rounded-tl-none bg-white/90 border border-blue-200 text-xs text-slate-800 flex items-center gap-2.5 shadow-md">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <span className="font-medium">{loadingStatusText}</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </FuturisticScrollTrack>

        {/* Quick Suggestion Chips */}
        <div className="px-4 py-2 bg-white/40 border-t border-slate-200/50 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 relative z-20">
          <span className="text-[10px] uppercase font-bold text-slate-500 shrink-0 font-mono">Quick:</span>
          {promptSuggestions.map((item, idx) => (
            <button
              key={idx}
              onClick={() => handleSuggestionClick(item)}
              className="text-xs px-2.5 py-1 rounded-full bg-white/80 hover:bg-blue-50 text-blue-700 hover:text-blue-900 border border-slate-200 font-semibold whitespace-nowrap transition-all spring-button shrink-0 shadow-2xs"
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Pending Attachment Previews */}
        {attachments.length > 0 && (
          <div className="px-4 py-2.5 bg-white/60 border-t border-slate-200/60 flex gap-2 overflow-x-auto shrink-0 animate-bubble-pop relative z-20">
            {attachments.map((file) => (
              <div
                key={file.id}
                className="relative group p-2 rounded-xl bg-white border border-blue-200 text-xs flex items-center gap-2 max-w-[200px] shrink-0 transition-transform hover:scale-105 shadow-xs"
              >
                {file.type === 'image' && file.previewUrl ? (
                  <img
                    src={file.previewUrl}
                    alt={file.name}
                    className="w-10 h-10 object-cover rounded-lg border border-slate-200"
                  />
                ) : file.type === 'video' ? (
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center border border-emerald-200">
                    <VideoIcon className="w-5 h-5 text-emerald-600" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-200">
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>
                )}
                <div className="truncate flex-1">
                  <div className="text-slate-900 text-xs font-bold truncate">{file.name}</div>
                  <div className="text-[10px] text-slate-500 font-mono">{(file.size / 1024).toFixed(1)} KB</div>
                </div>
                <button
                  onClick={() => handleRemoveAttachment(file.id)}
                  className="p-1 rounded-full bg-slate-100 hover:bg-rose-500 hover:text-white text-slate-600 transition-colors"
                  title="Remove file"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* White Theme Input Bar */}
        <div className="p-3 bg-white/70 border-t border-slate-200/60 shrink-0 relative z-20">
          <input
            type="file"
            ref={imageInputRef}
            onChange={handleFileUpload}
            accept="image/*"
            multiple
            className="hidden"
          />
          <input
            type="file"
            ref={videoInputRef}
            onChange={handleFileUpload}
            accept="video/*"
            multiple
            className="hidden"
          />
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".txt,.py,.js,.ts,.tsx,.jsx,.json,.csv,.pdf,.md,.html,.css,.sql,.java,.c,.cpp"
            multiple
            className="hidden"
          />

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-slate-500">
              <button
                type="button"
                onClick={() => { triggerHaptic('light'); imageInputRef.current?.click(); }}
                className="p-2 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-all spring-button"
                title="Attach Photo / Image"
              >
                <ImageIcon className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => { triggerHaptic('light'); videoInputRef.current?.click(); }}
                className="p-2 rounded-xl hover:bg-emerald-50 hover:text-emerald-600 transition-all spring-button"
                title="Attach Video Clip"
              >
                <VideoIcon className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => { triggerHaptic('light'); fileInputRef.current?.click(); }}
                className="p-2 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-all spring-button"
                title="Attach Code / File / Document"
              >
                <Paperclip className="w-4 h-4" />
              </button>
            </div>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Ask Iris anything, or ask her to read, edit, or analyze your attachments..."
              className="flex-1 px-4 py-2.5 rounded-xl bg-white/90 border border-slate-200 text-slate-900 placeholder-slate-400 text-xs sm:text-sm font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-xs"
              disabled={isLoading}
            />

            <button
              onClick={() => handleSendMessage()}
              disabled={isLoading || (!inputText.trim() && attachments.length === 0)}
              className="p-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold transition-all shadow-md shadow-blue-500/20 spring-button shrink-0"
              title="Send Message"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
