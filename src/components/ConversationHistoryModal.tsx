import React, { useState, useEffect } from 'react';
import {
  X,
  History,
  User,
  Sparkles,
  Search,
  Trash2,
  Filter,
  Calendar,
  MessageSquare,
  FileText,
  Volume2,
  Folder,
} from 'lucide-react';
import { crossSessionMemory, StoredInteractionMemory } from '../services/crossSessionMemory.ts';
import { MarkdownRenderer } from './MarkdownRenderer.tsx';
import { toEnglishAlphabets } from '../utils/transliteration.ts';

interface ConversationHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPersonName?: string;
  theme?: 'light' | 'dark';
  onRequestDeletePerson?: (personName: string) => void;
}

export const ConversationHistoryModal: React.FC<ConversationHistoryModalProps> = ({
  isOpen,
  onClose,
  initialPersonName,
  theme = 'light',
  onRequestDeletePerson,
}) => {
  const isDark = theme === 'dark';
  const [interactions, setInteractions] = useState<StoredInteractionMemory[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPerson, setSelectedPerson] = useState<string>('All');

  useEffect(() => {
    if (isOpen) {
      const allInt = crossSessionMemory.getAllInteractions();
      setInteractions(allInt);

      let targetPerson = initialPersonName || 'All';
      const cleanTarget = targetPerson.toLowerCase().trim();

      if (
        cleanTarget === 'latest' ||
        cleanTarget === 'recent' ||
        cleanTarget === 'abhi ki' ||
        cleanTarget === 'tatkaal' ||
        cleanTarget === 'all'
      ) {
        targetPerson = 'All';
      } else {
        const hasSpeaker = allInt.some((t) => {
          const folder = (t.personFolder || t.speakerName || '').toLowerCase().trim();
          return folder === cleanTarget ||
            (cleanTarget === 'dev' && (folder === 'dev' || t.speakerName?.toLowerCase() === 'you' || t.role === 'user')) ||
            (cleanTarget === 'unidentified person' && (folder === 'unidentified person' || folder === 'unknown' || t.isTemporary));
        });
        if (!hasSpeaker) {
          targetPerson = 'All';
        }
      }

      setSelectedPerson(targetPerson);
    }
  }, [isOpen, initialPersonName]);

  // Listen to cross-session memory updates (deletion, name learning, additions)
  useEffect(() => {
    const handleUpdate = () => {
      setInteractions(crossSessionMemory.getAllInteractions());
    };
    window.addEventListener('iris-history-updated', handleUpdate);
    return () => window.removeEventListener('iris-history-updated', handleUpdate);
  }, []);

  if (!isOpen) return null;

  // Extract unique person folders from history (NEVER include I.R.I.S.)
  const peopleList: string[] = ['All'];
  interactions.forEach((item) => {
    let folder = (item.personFolder || (item.speakerName !== 'I.R.I.S.' ? item.speakerName : '') || 'Unidentified Person').trim();
    if (folder.toLowerCase() === 'unknown' || folder.toLowerCase() === 'guest') {
      folder = 'Unidentified Person';
    }
    if (folder !== 'I.R.I.S.' && !peopleList.includes(folder)) {
      peopleList.push(folder);
    }
  });

  if (peopleList.length === 1) {
    peopleList.push('Unidentified Person');
  }

  // Filter interactions by person folder and search query
  const filteredInteractions = interactions.filter((turn) => {
    let folder = (turn.personFolder || (turn.speakerName !== 'I.R.I.S.' ? turn.speakerName : '') || 'Unidentified Person').trim();
    if (folder.toLowerCase() === 'unknown' || folder.toLowerCase() === 'guest') {
      folder = 'Unidentified Person';
    }

    const matchesPerson =
      selectedPerson === 'All' ||
      folder.toLowerCase() === selectedPerson.toLowerCase() ||
      (selectedPerson.toLowerCase() === 'dev' && (folder.toLowerCase() === 'dev' || turn.speakerName?.toLowerCase() === 'you')) ||
      (selectedPerson.toLowerCase() === 'unidentified person' && (folder.toLowerCase() === 'unidentified person' || turn.isTemporary));

    const queryLower = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !queryLower ||
      turn.text.toLowerCase().includes(queryLower) ||
      folder.toLowerCase().includes(queryLower) ||
      (turn.speakerName || '').toLowerCase().includes(queryLower);

    return matchesPerson && matchesQuery;
  });

  const handleClearHistory = () => {
    if (window.confirm('Are you sure you want to clear all conversation history from memory?')) {
      crossSessionMemory.clearMemory();
      setInteractions([]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/65 backdrop-blur-xl animate-motion-blur-in">
      <div
        className={`w-full max-w-3xl h-[85vh] rounded-3xl border flex flex-col shadow-2xl relative overflow-hidden transition-all duration-300 ${
          isDark
            ? 'bg-slate-950/90 border-cyan-500/30 text-slate-100 shadow-[0_25px_60px_rgba(6,182,212,0.2)]'
            : 'bg-white/95 border-white/80 text-slate-900 shadow-[0_25px_60px_rgba(14,165,233,0.2)]'
        }`}
      >
        {/* Header Bar */}
        <div
          className={`px-5 py-4 border-b flex items-center justify-between backdrop-blur-md relative z-10 ${
            isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-slate-100/80 border-slate-200/80'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center border shadow-md ${
                isDark
                  ? 'bg-cyan-950/80 border-cyan-500/40 text-cyan-400'
                  : 'bg-blue-50 border-blue-200 text-blue-600'
              }`}
            >
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className={`font-bold text-base tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Conversation & Chat History Database
                </h2>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                    isDark
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                      : 'bg-blue-100 text-blue-800 border-blue-300'
                  }`}
                >
                  {filteredInteractions.length} TURNS
                </span>
              </div>
              <p className={`text-xs font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Per-person folder history & speech logs
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`p-2 rounded-2xl transition-all spring-button ${
              isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-200 text-slate-600'
            }`}
            title="Close Chat History"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters & Search Controls */}
        <div
          className={`px-5 py-3 border-b flex flex-wrap items-center justify-between gap-3 text-xs ${
            isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50/60 border-slate-200/60'
          }`}
        >
          {/* Person Folder Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
            <div className="flex items-center gap-1 font-mono text-[11px] font-bold text-slate-400 mr-1 shrink-0">
              <Folder className="w-3.5 h-3.5 text-cyan-500" />
              <span>Person Folder:</span>
            </div>
            {peopleList.map((person) => (
              <button
                key={person}
                type="button"
                onClick={() => setSelectedPerson(person)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all shrink-0 spring-button border ${
                  selectedPerson === person
                    ? 'bg-blue-600 border-blue-500 text-white font-bold shadow-xs'
                    : isDark
                    ? 'bg-slate-800/80 border-slate-700/80 text-slate-300 hover:text-white'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {person}
              </button>
            ))}
          </div>

          {/* Search Input & Clear */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search history keywords..."
                className={`w-full pl-8 pr-3 py-1.5 rounded-xl border text-xs focus:outline-none focus:ring-2 ${
                  isDark
                    ? 'bg-slate-900 border-slate-700 text-white focus:ring-cyan-500/30'
                    : 'bg-white border-slate-200 text-slate-900 focus:ring-blue-500/30'
                }`}
              />
            </div>

            <button
              type="button"
              onClick={() => {
                if (onRequestDeletePerson) {
                  onRequestDeletePerson(selectedPerson);
                } else {
                  handleClearHistory();
                }
              }}
              className={`p-1.5 rounded-xl border text-rose-500 hover:bg-rose-500/10 transition-colors spring-button flex items-center gap-1 text-xs font-semibold ${
                isDark ? 'border-rose-500/30' : 'border-rose-200'
              }`}
              title={`Delete history for ${selectedPerson}`}
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Delete {selectedPerson}</span>
            </button>
          </div>
        </div>

        {/* Conversation Stream Timeline */}
        <div className="flex-1 overflow-y-auto custom-chat-scrollbar p-5 bg-transparent">
          <div className="space-y-4 pr-1">
            {filteredInteractions.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <MessageSquare className="w-10 h-10 mx-auto text-slate-400 opacity-60 animate-bounce" />
                <p className={`text-sm font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  No conversation logs found for "{selectedPerson}".
                </p>
                <p className="text-xs font-mono text-slate-500 max-w-sm mx-auto">
                  All past voice speech logs and text chats are automatically saved per person in the local memory database.
                </p>
              </div>
            ) : (
              filteredInteractions.map((turn, idx) => {
                const isIris = turn.role === 'iris';
                const speakerName = isIris ? 'I.R.I.S.' : (turn.speakerName || turn.personFolder || 'Unidentified Person');

                return (
                  <div
                    key={turn.id || idx}
                    className={`flex flex-col w-full animate-bubble-pop ${
                      isIris ? 'items-start' : 'items-end'
                    }`}
                  >
                    {/* Header line with timestamp and speaker name */}
                    <div className="flex items-center gap-2 mb-1 px-1 text-[10px] font-mono text-slate-400">
                      <span className="font-bold flex items-center gap-1">
                        {isIris ? (
                          <>
                            <Sparkles className="w-3 h-3 text-cyan-400" />
                            <span className="text-cyan-400">I.R.I.S.</span>
                          </>
                        ) : (
                          <>
                            <User className="w-3 h-3 text-blue-500" />
                            <span className={isDark ? 'text-slate-200' : 'text-slate-800'}>{speakerName}</span>
                          </>
                        )}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-2.5 h-2.5" />
                        {new Date(turn.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span>•</span>
                      <span className="uppercase text-[9px] px-1.5 py-0.2 rounded bg-slate-500/10 border border-slate-500/20 font-bold">
                        {turn.type === 'speech_log' ? 'Voice' : 'Chat'}
                      </span>
                    </div>

                    {/* Speech bubble */}
                    <div
                      className={`max-w-[90%] sm:max-w-[85%] px-4 py-3 rounded-2xl text-xs sm:text-sm font-medium leading-relaxed shadow-md backdrop-blur-xl border ${
                        isIris
                          ? isDark
                            ? 'rounded-tl-xs bg-slate-900/80 border-cyan-500/30 text-slate-100'
                            : 'rounded-tl-xs bg-white/80 border-slate-200 text-slate-900'
                          : 'rounded-tr-xs bg-blue-600 text-white border-blue-500'
                      }`}
                    >
                      <MarkdownRenderer content={toEnglishAlphabets(turn.text)} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
