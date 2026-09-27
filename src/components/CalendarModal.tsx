import React, { useState } from 'react';
import {
  Calendar as CalendarIcon,
  X,
  Plus,
  Clock,
  MapPin,
  Users,
  ExternalLink,
  Trash2,
  CalendarCheck,
  Download,
} from 'lucide-react';
import { CalendarEvent, DeviceActionBridge } from '../services/deviceActionBridge.ts';

interface CalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  bridge: DeviceActionBridge;
  onScheduleMeeting?: (event: CalendarEvent) => void;
}

export const CalendarModal: React.FC<CalendarModalProps> = ({
  isOpen,
  onClose,
  bridge,
}) => {
  const [events, setEvents] = useState<CalendarEvent[]>(() => bridge.getCalendarEvents());
  const [isAdding, setIsAdding] = useState(false);
  const [filter, setFilter] = useState<'all' | 'today' | 'upcoming'>('all');

  // Form state
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('14:00');
  const [endTime, setEndTime] = useState('15:00');
  const [location, setLocation] = useState('Google Meet');
  const [attendees, setAttendees] = useState('Devansh Namdev (Dev)');
  const [description, setDescription] = useState('');

  if (!isOpen) return null;

  const refreshEvents = () => {
    setEvents([...bridge.getCalendarEvents()]);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    bridge.scheduleMeeting(
      title.trim(),
      date,
      startTime,
      endTime,
      description.trim(),
      location.trim(),
      attendees.trim()
    );

    refreshEvents();
    setIsAdding(false);
    setTitle('');
    setDescription('');
  };

  const handleDelete = (id: string) => {
    bridge.deleteCalendarEvent(id);
    refreshEvents();
  };

  const handleDownloadIcs = (evt: CalendarEvent) => {
    const startDateClean = evt.date.replace(/-/g, '');
    const startTimeClean = evt.startTime.replace(/:/g, '') + '00';
    const endTimeClean = (evt.endTime || evt.startTime).replace(/:/g, '') + '00';

    const icsData = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Iris Virtual Assistant//EN',
      'BEGIN:VEVENT',
      `UID:${evt.id}@iris.assistant`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
      `DTSTART:${startDateClean}T${startTimeClean}`,
      `DTEND:${startDateClean}T${endTimeClean}`,
      `SUMMARY:${evt.title}`,
      `DESCRIPTION:${evt.description || ''}`,
      `LOCATION:${evt.location || ''}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${evt.title.replace(/\s+/g, '_')}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const filteredEvents = events.filter((e) => {
    if (filter === 'today') return e.date === todayStr;
    if (filter === 'upcoming') return e.date >= todayStr;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-cyan-500/30 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                Calendar & Meeting Schedule
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono">
                  {events.length} Events
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Managed by Iris with time zone awareness and Google Calendar sync
              </p>
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
              {isAdding ? 'Cancel' : 'New Meeting'}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Add Meeting Form */}
        {isAdding && (
          <form onSubmit={handleCreate} className="p-5 bg-slate-950/60 border-b border-slate-800 space-y-3 animate-fadeIn">
            <div className="text-xs font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <CalendarCheck className="w-3.5 h-3.5" />
              Schedule New Meeting
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-400 font-medium block mb-1">Meeting Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Architecture Sync with Dev"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 font-medium block mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 font-medium block mb-1">Start Time</label>
                <input
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 font-medium block mb-1">End Time</label>
                <input
                  type="time"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 font-medium block mb-1">Location / Link</label>
                <input
                  type="text"
                  placeholder="Google Meet, Zoom, Office"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 font-medium block mb-1">Attendees</label>
                <input
                  type="text"
                  placeholder="Devansh Namdev, Rahul Kumar"
                  value={attendees}
                  onChange={(e) => setAttendees(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] text-slate-400 font-medium block mb-1">Description / Agenda</label>
              <textarea
                rows={2}
                placeholder="Meeting discussion points and agenda notes"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
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
                Save & Add to Calendar
              </button>
            </div>
          </form>
        )}

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-slate-800/80 bg-slate-900/40 text-xs">
          <span className="text-slate-500">Filter:</span>
          {(['all', 'today', 'upcoming'] as const).map((tab) => (
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

        {/* Events List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {filteredEvents.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <CalendarIcon className="w-10 h-10 mx-auto mb-2 text-slate-600" />
              <p className="text-sm font-medium">No meetings scheduled for this filter.</p>
              <p className="text-xs mt-1">
                Say <span className="text-cyan-400 font-mono">"Schedule meeting tomorrow at 3pm"</span> to Iris!
              </p>
            </div>
          ) : (
            filteredEvents.map((evt) => {
              const isToday = evt.date === todayStr;
              return (
                <div
                  key={evt.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isToday
                      ? 'bg-gradient-to-r from-cyan-950/40 to-slate-900/90 border-cyan-500/40 shadow-lg shadow-cyan-950/50'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-white">{evt.title}</h3>
                        {isToday && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                            Today
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-slate-400">
                        <span className="flex items-center gap-1.5 text-cyan-300 font-medium">
                          <Clock className="w-3.5 h-3.5" />
                          {evt.date} • {evt.startTime} {evt.endTime ? `- ${evt.endTime}` : ''}
                        </span>
                        {evt.location && (
                          <span className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-slate-500" />
                            {evt.location}
                          </span>
                        )}
                        {evt.attendees && evt.attendees.length > 0 && (
                          <span className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-slate-500" />
                            {evt.attendees.join(', ')}
                          </span>
                        )}
                      </div>

                      {evt.description && (
                        <p className="mt-2 text-xs text-slate-300 bg-slate-950/40 p-2 rounded-lg border border-slate-800/60">
                          {evt.description}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      {evt.googleCalendarUrl && (
                        <a
                          href={evt.googleCalendarUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open in Google Calendar"
                          className="p-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      <button
                        onClick={() => handleDownloadIcs(evt)}
                        title="Download .ICS Event File"
                        className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(evt.id)}
                        title="Cancel Meeting"
                        className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
