import React, { useState } from 'react';
import {
  X,
  Info,
  Sparkles,
  Command,
  Monitor,
  Send,
  Calendar,
  Bell,
  FileText,
  Music,
  MapPin,
  ShieldCheck,
  Zap,
  Phone,
  Search,
} from 'lucide-react';
import { RippleButton } from './RippleButton.tsx';

interface InformationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRunDiagnostic?: () => void;
}

export const InformationModal: React.FC<InformationModalProps> = ({
  isOpen,
  onClose,
  onRunDiagnostic,
}) => {
  const [activeTab, setActiveTab] = useState<'commands' | 'features' | 'shortcuts' | 'about'>('commands');
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const commandCategories = [
    {
      title: 'Voice Activation & Talk',
      icon: <Sparkles className="w-4 h-4 text-blue-600" />,
      examples: [
        'Click the central glowing blue orb to start / stop speaking',
        'Press Spacebar anytime to quickly toggle voice talk',
        'Speak in Hindi, Hinglish, or English naturally',
        'Interrupt anytime while Iris is speaking to ask follow-up questions',
      ],
    },
    {
      title: 'Memory Database & Previous Talks Recall',
      icon: <FileText className="w-4 h-4 text-cyan-600" />,
      examples: [
        '"Humne pehle kya baat ki thi?" / "Do you remember what we talked about earlier?"',
        '"What did I tell you about my project?" / "Do you remember my favorite food?"',
        '"PDF 1 kholo" (Retrieves "PDF 1" directly from Google Files Downloads folder without asking for path)',
        '"Remember that I have a project deadline on Friday"',
        '"What files have we discussed in previous sessions?"',
      ],
    },
    {
      title: 'Calendar & Scheduling',
      icon: <Calendar className="w-4 h-4 text-blue-500" />,
      examples: [
        '"Schedule meeting with Dev tomorrow at 4 PM"',
        '"Meeting rakho client ke sath Monday ko 11 baje"',
        '"Mere aaj ke meetings dikhao"',
        '"Check my calendar for tomorrow"',
      ],
    },
    {
      title: 'Google Maps & High-Precision GPS Location',
      icon: <MapPin className="w-4 h-4 text-emerald-500" />,
      examples: [
        '"Where am I?" / "What is my exact GPS coordinates and address?"',
        '"Google Maps kholo" / "Show interactive radar map"',
        '"Find nearby restaurants" / "Aas paas koi hospital/petrol pump hai?"',
        '"Navigate to India Gate" / "Airport ke directions dikhao"',
        '"What time is it in New York / Tokyo right now?"',
      ],
    },
    {
      title: 'Notifications & Messaging',
      icon: <Bell className="w-4 h-4 text-amber-500" />,
      examples: [
        '"Read my latest notifications"',
        '"Koi naya WhatsApp message aaya hai kya?"',
        '"Reply to Rahul: On my way"',
        '"Mom ko WhatsApp par message bhejo: Main ghar aa raha hoon"',
      ],
    },
    {
      title: 'Reminders & Tasks',
      icon: <Bell className="w-4 h-4 text-purple-500" />,
      examples: [
        '"Remind me to call Rahul at 6 PM"',
        '"Shaam ko 8 baje medicine lene ka reminder lagao"',
        '"Show my active reminders"',
      ],
    },
    {
      title: 'Notes & Memos',
      icon: <FileText className="w-4 h-4 text-indigo-500" />,
      examples: [
        '"Take a note: Project deadline is Friday"',
        '"Note banao: Grocery list - milk, eggs, bread"',
        '"Mera notes list dikhao"',
      ],
    },
    {
      title: 'Media Controls & Music',
      icon: <Music className="w-4 h-4 text-cyan-500" />,
      examples: [
        '"Play music" / "Pause playback"',
        '"Next track" / "Previous song"',
        '"Volume 80 percent karo"',
        '"Spotify par Lo-Fi beats search karo"',
      ],
    },
    {
      title: 'Windows PC & App Automation',
      icon: <Monitor className="w-4 h-4 text-sky-500" />,
      examples: [
        '"Notepad kholo" / "VS Code open karo"',
        '"Terminal kholo" / "Calculator chalao"',
        '"Wi-Fi settings open karo"',
        '"Task Manager kholo"',
      ],
    },
    {
      title: 'Phone Calls & Contacts',
      icon: <Phone className="w-4 h-4 text-rose-500" />,
      examples: [
        '"Call Mom" / "Rahul ko call lagao"',
        '"Dial 9876543210"',
        '"Dev ko call karo"',
      ],
    },
  ];

  const filteredCategories = commandCategories.map(cat => ({
    ...cat,
    examples: cat.examples.filter(ex => 
      !searchQuery.trim() || 
      cat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ex.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(cat => cat.examples.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-2xl bg-white border border-slate-200/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] text-slate-900">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 shadow-sm">
              <Info className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 flex items-center gap-2 font-mono">
                I.R.I.S. INTELLIGENCE <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold font-mono">v3.5 LIVE</span>
              </h2>
              <p className="text-xs text-slate-500">
                System Documentation, Voice Capabilities & Hotkeys
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-300 flex items-center justify-center text-slate-600 hover:text-slate-900 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-slate-100 px-4 sm:px-6 gap-2 bg-white">
          <button
            onClick={() => setActiveTab('commands')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'commands'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Voice Commands ({filteredCategories.length})
          </button>
          <button
            onClick={() => setActiveTab('features')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'features'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            System Capabilities
          </button>
          <button
            onClick={() => setActiveTab('shortcuts')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'shortcuts'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Keyboard Shortcuts
          </button>
          <button
            onClick={() => setActiveTab('about')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'about'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            About I.R.I.S.
          </button>
        </div>

        {/* Content Area */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'commands' && (
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search voice commands (e.g., meeting, whatsapp, music, reminder)..."
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>

              {/* Commands Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredCategories.map((cat, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-blue-300 transition-colors flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2 font-bold text-xs text-slate-900 mb-2">
                        {cat.icon}
                        <span>{cat.title}</span>
                      </div>
                      <ul className="space-y-1.5 text-xs text-slate-600">
                        {cat.examples.map((ex, i) => (
                          <li key={i} className="flex items-start gap-1.5 font-mono">
                            <span className="text-blue-500 font-bold">•</span>
                            <span className="leading-relaxed">{ex}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'features' && (
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-100 flex items-start gap-3">
                <div className="p-2 rounded-xl bg-blue-500 text-white shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-blue-950 uppercase tracking-wide">Real-Time Gemini Live Audio</h4>
                  <p className="text-xs text-slate-600 mt-1">
                    Continuous bidirectional voice streaming with natural barge-in / interruption support, low-latency audio rendering, and multilingual transliteration in Hinglish and English.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100 flex items-start gap-3">
                <div className="p-2 rounded-xl bg-emerald-500 text-white shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wide">Safe Device Bridge</h4>
                  <p className="text-xs text-slate-600 mt-1">
                    Direct integration for scheduling meetings, managing reminders, creating notes, handling notifications, launching system apps, web search, media control, and contacts.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-100 flex items-start gap-3">
                <div className="p-2 rounded-xl bg-purple-500 text-white shrink-0">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-purple-950 uppercase tracking-wide">Accurate Date & Timezone Awareness</h4>
                  <p className="text-xs text-slate-600 mt-1">
                    Live system clock and timezone injection ensures meeting dates, reminders, and relative day math (like "tomorrow" or "next Friday") are calculated accurately.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'shortcuts' && (
            <div className="space-y-2.5">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-700">Toggle Voice Session / Tap to Talk</span>
                <kbd className="px-2.5 py-1 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg shadow-sm text-slate-800">
                  Space
                </kbd>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-700">Open Multimodal Chat & File Lab</span>
                <kbd className="px-2.5 py-1 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg shadow-sm text-slate-800">
                  C
                </kbd>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-700">Open Settings & Voice Options</span>
                <kbd className="px-2.5 py-1 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg shadow-sm text-slate-800">
                  S
                </kbd>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-700">Stop Speech / Close Any Active Modal</span>
                <kbd className="px-2.5 py-1 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg shadow-sm text-slate-800">
                  Esc
                </kbd>
              </div>
            </div>
          )}

          {activeTab === 'about' && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-xs leading-relaxed text-slate-600">
              <div className="flex items-center gap-2 font-mono font-bold text-slate-900 text-sm">
                <span>I.R.I.S (Information Retrieval Intelligence System)</span>
              </div>
              <p>
                I.R.I.S (Information Retrieval Intelligence System) is a next-generation real-time voice and multimodal AI assistant. She speaks with a witty, vibrant, confident, and playful personality in natural Hinglish and English.
              </p>
              <div className="p-3 rounded-xl bg-white border border-slate-200 text-slate-800 font-mono text-[11px] space-y-1">
                <div>• CREATOR - Dev</div>
                <div>• Full Name: Information Retrieval Intelligence System</div>
                <div>• Architecture: Gemini Live Full-Duplex Audio Engine</div>
                <div>• Core Platform: Clean White HUD Interface with Central Audio-Bisected Orb</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="text-[11px] font-mono text-slate-500">
            Press <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[10px] font-mono">Esc</kbd> to close
          </div>
          <RippleButton variant="primary" size="sm" onClick={onClose}>
            Got it
          </RippleButton>
        </div>
      </div>
    </div>
  );
};
