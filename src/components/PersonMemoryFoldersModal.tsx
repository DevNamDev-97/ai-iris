import React, { useState, useEffect } from 'react';
import {
  speakerMemoryStore,
  PersonMemoryFolder,
  PersonMemoryItem,
} from '../services/speakerMemoryStore.ts';
import { triggerHaptic } from '../utils/haptics.ts';

interface PersonMemoryFoldersModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPitchHz?: number;
  detectedSpeakerName?: string;
  theme?: 'light' | 'dark';
}

export const PersonMemoryFoldersModal: React.FC<PersonMemoryFoldersModalProps> = ({
  isOpen,
  onClose,
  currentPitchHz = 0,
  detectedSpeakerName = 'Shivshankar',
  theme = 'light',
}) => {
  const [folders, setFolders] = useState<PersonMemoryFolder[]>(speakerMemoryStore.getFolders());
  const [activeFolderId, setActiveFolderId] = useState<string>(
    speakerMemoryStore.getActiveFolder().id
  );
  const [selectedFolderId, setSelectedFolderId] = useState<string>(
    speakerMemoryStore.getActiveFolder().id
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonGender, setNewPersonGender] = useState<'male' | 'female' | 'non-binary'>('male');
  const [newPersonGrammar, setNewPersonGrammar] = useState<'masculine' | 'feminine' | 'respectful'>('masculine');
  const [newPersonRelationship, setNewPersonRelationship] = useState('Friend');

  // Add memory form state
  const [isAddingMemory, setIsAddingMemory] = useState(false);
  const [newMemKey, setNewMemKey] = useState('');
  const [newMemValue, setNewMemValue] = useState('');
  const [newMemCategory, setNewMemCategory] = useState<PersonMemoryItem['category']>('file');

  useEffect(() => {
    const unsub = speakerMemoryStore.subscribe(() => {
      setFolders(speakerMemoryStore.getFolders());
      setActiveFolderId(speakerMemoryStore.getActiveFolder().id);
    });
    return unsub;
  }, []);

  if (!isOpen) return null;

  const selectedFolder =
    folders.find((f) => f.id === selectedFolderId) ||
    folders.find((f) => f.id === activeFolderId) ||
    folders[0];

  const filteredMemories = selectedFolder?.memories.filter(
    (m) =>
      m.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.value.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.category.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const handleSelectFolder = (folderId: string) => {
    triggerHaptic('light');
    setSelectedFolderId(folderId);
  };

  const handleSetActiveSpeaker = (folderId: string) => {
    triggerHaptic('medium');
    speakerMemoryStore.setActiveSpeaker(folderId);
    setActiveFolderId(folderId);
  };

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPersonName.trim()) return;
    triggerHaptic('medium');

    const result = speakerMemoryStore.registerOrUpdateSpeaker({
      name: newPersonName.trim(),
      gender: newPersonGender,
      grammaticalStyle: newPersonGrammar,
      relationship: newPersonRelationship.trim(),
      pitchHz: currentPitchHz > 50 ? currentPitchHz : newPersonGender === 'male' ? 120 : 210,
    });

    if (result.rejected) {
      alert(result.reason || 'Voice biometric mismatch!');
      return;
    }

    setNewPersonName('');
    setIsAddingFolder(false);
    if (result.folder) {
      setSelectedFolderId(result.folder.id);
    }
  };

  const handleAddMemory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemKey.trim() || !newMemValue.trim() || !selectedFolder) return;
    triggerHaptic('light');

    speakerMemoryStore.addMemory({
      folderId: selectedFolder.id,
      key: newMemKey.trim(),
      value: newMemValue.trim(),
      category: newMemCategory,
      sourceText: 'Added via Person Memory Folders UI',
    });

    setNewMemKey('');
    setNewMemValue('');
    setIsAddingMemory(false);
  };

  const handleDeleteMemory = (memoryId: string) => {
    if (!selectedFolder) return;
    triggerHaptic('light');
    speakerMemoryStore.deleteMemory(selectedFolder.id, memoryId);
  };

  const handleDeleteFolder = (folderId: string) => {
    triggerHaptic('medium');
    speakerMemoryStore.deleteFolder(folderId);
  };

  const handleWipeAllFolders = () => {
    triggerHaptic('medium');
    speakerMemoryStore.deleteAllFolders();
  };

  const handleGrammarChange = (style: 'masculine' | 'feminine' | 'respectful') => {
    if (!selectedFolder) return;
    triggerHaptic('light');
    speakerMemoryStore.updateSpeakerDetails(selectedFolder.id, {
      grammaticalStyle: style,
      gender: style === 'feminine' ? 'female' : 'male',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-md">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Voice Recognition & Person Memory Folders
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Iris recognizes speakers by acoustic voice pitch and isolates memories in dedicated folders.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to delete ALL stored voice recognition data and speaker profiles?')) {
                  triggerHaptic('medium');
                  speakerMemoryStore.purgeAllVoiceData();
                  setFolders([]);
                }
              }}
              className="px-2.5 py-1 text-[11px] font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/60 dark:text-red-300 rounded-lg transition-colors border border-red-200 dark:border-red-900/50"
              title="Delete all voice profiles and stored memories"
            >
              Purge All Voice Data
            </button>
            <button
              onClick={() => {
                triggerHaptic('light');
                onClose();
              }}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Live Acoustic Voice Sensor Bar */}
        <div className="px-6 py-2.5 bg-gradient-to-r from-blue-500/10 via-cyan-500/10 to-indigo-500/10 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500" />
            </span>
            <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
              Live Voice Recognition:
            </span>
            <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 font-mono text-cyan-600 dark:text-cyan-400 border border-slate-200 dark:border-slate-700 font-bold">
              {currentPitchHz > 50 ? `${Math.round(currentPitchHz)} Hz` : '122.5 Hz (Calibrated)'}
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              Matched Speaker: <strong className="text-slate-900 dark:text-white">{detectedSpeakerName}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Active Folder:
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-600 text-white font-mono font-bold text-[11px] shadow-xs">
              📁 {folders.find((f) => f.id === activeFolderId)?.name || (folders.length > 0 ? folders[0].name : 'Scratch (Empty)')}
            </span>
          </div>
        </div>

        {/* Main Body: 2 Columns (Folders List Sidebar + Active Folder Content) */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden min-h-0">
          
          {/* Left Sidebar: Folder Tabs (4 Cols) */}
          <div className="md:col-span-4 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-slate-50/50 dark:bg-slate-950/30 overflow-y-auto p-4 space-y-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Person Folders ({folders.length})
              </span>
              <button
                onClick={() => {
                  triggerHaptic('light');
                  setIsAddingFolder(true);
                }}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-1 shadow-xs"
              >
                <span>+ New Person</span>
              </button>
            </div>

            {/* Folder Tab Items or Empty Scratch State */}
            {folders.length === 0 ? (
              <div className="p-4 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 text-center text-xs text-slate-500 space-y-2">
                <span className="text-2xl block">🌱</span>
                <p className="font-bold text-slate-700 dark:text-slate-300">Clean Scratch Slate</p>
                <p className="text-[11px] leading-relaxed text-slate-400">
                  No person folders exist yet. When you speak to Iris, she automatically records and remembers your unique voice tone forever!
                </p>
              </div>
            ) : (
              folders.map((folder) => {
                const isSelected = folder.id === selectedFolder?.id;
                const isActiveSpeaker = folder.id === activeFolderId;

                return (
                  <div
                    key={folder.id}
                    onClick={() => handleSelectFolder(folder.id)}
                    className={`p-3 rounded-2xl cursor-pointer border transition-all duration-200 ${
                      isSelected
                        ? 'bg-white dark:bg-slate-800/90 border-blue-500 shadow-md ring-1 ring-blue-500/20'
                        : 'bg-white/60 dark:bg-slate-900/40 border-slate-200/80 dark:border-slate-800/80 hover:bg-white dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-xs"
                          style={{ backgroundColor: folder.avatarColor }}
                        >
                          {folder.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                              {folder.name}
                            </h3>
                            {isActiveSpeaker && (
                              <span className="w-2 h-2 rounded-full bg-emerald-500" title="Active Speaker" />
                            )}
                          </div>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            {folder.relationship || 'User'} • {folder.gender === 'male' ? '♂ Male' : '♀ Female'}
                          </span>
                        </div>
                      </div>

                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {folder.memories.length} notes
                      </span>
                    </div>

                    {/* Voice Pitch & Grammar Badge */}
                    <div className="mt-2.5 flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/60 pt-1.5">
                      <span>🎙️ ~{Math.round(folder.voiceProfile.estimatedPitchHz)} Hz</span>
                      <span className="text-blue-600 dark:text-cyan-400 font-semibold truncate max-w-[130px]">
                        {folder.grammaticalStyle === 'masculine' ? 'chahta hai' : folder.grammaticalStyle === 'feminine' ? 'chahti hai' : 'chahte hain'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}

            {/* Quick Reset Memory & Folders Button */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={handleWipeAllFolders}
                className="w-full py-1.5 px-3 rounded-xl border border-rose-300 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-[11px] font-semibold flex items-center justify-center gap-1.5 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors shadow-2xs"
              >
                <span>🗑️ Remove All Voice Memories Except Dev</span>
              </button>
            </div>
          </div>

          {/* Right Area: Selected Person's Folder Details (8 Cols) */}
          <div className="md:col-span-8 flex flex-col bg-white dark:bg-slate-900 overflow-y-auto p-5 space-y-4">
            {selectedFolder && folders.length > 0 ? (
              <>
                {/* Folder Top Meta Card */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-md"
                      style={{ backgroundColor: selectedFolder.avatarColor }}
                    >
                      {selectedFolder.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                          📁 {selectedFolder.name}'s Folder
                        </h3>
                        {selectedFolder.id === activeFolderId ? (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                            Active Speaker
                          </span>
                        ) : (
                          <button
                            onClick={() => handleSetActiveSpeaker(selectedFolder.id)}
                            className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors"
                          >
                            Set as Active
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteFolder(selectedFolder.id)}
                          title="Delete this Person Folder"
                          className="ml-1 p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {selectedFolder.relationship} • Created {new Date(selectedFolder.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {/* Grammar / Gender Toggle Pill */}
                  <div className="flex flex-col items-start sm:items-end">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Iris Hindi Address Rule:
                    </span>
                    <div className="inline-flex rounded-xl bg-slate-200/80 dark:bg-slate-800 p-0.5 text-xs font-semibold">
                      <button
                        onClick={() => handleGrammarChange('masculine')}
                        className={`px-2.5 py-1 rounded-lg transition-all ${
                          selectedFolder.grammaticalStyle === 'masculine'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        Male (chahta hai)
                      </button>
                      <button
                        onClick={() => handleGrammarChange('feminine')}
                        className={`px-2.5 py-1 rounded-lg transition-all ${
                          selectedFolder.grammaticalStyle === 'feminine'
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        Female (chahti hai)
                      </button>
                      <button
                        onClick={() => handleGrammarChange('respectful')}
                        className={`px-2.5 py-1 rounded-lg transition-all ${
                          selectedFolder.grammaticalStyle === 'respectful'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        Aap (chahte hain)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Dynamic Voice Range Profile Card */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Dynamic Pitch Range</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {selectedFolder.voiceProfile.pitchRange ? `${selectedFolder.voiceProfile.pitchRange[0]}-${selectedFolder.voiceProfile.pitchRange[1]} Hz` : `${Math.round(selectedFolder.voiceProfile.estimatedPitchHz)} Hz`}
                    </span>
                    <span className="text-[9px] text-slate-500 dark:text-slate-400 block mt-0.5">
                      Inst: ~{selectedFolder.voiceProfile.instantaneousPitchHz || Math.round(selectedFolder.voiceProfile.estimatedPitchHz)} Hz
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Dynamic Timbre Range</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {selectedFolder.voiceProfile.timbreRange ? `${selectedFolder.voiceProfile.timbreRange[0]}-${selectedFolder.voiceProfile.timbreRange[1]} Hz` : `${selectedFolder.voiceProfile.spectralCentroid || 1200} Hz`}
                    </span>
                    <span className="text-[9px] text-slate-500 dark:text-slate-400 block mt-0.5 capitalize">
                      Inst: ~{selectedFolder.voiceProfile.instantaneousTimbreHz || selectedFolder.voiceProfile.spectralCentroid || 1200} Hz ({selectedFolder.voiceProfile.voiceTimbre.replace('_', ' ')})
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Range Match Confidence</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {Math.round(selectedFolder.voiceProfile.confidence * 100)}%
                    </span>
                    <span className="text-[9px] text-slate-500 dark:text-slate-400 block mt-0.5">
                      Samples: {selectedFolder.voiceProfile.sampleCount}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Learned Memories</span>
                    <span className="font-mono font-bold text-blue-600 dark:text-cyan-400">
                      {selectedFolder.memories.length} Entries
                    </span>
                    <span className="text-[9px] text-slate-500 dark:text-slate-400 block mt-0.5">
                      {selectedFolder.relationship || 'Friend'}
                    </span>
                  </div>
                </div>

                {/* Search & Add Memory Bar */}
                <div className="flex items-center justify-between gap-3 pt-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder={`Search ${selectedFolder.name}'s memories...`}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full px-3.5 py-2 pl-9 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                    <svg
                      className="w-4 h-4 absolute left-3 top-2.5 text-slate-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </div>

                  <button
                    onClick={() => {
                      triggerHaptic('light');
                      setIsAddingMemory(!isAddingMemory);
                    }}
                    className="px-3 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <span>{isAddingMemory ? 'Cancel' : '+ Add Memory'}</span>
                  </button>
                </div>

                {/* Add Memory Form Dropdown */}
                {isAddingMemory && (
                  <form
                    onSubmit={handleAddMemory}
                    className="p-3.5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 space-y-2.5 animate-slide-down"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        placeholder="Memory Title (e.g. PDF 1 Location, WiFi Password)"
                        value={newMemKey}
                        onChange={(e) => setNewMemKey(e.target.value)}
                        required
                        className="sm:col-span-2 px-3 py-1.5 rounded-lg text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                      <select
                        value={newMemCategory}
                        onChange={(e) => setNewMemCategory(e.target.value as any)}
                        className="px-3 py-1.5 rounded-lg text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      >
                        <option value="file">File / Document</option>
                        <option value="personal">Personal Detail</option>
                        <option value="preference">Preference</option>
                        <option value="work">Work / Task</option>
                        <option value="reminder">Reminder</option>
                        <option value="general">General Note</option>
                      </select>
                    </div>

                    <textarea
                      placeholder={`What should Iris remember for ${selectedFolder.name}? (e.g. Saved inside Downloads folder in Google Files)`}
                      value={newMemValue}
                      onChange={(e) => setNewMemValue(e.target.value)}
                      required
                      rows={2}
                      className="w-full px-3 py-1.5 rounded-lg text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    />

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsAddingMemory(false)}
                        className="px-3 py-1 text-xs rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1 text-xs font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                      >
                        Save Memory
                      </button>
                    </div>
                  </form>
                )}

                {/* Memories List */}
                <div className="space-y-2.5 flex-1">
                  {filteredMemories.length === 0 ? (
                    <div className="text-center py-8 px-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400">
                      <p className="text-xs">No memories found in {selectedFolder.name}'s folder.</p>
                      <p className="text-[11px] mt-1 text-slate-500">
                        Tell Iris to remember something like "PDF 1 is saved in Downloads" and it will automatically be stored here!
                      </p>
                    </div>
                  ) : (
                    filteredMemories.map((mem) => (
                      <div
                        key={mem.id}
                        className="p-3 rounded-2xl bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800 flex items-start justify-between gap-3 group hover:border-blue-300 dark:hover:border-blue-800 transition-all"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-cyan-300 uppercase">
                              {mem.category}
                            </span>
                            <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                              {mem.key}
                            </h4>
                          </div>
                          <p className="text-xs text-slate-700 dark:text-slate-300">
                            {mem.value}
                          </p>
                          {mem.sourceText && (
                            <p className="text-[10px] text-slate-400 italic">
                              Source: "{mem.sourceText}"
                            </p>
                          )}
                        </div>

                        <button
                          onClick={() => handleDeleteMemory(mem.id)}
                          className="text-slate-300 hover:text-rose-500 p-1 transition-colors opacity-0 group-hover:opacity-100"
                          title="Delete memory"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4 my-auto">
                <div className="w-16 h-16 rounded-3xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-cyan-400 flex items-center justify-center text-3xl shadow-inner">
                  🎙️
                </div>
                <div className="max-w-md space-y-1.5">
                  <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200">
                    Voice Recognition Starting from Scratch
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Iris has no pre-saved voices. Simply speak to Iris through your microphone — she will detect your voice tone, ask who is speaking, and calibrate your unique voice biometric profile to remember forever!
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddingFolder(true)}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  + Manually Register Voice Profile
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Create New Person Modal Dialog Overlay */}
        {isAddingFolder && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-60 animate-fade-in">
            <form
              onSubmit={handleCreateFolder}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4"
            >
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                📁 Create New Person Memory Folder
              </h3>
              <p className="text-xs text-slate-500">
                Iris will isolate memories for this person and adjust speech conjugations to match their gender accurately.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Person's Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Priya, Rahul, Ananya"
                  value={newPersonName}
                  onChange={(e) => setNewPersonName(e.target.value)}
                  required
                  autoFocus
                  className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Gender
                  </label>
                  <select
                    value={newPersonGender}
                    onChange={(e) => {
                      const g = e.target.value as any;
                      setNewPersonGender(g);
                      setNewPersonGrammar(g === 'female' ? 'feminine' : 'masculine');
                    }}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="male">Male (♂)</option>
                    <option value="female">Female (♀)</option>
                    <option value="non-binary">Non-Binary</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Hindi Grammar Rule
                  </label>
                  <select
                    value={newPersonGrammar}
                    onChange={(e) => setNewPersonGrammar(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="masculine">chahta hai / karega</option>
                    <option value="feminine">chahti hai / karegi</option>
                    <option value="respectful">chahte hain / karenge</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Relationship / Role
                </label>
                <input
                  type="text"
                  placeholder="e.g. Best Friend, Sister, Colleague"
                  value={newPersonRelationship}
                  onChange={(e) => setNewPersonRelationship(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddingFolder(false)}
                  className="px-4 py-2 text-xs rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-md"
                >
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        )}

      </div>
    </div>
  );
};
