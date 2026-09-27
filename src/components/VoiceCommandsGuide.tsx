import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, Sparkles, Phone, MessageSquare, Globe, Users, ExternalLink, Send, Monitor, Terminal, Code2 } from 'lucide-react';

export const VoiceCommandsGuide: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  const categories = [
    {
      title: 'Windows PC Automation',
      icon: <Monitor className="w-4 h-4 text-cyan-400" />,
      examples: [
        '"Notepad kholo" / "Notepad band karo"',
        '"VS Code open karo" / "Terminal kholo"',
        '"Calculator chalao" / "Paint open karo"',
        '"Wi-Fi settings kholo" / "Sound settings"',
        '"Task Manager kholo" / "Snipping tool"',
      ],
    },
    {
      title: 'WhatsApp & SMS Automation',
      icon: <Send className="w-4 h-4 text-emerald-400" />,
      examples: [
        '"Mom ko WhatsApp par message bhej: Main ghar aa raha hoon"',
        '"Rahul ko WhatsApp par bolo meeting start ho gayi"',
        '"Devansh ko message karo: Task complete ho gaya"',
        '"9876543210 ko WhatsApp message bhejo"',
      ],
    },
    {
      title: 'In-App Searches & Media',
      icon: <MessageSquare className="w-4 h-4 text-blue-400" />,
      examples: [
        '"YouTube par Arijit Singh ke gaane chalao"',
        '"Spotify par Lo-Fi beats search karo"',
        '"Google Maps par nearest hospital navigate karo"',
        '"Amazon par wireless headphones search karo"',
      ],
    },
    {
      title: 'Web Links & Popups',
      icon: <ExternalLink className="w-4 h-4 text-purple-400" />,
      examples: [
        '"Iris, give me the link for Python documentation"',
        '"React official website ka link dikhao"',
        '"GitHub repo link do"',
        '"Find link for latest AI tools"',
      ],
    },
    {
      title: 'Calling & Contacts',
      icon: <Phone className="w-4 h-4 text-pink-400" />,
      examples: [
        '"Mom ko call karo / Call Mummy"',
        '"Rahul ko call lagao"',
        '"Call 9876543210"',
        '"Dev ko call karo"',
      ],
    },
    {
      title: 'Desktop Hotkeys & Persona',
      icon: <Sparkles className="w-4 h-4 text-amber-400" />,
      examples: [
        'Spacebar: Tap to Talk / Toggle Voice',
        'Esc: Stop speech / Close modals',
        '"Kaisi hai Iris? Dev kaun hai?" (Best Friend & Creator)',
        'Interrupt anytime: speak mid-sentence to pivot!',
      ],
    },
  ];

  return (
    <div className="w-full bg-slate-900/60 border border-cyan-500/20 rounded-2xl backdrop-blur-md overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between text-left text-cyan-200 hover:text-white transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-semibold">
          <HelpCircle className="w-4 h-4 text-cyan-400" />
          <span>Windows PC & Android Voice Commands Guide</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-cyan-400/80">
          <span>{isOpen ? 'Hide Guide' : 'Show Guide'}</span>
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {isOpen && (
        <div className="p-4 pt-1 border-t border-cyan-500/10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs animate-dropdown-blur">
          {categories.map((cat, idx) => (
            <div
              key={idx}
              style={{ animationDelay: `${idx * 25}ms` }}
              className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 flex flex-col justify-between hover:border-cyan-500/40 transition-all duration-200 animate-item-blur dropdown-item-hover"
            >
              <div>
                <div className="flex items-center gap-1.5 font-semibold text-cyan-300 mb-2">
                  {cat.icon}
                  <span>{cat.title}</span>
                </div>
                <ul className="space-y-1.5 text-slate-300">
                  {cat.examples.map((ex, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-cyan-500 font-bold">•</span>
                      <span className="leading-tight">{ex}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
