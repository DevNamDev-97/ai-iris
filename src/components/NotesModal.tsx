import React, { useState, useEffect } from 'react';
import {
  FileText,
  X,
  Plus,
  Search,
  Copy,
  Check,
  Trash2,
  Tag,
  Edit3,
  Download,
} from 'lucide-react';
import { DeviceNote, DeviceActionBridge } from '../services/deviceActionBridge.ts';

interface NotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  bridge: DeviceActionBridge;
}

export const NotesModal: React.FC<NotesModalProps> = ({
  isOpen,
  onClose,
  bridge,
}) => {
  const [notes, setNotes] = useState<DeviceNote[]>(() => bridge.getNotes());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isCreating, setIsCreating] = useState(false);
  const [activeNote, setActiveNote] = useState<DeviceNote | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<'work' | 'personal' | 'ideas' | 'general'>('general');
  const [tags, setTags] = useState('');

  const refreshNotes = () => {
    setNotes([...bridge.getNotes()]);
  };

  useEffect(() => {
    if (isOpen) refreshNotes();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    bridge.createNote(title.trim(), content.trim(), category, tags.trim());
    refreshNotes();
    setIsCreating(false);
    setTitle('');
    setContent('');
    setTags('');
  };

  const handleDelete = (id: string) => {
    bridge.deleteNote(id);
    refreshNotes();
    if (activeNote?.id === id) setActiveNote(null);
  };

  const handleCopy = (note: DeviceNote) => {
    navigator.clipboard.writeText(`${note.title}\n\n${note.content}`);
    setCopiedId(note.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownload = (note: DeviceNote) => {
    const blob = new Blob([`${note.title}\n\n${note.content}`], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${note.title.replace(/\s+/g, '_')}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const categories = ['all', 'work', 'personal', 'ideas', 'general'];

  const filteredNotes = notes.filter((n) => {
    const matchesCat = selectedCategory === 'all' || n.category.toLowerCase() === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery = !q || n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q) || n.tags.some((t) => t.toLowerCase().includes(q));
    return matchesCat && matchesQuery;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-motion-blur-in">
      <div className="bg-slate-900 border border-cyan-500/30 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[85vh] motion-blur-glass">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                Notes & Memos
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono">
                  {notes.length} Saved
                </span>
              </h2>
              <p className="text-xs text-slate-400">Voice dictation and smart memos managed by Iris</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setIsCreating(!isCreating);
                setActiveNote(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                isCreating
                  ? 'bg-slate-800 text-slate-300'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20 hover:opacity-90'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              {isCreating ? 'Cancel' : 'New Note'}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar: Search & Categories */}
        <div className="px-6 py-3 border-b border-slate-800 bg-slate-950/30 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 overflow-x-auto">
            <span className="text-slate-500">Category:</span>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full capitalize font-medium transition-all ${
                  selectedCategory === cat
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-60">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search notes or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* Body content */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Notes Grid / Master List */}
          <div className="w-full md:w-1/2 border-r border-slate-800 overflow-y-auto p-4 space-y-2.5">
            {isCreating ? (
              <form onSubmit={handleCreate} className="p-4 bg-slate-950/70 border border-cyan-500/40 rounded-xl space-y-3 animate-fadeIn">
                <div className="text-xs font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5" />
                  Create New Note
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 font-medium block mb-1">Title</label>
                  <input
                    type="text"
                    required
                    placeholder="Note title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-400 font-medium block mb-1">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as any)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                    >
                      <option value="general">General</option>
                      <option value="work">Work</option>
                      <option value="ideas">Ideas</option>
                      <option value="personal">Personal</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 font-medium block mb-1">Tags (comma separated)</label>
                    <input
                      type="text"
                      placeholder="ai, meeting, todo"
                      value={tags}
                      onChange={(e) => setTags(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 font-medium block mb-1">Content</label>
                  <textarea
                    rows={6}
                    required
                    placeholder="Write or dictate note content..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none font-mono"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg text-xs font-semibold text-white shadow-lg shadow-cyan-500/20 hover:opacity-90"
                  >
                    Save Note
                  </button>
                </div>
              </form>
            ) : null}

            {filteredNotes.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <FileText className="w-10 h-10 mx-auto mb-2 text-slate-600" />
                <p className="text-sm font-medium">No notes match your filter.</p>
                <p className="text-xs mt-1">
                  Say <span className="text-cyan-400 font-mono">"Note banao: meeting points"</span> to Iris!
                </p>
              </div>
            ) : (
              filteredNotes.map((note) => {
                const isSelected = activeNote?.id === note.id;
                return (
                  <div
                    key={note.id}
                    onClick={() => setActiveNote(note)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-cyan-950/40 border-cyan-500/50 shadow-md shadow-cyan-950/40'
                        : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-white truncate">{note.title}</h3>
                      <span className="text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider bg-slate-800 text-slate-300">
                        {note.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-2 mt-1 font-sans">{note.content}</p>
                    <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-800/60 text-[11px] text-slate-500">
                      <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                      {note.tags.length > 0 && (
                        <div className="flex items-center gap-1 overflow-hidden">
                          <Tag className="w-3 h-3 text-cyan-400" />
                          <span className="text-cyan-400/80 truncate">#{note.tags.join(' #')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Note Detail / Inspector */}
          <div className="w-full md:w-1/2 flex flex-col bg-slate-950/50 p-6 overflow-y-auto">
            {activeNote ? (
              <div className="flex-1 flex flex-col space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                      {activeNote.category}
                    </span>
                    <h2 className="text-lg font-bold text-white mt-1.5">{activeNote.title}</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Created: {new Date(activeNote.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleCopy(activeNote)}
                      title="Copy Note"
                      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center gap-1 text-xs"
                    >
                      {copiedId === activeNote.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400 text-[11px]">Copied</span>
                        </>
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDownload(activeNote)}
                      title="Download as text file"
                      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(activeNote.id)}
                      title="Delete Note"
                      className="p-2 rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {activeNote.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {activeNote.tags.map((tag) => (
                      <span key={tag} className="text-xs px-2 py-0.5 rounded-md bg-slate-800/80 text-cyan-300 font-mono">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex-1 bg-slate-900/80 border border-slate-800 rounded-xl p-4 text-xs text-slate-200 whitespace-pre-wrap font-sans leading-relaxed overflow-y-auto">
                  {activeNote.content}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-center">
                <FileText className="w-12 h-12 mb-3 text-slate-700" />
                <p className="text-sm font-medium">Select a note to inspect details</p>
                <p className="text-xs text-slate-600 mt-1">Or click "New Note" to create one</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
