import React, { useState, useEffect } from 'react';
import {
  Bell,
  X,
  Plus,
  Clock,
  CheckCircle2,
  Circle,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { DeviceReminder, DeviceActionBridge } from '../services/deviceActionBridge.ts';

interface RemindersModalProps {
  isOpen: boolean;
  onClose: () => void;
  bridge: DeviceActionBridge;
}

export const RemindersModal: React.FC<RemindersModalProps> = ({
  isOpen,
  onClose,
  bridge,
}) => {
  const [reminders, setReminders] = useState<DeviceReminder[]>(() => bridge.getReminders());
  const [isAdding, setIsAdding] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('pending');

  // Form state
  const [title, setTitle] = useState('');
  const [datetime, setDatetime] = useState('In 30 minutes');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [notes, setNotes] = useState('');

  const refreshReminders = () => {
    setReminders([...bridge.getReminders()]);
  };

  useEffect(() => {
    if (isOpen) {
      refreshReminders();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    bridge.setReminder(title.trim(), datetime.trim(), notes.trim() || undefined, priority);
    refreshReminders();
    setIsAdding(false);
    setTitle('');
    setNotes('');
  };

  const handleToggle = (id: string, currentStatus: boolean) => {
    if (!currentStatus) {
      bridge.completeReminder(id);
    } else {
      const target = bridge.getReminders().find((r) => r.id === id);
      if (target) {
        target.completed = false;
        refreshReminders();
      }
    }
    refreshReminders();
  };

  const handleDelete = (id: string) => {
    bridge.deleteReminder(id);
    refreshReminders();
  };

  const filteredReminders = reminders.filter((r) => {
    if (filter === 'pending') return !r.completed;
    if (filter === 'completed') return r.completed;
    return true;
  });

  const getPriorityBadge = (p: 'low' | 'medium' | 'high') => {
    switch (p) {
      case 'high':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">HIGH</span>;
      case 'medium':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">MEDIUM</span>;
      case 'low':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">LOW</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-cyan-500/30 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                Smart Reminders
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono">
                  {reminders.filter((r) => !r.completed).length} Pending
                </span>
              </h2>
              <p className="text-xs text-slate-400">Set and triggered dynamically by Iris with audio alerts</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAdding(!isAdding)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                isAdding
                  ? 'bg-slate-800 text-slate-300'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20 hover:opacity-90'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              {isAdding ? 'Cancel' : 'Add Reminder'}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Add Reminder Form */}
        {isAdding && (
          <form onSubmit={handleCreate} className="p-5 bg-slate-950/60 border-b border-slate-800 space-y-3 animate-fadeIn">
            <div>
              <label className="text-[11px] text-slate-400 font-medium block mb-1">What to remind you about?</label>
              <input
                type="text"
                required
                placeholder="e.g. Call Rahul about project deliverables"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-400 font-medium block mb-1">When (Time / Relative)</label>
                <input
                  type="text"
                  required
                  placeholder="In 20 minutes, 5:00 PM, Tomorrow 9am"
                  value={datetime}
                  onChange={(e) => setDatetime(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 font-medium block mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-[11px] text-slate-400 font-medium block mb-1">Additional Notes (Optional)</label>
              <input
                type="text"
                placeholder="Extra details or context"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg text-xs font-semibold text-white shadow-lg shadow-cyan-500/20 hover:opacity-90"
              >
                Set Reminder
              </button>
            </div>
          </form>
        )}

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-slate-800/80 bg-slate-900/40 text-xs">
          <span className="text-slate-500">Status:</span>
          {(['pending', 'completed', 'all'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1 rounded-full capitalize font-medium transition-all ${
                filter === tab
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Reminders List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-2.5">
          {filteredReminders.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Bell className="w-10 h-10 mx-auto mb-2 text-slate-600" />
              <p className="text-sm font-medium">No reminders found in this category.</p>
              <p className="text-xs mt-1">
                Say <span className="text-cyan-400 font-mono">"Remind me in 15 mins to drink water"</span> to Iris!
              </p>
            </div>
          ) : (
            filteredReminders.map((rem) => (
              <div
                key={rem.id}
                className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                  rem.completed
                    ? 'bg-slate-950/40 border-slate-800/50 opacity-60'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <button
                    onClick={() => handleToggle(rem.id, rem.completed)}
                    className="text-slate-400 hover:text-cyan-400 transition-colors shrink-0"
                  >
                    {rem.completed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <Circle className="w-5 h-5" />
                    )}
                  </button>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-medium truncate ${rem.completed ? 'line-through text-slate-400' : 'text-white'}`}>
                        {rem.title}
                      </p>
                      {getPriorityBadge(rem.priority)}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                      <span className="flex items-center gap-1 text-cyan-400 font-medium">
                        <Clock className="w-3 h-3" />
                        {rem.datetime}
                      </span>
                      {rem.notes && <span className="truncate text-slate-500">• {rem.notes}</span>}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleDelete(rem.id)}
                  title="Delete Reminder"
                  className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
