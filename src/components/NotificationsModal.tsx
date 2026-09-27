import React, { useState, useEffect } from 'react';
import {
  Bell,
  X,
  MessageSquare,
  Mail,
  Instagram,
  Volume2,
  Send,
  CheckCheck,
  Smartphone,
  CheckCircle2,
} from 'lucide-react';
import { DeviceNotification, DeviceActionBridge } from '../services/deviceActionBridge.ts';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  bridge: DeviceActionBridge;
  onReadAloud?: (text: string) => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  bridge,
  onReadAloud,
}) => {
  const [notifications, setNotifications] = useState<DeviceNotification[]>(() => bridge.getNotifications());
  const [filterApp, setFilterApp] = useState<string>('all');
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const refreshNotifs = () => {
    setNotifications([...bridge.getNotifications()]);
  };

  useEffect(() => {
    if (isOpen) refreshNotifs();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleReply = (notifId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    bridge.replyNotification(notifId, replyText.trim());
    refreshNotifs();
    setReplyText('');
    setReplyingId(null);
  };

  const handleMarkAllRead = () => {
    notifications.forEach((n) => {
      n.read = true;
    });
    refreshNotifs();
  };

  const getAppIcon = (app: string) => {
    const a = app.toLowerCase();
    if (a.includes('whatsapp')) return <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"><MessageSquare className="w-4 h-4" /></div>;
    if (a.includes('gmail') || a.includes('mail')) return <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/30"><Mail className="w-4 h-4" /></div>;
    if (a.includes('instagram') || a.includes('insta')) return <div className="p-2 rounded-lg bg-pink-500/10 text-pink-400 border border-pink-500/30"><Instagram className="w-4 h-4" /></div>;
    if (a.includes('sms') || a.includes('message')) return <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"><Smartphone className="w-4 h-4" /></div>;
    return <div className="p-2 rounded-lg bg-slate-800 text-slate-300"><Bell className="w-4 h-4" /></div>;
  };

  const filteredNotifs = notifications.filter((n) => {
    if (filterApp === 'all') return true;
    return n.app.toLowerCase().includes(filterApp.toLowerCase());
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-cyan-500/30 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                Notification Center
                {unreadCount > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono font-bold">
                    {unreadCount} New
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">Read & reply to WhatsApp, Gmail, Instagram & SMS messages</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-cyan-400 hover:bg-slate-800 transition-colors flex items-center gap-1"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* App Filter Pills */}
        <div className="px-6 py-3 border-b border-slate-800 bg-slate-950/30 flex items-center gap-2 overflow-x-auto text-xs">
          {['all', 'whatsapp', 'gmail', 'instagram', 'messages'].map((app) => (
            <button
              key={app}
              onClick={() => setFilterApp(app)}
              className={`px-3 py-1 rounded-full capitalize font-medium transition-all ${
                filterApp === app
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {app === 'messages' ? 'SMS' : app}
            </button>
          ))}
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {filteredNotifs.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-slate-600" />
              <p className="text-sm font-medium">No notifications in this category.</p>
              <p className="text-xs mt-1">
                Say <span className="text-cyan-400 font-mono">"Read my notifications"</span> to Iris!
              </p>
            </div>
          ) : (
            filteredNotifs.map((notif) => {
              const isReplying = replyingId === notif.id;
              return (
                <div
                  key={notif.id}
                  className={`p-4 rounded-xl border transition-all ${
                    notif.read
                      ? 'bg-slate-900/60 border-slate-800/80'
                      : 'bg-gradient-to-r from-slate-900 via-cyan-950/20 to-slate-900 border-cyan-500/40 shadow-lg shadow-cyan-950/30'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {getAppIcon(notif.app)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-xs font-semibold text-white">{notif.sender}</span>
                          <span className="text-[11px] text-slate-400">via {notif.appName}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 shrink-0 font-mono">
                          {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <p className="text-xs text-slate-300 mt-1 font-sans leading-relaxed">{notif.message}</p>

                      {/* Previous replies thread */}
                      {notif.replies && notif.replies.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-slate-800 space-y-1.5">
                          {notif.replies.map((rep, idx) => (
                            <div key={idx} className="bg-slate-950/70 p-2 rounded-lg border border-slate-800 text-xs">
                              <span className="text-cyan-400 font-semibold">{rep.sender}: </span>
                              <span className="text-slate-300">{rep.message}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Action Bar */}
                      <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t border-slate-800/60">
                        <button
                          onClick={() => {
                            if (onReadAloud) {
                              onReadAloud(`Notification from ${notif.sender} on ${notif.appName}: ${notif.message}`);
                            }
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium flex items-center gap-1.5 transition-colors"
                        >
                          <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                          Read Aloud
                        </button>

                        {notif.replyable && (
                          <button
                            onClick={() => {
                              setReplyingId(isReplying ? null : notif.id);
                              setReplyText('');
                            }}
                            className={`px-3 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1.5 transition-all ${
                              isReplying
                                ? 'bg-slate-800 text-slate-300'
                                : 'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                            }`}
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            {isReplying ? 'Cancel' : 'Reply'}
                          </button>
                        )}
                      </div>

                      {/* Reply Box */}
                      {isReplying && (
                        <form
                          onSubmit={(e) => handleReply(notif.id, e)}
                          className="mt-3 flex items-center gap-2 animate-fadeIn"
                        >
                          <input
                            type="text"
                            autoFocus
                            placeholder={`Reply to ${notif.sender}...`}
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                          />
                          <button
                            type="submit"
                            className="p-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg text-white shadow-md shadow-cyan-500/20 hover:opacity-90"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        </form>
                      )}
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
