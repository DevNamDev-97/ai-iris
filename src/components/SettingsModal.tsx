import React, { useState } from 'react';
import {
  Settings,
  X,
  Volume2,
  Play,
  Pause,
  Sparkles,
  Check,
  User,
  Sliders,
  ShieldCheck,
  Activity,
  Headphones,
  Monitor,
  Smartphone,
  Globe,
  Database,
  Brain,
  Search,
  Trash2,
  FileText,
  Sun,
  Moon,
} from 'lucide-react';
import { RippleButton } from './RippleButton.tsx';
import { crossSessionMemory } from '../services/crossSessionMemory.ts';
import { speakerMemoryStore } from '../services/speakerMemoryStore.ts';
import { triggerHaptic } from '../utils/haptics.ts';

export interface VoiceOption {
  id: string;
  name: string;
  gender: 'Female' | 'Male' | 'Dynamic';
  style: string;
  description: string;
  samplePhrase: string;
}

export const AVAILABLE_VOICES: VoiceOption[] = [
  {
    id: 'Leda',
    name: 'Leda (Default)',
    gender: 'Female',
    style: 'Articulate, smart, confident',
    description: 'Clear, crisp, and authoritative professional tone with ultra-high clarity in Hinglish and English.',
    samplePhrase: 'System active hai. Main har task ko high accuracy ke sath execute kar sakti hoon.',
  },
  {
    id: 'Kore',
    name: 'Kore',
    gender: 'Female',
    style: 'Young, energetic, witty & friendly',
    description: 'Bright, confident, and playful close-friend tone in Hinglish and English.',
    samplePhrase: 'Haan bol na yaar! Main sun rahi hoon, bata kya help chahiye?',
  },
  {
    id: 'Aoede',
    name: 'Aoede',
    gender: 'Female',
    style: 'Soft, warm, soothing & elegant',
    description: 'Gentle, melodious, and calm. Ideal for relaxed discussions and detailed reviews.',
    samplePhrase: 'Namaste! Main aapki madad karne ke liye bilkul taiyyar hoon.',
  },
  {
    id: 'Puck',
    name: 'Puck',
    gender: 'Dynamic',
    style: 'Playful, upbeat & animated',
    description: 'High energy, vibrant, and entertaining tone.',
    samplePhrase: 'Hey there! Aaj kuch cool and exciting create karte hain!',
  },
  {
    id: 'Charon',
    name: 'Charon',
    gender: 'Male',
    style: 'Deep, calm, resonant & steady',
    description: 'Deep and composed tone with grounded clarity.',
    samplePhrase: 'Main ready hoon. Apne commands dijiye.',
  },
  {
    id: 'Fenrir',
    name: 'Fenrir',
    gender: 'Male',
    style: 'Bold, confident, authoritative',
    description: 'Strong, commanding, and punchy vocal profile.',
    samplePhrase: 'All subsystems online and optimized. Let us get to work.',
  },
  {
    id: 'Zephyr',
    name: 'Zephyr',
    gender: 'Dynamic',
    style: 'Gentle, smooth, friendly',
    description: 'Airy, balanced, and easy-listening conversational voice.',
    samplePhrase: 'Sab theek hai. Main yahan hoon, bataiye.',
  },
  {
    id: 'Orus',
    name: 'Orus',
    gender: 'Dynamic',
    style: 'Dynamic, enthusiastic, bold',
    description: 'Modern, fast-paced, and engaging tone.',
    samplePhrase: 'Ready when you are! Let us solve this together.',
  },
];

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedVoice: string;
  onSelectVoice: (voiceId: string) => void;
  platformMode?: 'auto' | 'windows' | 'android';
  onSelectPlatform?: (platform: 'auto' | 'windows' | 'android') => void;
  onRunDiagnostic?: () => Promise<{ success: boolean; message: string }>;
  theme?: 'light' | 'dark';
  onToggleTheme?: (theme: 'light' | 'dark') => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  selectedVoice,
  onSelectVoice,
  platformMode = 'auto',
  onSelectPlatform,
  onRunDiagnostic,
  theme = 'light',
  onToggleTheme,
}) => {
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<string | null>(null);
  const [isTestingAudio, setIsTestingAudio] = useState(false);
  const [memorySearchQuery, setMemorySearchQuery] = useState('');
  const [memorySearchResults, setMemorySearchResults] = useState<any | null>(null);
  const [memoryStats, setMemoryStats] = useState(() => crossSessionMemory.getStats());
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  if (!isOpen) return null;

  const handleSearchMemory = (q: string) => {
    setMemorySearchQuery(q);
    if (!q.trim()) {
      setMemorySearchResults(null);
      return;
    }
    const res = crossSessionMemory.searchInteractionMemory(q);
    setMemorySearchResults(res);
  };

  const handleExecuteReset = async () => {
    try {
      setIsResetting(true);
      triggerHaptic('medium');

      // 1. Reset client crossSessionMemory
      crossSessionMemory.clearMemory();

      // 2. Reset client speakerMemoryStore to default seed state
      speakerMemoryStore.resetToDefaults();

      // 3. Reset server memory database
      try {
        await fetch('/api/memory/reset', { method: 'POST' });
      } catch (err) {
        console.warn('Backend memory reset request error:', err);
      }

      // 4. Update UI states
      setMemoryStats(crossSessionMemory.getStats());
      setMemorySearchResults(null);
      setMemorySearchQuery('');
      setIsConfirmingReset(false);
      setResetSuccessMessage('✓ Memory database has been completely reset!');

      setTimeout(() => {
        setResetSuccessMessage(null);
      }, 4000);
    } catch (err: any) {
      console.error('Failed to reset memory database:', err);
    } finally {
      setIsResetting(false);
    }
  };

  const handlePreviewVoice = async (voice: VoiceOption) => {
    if (playingVoiceId === voice.id) {
      setPlayingVoiceId(null);
      return;
    }

    setIsLoadingPreview(true);
    setPlayingVoiceId(voice.id);

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: voice.samplePhrase,
          voice: voice.id,
        }),
      });

      if (!res.ok) throw new Error('Voice preview failed');
      const data = await res.json();

      if (data.audio) {
        const audio = new Audio(`data:audio/wav;base64,${data.audio}`);
        audio.onended = () => {
          setPlayingVoiceId(null);
        };
        audio.onerror = () => {
          setPlayingVoiceId(null);
        };
        await audio.play();
      }
    } catch (err) {
      console.error('Failed to preview voice:', err);
      setPlayingVoiceId(null);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleTestSpeaker = async () => {
    if (!onRunDiagnostic) return;
    setIsTestingAudio(true);
    setDiagnosticResult('Testing speaker tone...');
    try {
      const result = await onRunDiagnostic();
      setDiagnosticResult(result.message);
    } catch (err: any) {
      setDiagnosticResult(`Error: ${err?.message || 'Failed'}`);
    } finally {
      setIsTestingAudio(false);
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/25 backdrop-blur-[3px] animate-motion-blur-in cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[90vh] bg-slate-900/90 border border-cyan-500/40 rounded-2xl shadow-[0_20px_60px_rgba(6,182,212,0.25)] flex flex-col overflow-hidden relative motion-blur-glass cursor-default"
      >
        {/* Ambient Top Glow */}
        <div className="absolute -top-12 -left-12 w-36 h-36 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="px-5 py-4 bg-slate-950/80 border-b border-cyan-500/25 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
              <Settings className="w-5 h-5 text-white animate-spin-slow" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2 font-mono">
                IRIS SYSTEM CONFIG <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-400/40">WIN / ANDROID</span>
              </h2>
              <p className="text-xs text-cyan-300/70">
                Voice profiles, Windows & Android automation mode
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body - Scrollable */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Section: UI Theme & Aesthetics Mode (Light Glossy / Cyber Dark) */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-cyan-500/25 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {theme === 'dark' ? (
                  <Moon className="w-4 h-4 text-cyan-400" />
                ) : (
                  <Sun className="w-4 h-4 text-amber-400" />
                )}
                <h4 className="text-xs font-bold text-slate-200 font-mono tracking-wider">
                  UI THEME & ACCESSIBILITY MODE
                </h4>
              </div>
              <span className="text-[10px] font-mono text-cyan-300 font-semibold px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/30">
                ACTIVE: {theme.toUpperCase()} MODE
              </span>
            </div>

            <p className="text-xs text-slate-300">
              Toggle between the 40% translucent glossy white glass aesthetic and the high-contrast cyber dark glass mode. Your choice is automatically saved.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => onToggleTheme?.('light')}
                className={`p-3 rounded-xl border transition-all flex items-center gap-3 text-left spring-button ${
                  theme === 'light'
                    ? 'bg-white border-blue-400 text-slate-900 shadow-md shadow-blue-500/20 ring-2 ring-blue-400'
                    : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
                  <Sun className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-xs flex items-center gap-1.5">
                    <span>Glossy White</span>
                    {theme === 'light' && <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />}
                  </div>
                  <div className="text-[10px] opacity-75 truncate">40% Translucent White Glass</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => onToggleTheme?.('dark')}
                className={`p-3 rounded-xl border transition-all flex items-center gap-3 text-left spring-button ${
                  theme === 'dark'
                    ? 'bg-cyan-950/90 border-cyan-400 text-white shadow-md shadow-cyan-400/20 ring-2 ring-cyan-400'
                    : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0">
                  <Moon className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-xs flex items-center gap-1.5">
                    <span>Cyber Dark</span>
                    {theme === 'dark' && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
                  </div>
                  <div className="text-[10px] opacity-75 truncate">High-Contrast Dark Glass</div>
                </div>
              </button>
            </div>
          </div>

          {/* Section: Long-Term Memory Database & Learning Engine */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-cyan-500/25 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-cyan-400" />
                <h4 className="text-xs font-bold text-slate-200 font-mono tracking-wider">
                  PERSISTENT MEMORY & KNOWLEDGE DATABASE
                </h4>
              </div>
              <span className="flex items-center gap-1.5 text-[10px] font-mono text-cyan-300 font-semibold px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                LEARNING ACTIVE
              </span>
            </div>

            <p className="text-xs text-slate-300">
              Iris automatically memorizes and learns from every chat, voice speech log turn, file shared, and personal detail across sessions. When you ask about previous topics, she finds it in her database and answers instantly.
            </p>

            {/* Memory Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs font-mono">
              <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                <div className="text-base font-bold text-cyan-400">{memoryStats.interactionsCount}</div>
                <div className="text-[10px] text-slate-400">Total Turns</div>
              </div>
              <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                <div className="text-base font-bold text-blue-400">{memoryStats.speechLogsCount}</div>
                <div className="text-[10px] text-slate-400">Voice Speech Logs</div>
              </div>
              <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                <div className="text-base font-bold text-emerald-400">{memoryStats.factsCount}</div>
                <div className="text-[10px] text-slate-400">Learned Facts</div>
              </div>
              <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                <div className="text-base font-bold text-indigo-400">{memoryStats.filesCount}</div>
                <div className="text-[10px] text-slate-400">Indexed Files</div>
              </div>
            </div>

            {/* Memory Search Test Bar */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs">
                <Search className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <input
                  type="text"
                  value={memorySearchQuery}
                  onChange={(e) => handleSearchMemory(e.target.value)}
                  placeholder="Test memory search (e.g. 'PDF 1', 'Dev', 'project', 'favorite')..."
                  className="bg-transparent border-none text-white focus:outline-none w-full placeholder:text-slate-500 text-xs"
                />
                {memorySearchQuery && (
                  <button
                    type="button"
                    onClick={() => handleSearchMemory('')}
                    className="text-slate-400 hover:text-white text-xs px-1"
                  >
                    Clear
                  </button>
                )}
              </div>

              {memorySearchResults && (
                <div className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-xs space-y-1 text-slate-200 animate-dropdown-blur">
                  <div className="font-semibold text-cyan-300 flex items-center gap-1.5">
                    <Database className="w-3 h-3" />
                    <span>Search Result:</span>
                  </div>
                  <p className="text-[11px] text-slate-300">{memorySearchResults.summary}</p>
                  {memorySearchResults.relevantFacts?.length > 0 && (
                    <div className="pt-1 space-y-0.5">
                      {memorySearchResults.relevantFacts.map((f: any) => (
                        <div key={f.id} className="text-[10px] font-mono text-emerald-300 bg-emerald-950/60 p-1 rounded">
                          • {f.key}: {f.value}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Clear Database button with inline confirmation & visual feedback */}
            <div className="pt-2 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-2">
              {resetSuccessMessage ? (
                <div className="text-[11px] font-mono text-emerald-400 font-semibold bg-emerald-950/60 border border-emerald-500/40 px-3 py-1.5 rounded-lg flex items-center gap-1.5 animate-fade-in w-full sm:w-auto">
                  <span>{resetSuccessMessage}</span>
                </div>
              ) : (
                <span className="text-[10px] text-slate-500">
                  Clears all indexed chats, speech logs, facts & speaker folders back to factory seed.
                </span>
              )}

              {isConfirmingReset ? (
                <div className="flex items-center gap-2 animate-fade-in">
                  <span className="text-xs text-rose-300 font-semibold">Confirm Reset?</span>
                  <button
                    type="button"
                    onClick={handleExecuteReset}
                    disabled={isResetting}
                    className="px-3 py-1 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-500 text-white shadow-md active:scale-95 transition-all"
                  >
                    {isResetting ? 'Resetting...' : 'Yes, Reset Now'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsConfirmingReset(false)}
                    className="px-2.5 py-1 text-xs rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsConfirmingReset(true)}
                  className="px-3 py-1.5 text-xs font-mono font-semibold text-rose-400 hover:text-white bg-rose-950/40 hover:bg-rose-600/80 border border-rose-500/40 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Reset Memory Database</span>
                </button>
              )}
            </div>
          </div>

          {/* Section: Platform Environment Target */}
          {onSelectPlatform && (
            <div className="p-4 rounded-xl bg-slate-950/70 border border-cyan-500/25 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-cyan-400" />
                  <h4 className="text-xs font-bold text-slate-200 font-mono tracking-wider">
                    TARGET AUTOMATION PLATFORM
                  </h4>
                </div>
                <span className="text-[10px] font-mono text-cyan-300">
                  Current: {platformMode.toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => onSelectPlatform('auto')}
                  className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                    platformMode === 'auto'
                      ? 'bg-cyan-950 border-cyan-400 text-white shadow-md'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <Globe className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold">Auto-Detect</span>
                  <span className="text-[9px] text-slate-500">Universal</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSelectPlatform('windows')}
                  className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                    platformMode === 'windows'
                      ? 'bg-cyan-950 border-cyan-400 text-white shadow-md'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <Monitor className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-bold">Windows PC</span>
                  <span className="text-[9px] text-slate-500">Apps & Win32</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSelectPlatform('android')}
                  className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                    platformMode === 'android'
                      ? 'bg-cyan-950 border-cyan-400 text-white shadow-md'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold">Android Mobile</span>
                  <span className="text-[9px] text-slate-500">Native Bridge</span>
                </button>
              </div>
            </div>
          )}

          {/* Section: Dedicated Voice Selector */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-slate-100 font-mono tracking-wide">
                  DEDICATED VOICE PROFILE
                </h3>
              </div>
              <span className="text-[11px] text-cyan-400/70 font-mono">
                {AVAILABLE_VOICES.length} Voices Available
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {AVAILABLE_VOICES.map((voice) => {
                const isSelected = selectedVoice === voice.id;
                const isPlaying = playingVoiceId === voice.id;

                return (
                  <div
                    key={voice.id}
                    onClick={() => onSelectVoice(voice.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                      isSelected
                        ? 'bg-cyan-950/50 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.25)]'
                        : 'bg-slate-950/60 border-slate-800 hover:border-cyan-500/40 hover:bg-slate-900/80'
                    }`}
                  >
                    {/* Top Row: Name, Badge & Selection Check */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm text-white">
                            {voice.name}
                          </span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                              voice.gender === 'Female'
                                ? 'bg-pink-500/20 text-pink-300 border-pink-500/30'
                                : voice.gender === 'Male'
                                ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                                : 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                            }`}
                          >
                            {voice.gender}
                          </span>
                        </div>

                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-cyan-400 text-slate-950 flex items-center justify-center shrink-0 shadow-[0_0_8px_#22d3ee]">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        )}
                      </div>

                      <p className="text-[11px] font-medium text-cyan-300/90 mb-1">
                        {voice.style}
                      </p>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        {voice.description}
                      </p>
                    </div>

                    {/* Bottom Row: Sample Player & Selector */}
                    <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePreviewVoice(voice);
                        }}
                        className={`flex items-center gap-1.5 text-[11px] font-mono px-2 py-1 rounded-lg border transition-colors ${
                          isPlaying
                            ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-bold animate-pulse'
                            : 'bg-slate-900 text-cyan-300 border-cyan-500/30 hover:bg-cyan-950'
                        }`}
                      >
                        {isPlaying ? (
                          <>
                            <Pause className="w-3 h-3" /> Playing...
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3" /> Preview Voice
                          </>
                        )}
                      </button>

                      <span
                        className={`text-[10px] font-mono ${
                          isSelected ? 'text-cyan-300 font-bold' : 'text-slate-500'
                        }`}
                      >
                        {isSelected ? 'ACTIVE' : 'SELECT'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section: Audio Hardware Diagnostics */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-cyan-500/25 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <h4 className="text-xs font-bold text-slate-200 font-mono tracking-wider">
                  AUDIO & HARDWARE DIAGNOSTIC
                </h4>
              </div>
              <RippleButton
                variant="secondary"
                size="sm"
                onClick={handleTestSpeaker}
                disabled={isTestingAudio}
              >
                <Headphones className="w-3.5 h-3.5 text-cyan-300" />
                <span>{isTestingAudio ? 'Testing...' : 'Test Speaker Tone'}</span>
              </RippleButton>
            </div>
            {diagnosticResult && (
              <div className="text-[11px] font-mono text-cyan-300 bg-cyan-950/40 p-2 rounded-lg border border-cyan-500/30">
                {diagnosticResult}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-slate-950/90 border-t border-cyan-500/20 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Windows & Android settings synchronized</span>
          </div>
          <RippleButton variant="primary" size="sm" onClick={onClose}>
            Done
          </RippleButton>
        </div>
      </div>
    </div>
  );
};
