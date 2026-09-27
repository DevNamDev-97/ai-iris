import React from 'react';
import { Sparkles, User, Zap, FileText, Camera } from 'lucide-react';
import { AssistantState } from '../services/liveClient.ts';
import { MarkdownRenderer } from './MarkdownRenderer.tsx';
import { toEnglishAlphabets } from '../utils/transliteration.ts';
import { FuturisticScrollTrack } from './FuturisticScrollTrack.tsx';

export interface HistoryTurn {
  id: string;
  role: 'user' | 'iris';
  text?: string;
  file?: {
    name: string;
    type: 'image' | 'video' | 'document' | 'any';
    mimeType?: string;
    previewUrl?: string;
  };
  timestamp: number;
  isStreaming?: boolean;
  interrupted?: boolean;
}

interface ConversationHistoryPanelProps {
  turns: HistoryTurn[];
  state: AssistantState;
  onClearHistory?: () => void;
  onOpenPopup?: (data: { title: string; content: string; language: string; contentType: 'code' | 'prompt' }) => void;
  onOpenCamera?: () => void;
}

export const ConversationHistoryPanel: React.FC<ConversationHistoryPanelProps> = ({
  turns,
  state,
  onOpenPopup,
  onOpenCamera,
}) => {
  const isEmpty = turns.length === 0;

  return (
    <div className="w-full relative rounded-2xl bg-white/45 hover:bg-white/50 border border-white/70 backdrop-blur-2xl overflow-hidden shadow-[0_20px_50px_rgba(14,165,233,0.18)] hover:shadow-[0_25px_60px_rgba(14,165,233,0.25)] transition-all duration-300 ring-1 ring-white/60 backdrop-saturate-150">
      {/* Glossy Specular Top Highlight Overlay */}
      <div className="absolute top-0 inset-x-0 h-12 bg-gradient-to-b from-white/60 to-transparent pointer-events-none z-10" />

      {/* Top Translucent Header Bar */}
      <div className="px-3.5 py-2.5 bg-white/35 backdrop-blur-md border-b border-white/50 flex items-center justify-between text-[11px] font-mono tracking-wider text-slate-800 relative z-20">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
          <span className="font-bold tracking-widest text-slate-900 drop-shadow-xs">LIVE TELEMETRY & SPEECH LOG</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-blue-700 font-bold">
          <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 border border-blue-400/40 text-blue-900 font-extrabold backdrop-blur-sm shadow-2xs">
            {state !== 'IDLE' ? 'LIVE SESSION' : 'STANDBY'}
          </span>
        </div>
      </div>

      {/* Translucent Conversation Stream Area */}
      <FuturisticScrollTrack
        className="h-64 sm:h-80 md:h-[380px] p-4 bg-transparent"
        autoScrollOnUpdate={turns}
      >
        <div className="space-y-3.5 pr-2">
          {isEmpty ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-8 text-slate-500 space-y-2 animate-fade-in">
              <div className="w-10 h-10 rounded-2xl bg-white/80 border border-blue-100 flex items-center justify-center text-blue-600 mb-1 shadow-md shadow-blue-500/10 animate-float-smooth backdrop-blur-md">
                <Sparkles className="w-5 h-5" />
              </div>
              <p className="text-xs sm:text-sm font-bold text-slate-800">
                {state === 'IDLE' && 'Tap the glowing blue orb above or press Spacebar to start speaking with Iris.'}
                {state === 'CONNECTING' && 'Connecting to Iris live link...'}
                {state === 'LISTENING' && 'Active listening... Speak naturally or ask questions.'}
                {state === 'SPEAKING' && 'Iris is responding... You can interrupt anytime by speaking!'}
                {state === 'ERROR' && 'Link issue. Tap retry or click orb to reconnect.'}
              </p>
              <p className="text-[11px] text-slate-600 font-mono font-medium max-w-md">
                Talk directly in Hindi, Hinglish, or English, or open the Chat Panel below to analyze files, photos, and code.
              </p>
            </div>
          ) : (
            turns.map((turn, index) => (
              <div
                key={turn.id}
                className={`flex flex-col w-full animate-bubble-pop ${
                  turn.role === 'user' ? 'items-end' : 'items-start'
                }`}
                style={{
                  animationDelay: `${Math.min(index * 20, 100)}ms`,
                }}
              >
                {/* Message Meta Info Header */}
                <div className="w-full max-w-[90%] sm:max-w-[85%] flex items-center gap-1.5 mb-1 px-1 text-[10px] font-mono tracking-wider">
                  {turn.role === 'user' ? (
                    <div className="ml-auto flex items-center gap-1.5 text-blue-700 font-bold">
                      <span>YOU</span>
                      <User className="w-3 h-3 text-blue-600" />
                    </div>
                  ) : (
                    <div className="w-full flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-indigo-700 font-bold">
                        <Sparkles className="w-3 h-3 text-indigo-600" />
                        <span>I.R.I.S.</span>
                        {turn.interrupted && (
                          <span className="flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-amber-100/90 border border-amber-300 text-[9px] text-amber-800 font-bold">
                            <Zap className="w-2 h-2 text-amber-600" /> Interrupted
                          </span>
                        )}
                        {turn.isStreaming && (
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-ping ml-1" />
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Translucent Glass Speech Bubble with Soft Blurry Shadows */}
                <div
                  className={`chat-bubble-interactive max-w-[90%] sm:max-w-[85%] px-4 py-3 rounded-2xl text-xs sm:text-sm font-medium leading-relaxed shadow-lg backdrop-blur-lg transition-all ${
                    turn.role === 'user'
                      ? 'rounded-tr-xs bg-gradient-to-r from-blue-600/90 to-indigo-600/90 text-white text-right shadow-blue-500/25'
                      : 'rounded-tl-xs bg-white/70 hover:bg-white/80 border border-white/80 text-slate-900 text-left hover:border-blue-300 shadow-slate-900/5'
                  }`}
                >
                  {/* File Attachment preview */}
                  {turn.file && (
                    <div className="mb-2.5 p-2 rounded-xl bg-white/90 border border-slate-200 flex items-center gap-2.5 text-left text-slate-800 shadow-xs transition-transform hover:scale-[1.01]">
                      {turn.file.type === 'image' && turn.file.previewUrl ? (
                        <img
                          src={turn.file.previewUrl}
                          alt={turn.file.name}
                          className="w-10 h-10 object-cover rounded-lg border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-100 shrink-0 text-blue-600">
                          <FileText className="w-4 h-4" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold truncate text-slate-900">{turn.file.name}</div>
                        <div className="text-[10px] text-slate-500 uppercase">{turn.file.type}</div>
                      </div>
                    </div>
                  )}

                  {/* Message Content */}
                  <div className="break-words">
                    {turn.text ? (
                      <MarkdownRenderer
                        content={toEnglishAlphabets(turn.text)}
                        onOpenPopup={
                          onOpenPopup
                            ? (code, lang) =>
                                onOpenPopup({
                                  title: `${lang.toUpperCase()} Code`,
                                  content: code,
                                  language: lang,
                                  contentType: 'code',
                                })
                            : undefined
                        }
                      />
                    ) : (
                      <span className="italic text-slate-500">Processing transmission...</span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </FuturisticScrollTrack>

      {/* Camera Button at Bottom-Right Corner of Speech Log Panel */}
      <button
        type="button"
        onClick={onOpenCamera}
        className="absolute bottom-3 right-3 z-30 p-2.5 sm:px-3.5 sm:py-2 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white shadow-[0_10px_25px_rgba(37,99,235,0.4)] hover:shadow-[0_15px_35px_rgba(37,99,235,0.6)] hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5 group font-mono text-xs font-bold backdrop-blur-md border border-white/50"
        title="Snap live camera photo & send directly to Iris"
      >
        <Camera className="w-4 h-4 text-white group-hover:rotate-12 transition-transform shrink-0" />
        <span className="hidden sm:inline font-bold">Camera</span>
      </button>
    </div>
  );
};
