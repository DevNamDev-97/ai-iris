import React, { useState } from 'react';
import { Contact, DEFAULT_DEVICE_CONTACTS } from '../services/deviceActionBridge.ts';
import { Users, Phone, X, Plus } from 'lucide-react';

interface DeviceContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: Contact[];
  onAddContact: (contact: Contact) => void;
}

export const DeviceContactsModal: React.FC<DeviceContactsModalProps> = ({
  isOpen,
  onClose,
  contacts,
  onAddContact,
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relation, setRelation] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  if (!isOpen) return null;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;

    onAddContact({
      id: Date.now().toString(),
      name: name.trim(),
      phone: phone.trim(),
      relation: relation.trim() || undefined,
    });

    setName('');
    setPhone('');
    setRelation('');
    setShowAddForm(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-slate-900 border border-cyan-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-cyan-500/20 flex items-center justify-between bg-slate-800/40">
          <div className="flex items-center gap-2 text-cyan-300 font-semibold">
            <Users className="w-5 h-5 text-cyan-400" />
            <span>Device Contacts Catalog</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="p-5 overflow-y-auto space-y-2.5 flex-1">
          <p className="text-xs text-slate-400 mb-3">
            Iris searches these contacts when you say <span className="text-cyan-300 font-mono">"Mom ko call karo"</span> or <span className="text-cyan-300 font-mono">"Rahul ko call karo"</span>. If multiple matches exist (like Rahul), Iris will ask for clarification.
          </p>

          {contacts.map((c) => (
            <div
              key={c.id}
              className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/60 flex items-center justify-between"
            >
              <div>
                <div className="font-semibold text-slate-200 text-sm flex items-center gap-2">
                  <span>{c.name}</span>
                  {c.relation && (
                    <span className="text-[10px] uppercase font-bold text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-500/30">
                      {c.relation}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">{c.phone}</div>
              </div>
              <a
                href={`tel:${c.phone}`}
                className="p-2 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-300 border border-cyan-400/30 transition-all"
                title="Dial"
              >
                <Phone className="w-4 h-4" />
              </a>
            </div>
          ))}

          {showAddForm ? (
            <form onSubmit={handleAdd} className="mt-4 p-3.5 rounded-xl bg-slate-800/90 border border-cyan-500/40 space-y-2.5">
              <h4 className="text-xs font-semibold text-cyan-300">Add New Contact</h4>
              <input
                type="text"
                placeholder="Full Name (e.g. Anjali)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-400"
              />
              <input
                type="tel"
                placeholder="Phone Number (e.g. +919876543210)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-400"
              />
              <input
                type="text"
                placeholder="Relationship / Tag (optional)"
                value={relation}
                onChange={(e) => setRelation(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-400"
              />
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg text-xs bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold"
                >
                  Save Contact
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full mt-2 py-2 rounded-xl border border-dashed border-cyan-500/40 hover:border-cyan-400 text-cyan-300 text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
            >
              <Plus className="w-4 h-4" /> Add Test Contact
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
