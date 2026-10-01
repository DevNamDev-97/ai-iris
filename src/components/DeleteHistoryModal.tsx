import React, { useState } from 'react';
import { ShieldAlert, KeyRound, X, Trash2, CheckCircle2 } from 'lucide-react';
import { crossSessionMemory } from '../services/crossSessionMemory.ts';

interface DeleteHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  personName: string;
  theme?: 'light' | 'dark';
  onSuccess?: (message: string) => void;
}

export const DeleteHistoryModal: React.FC<DeleteHistoryModalProps> = ({
  isOpen,
  onClose,
  personName = 'All',
  theme = 'dark',
  onSuccess,
}) => {
  const isDark = theme === 'dark';
  const [passwordInput, setPasswordInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = passwordInput.trim();
    if (trimmed === '9131123126') {
      setErrorMsg('');
      const removedCount = crossSessionMemory.deleteInteractionsForPerson(personName);
      setIsSuccess(true);
      const successText = `Chat history for "${personName}" has been permanently deleted (${removedCount} turns cleared).`;
      if (onSuccess) onSuccess(successText);

      setTimeout(() => {
        setIsSuccess(false);
        setPasswordInput('');
        onClose();
      }, 1500);
    } else {
      setErrorMsg('Incorrect deletion password. Access denied.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-md animate-motion-blur-in">
      <div
        className={`w-full max-w-md p-6 rounded-3xl border flex flex-col shadow-2xl relative transition-all ${
          isDark
            ? 'bg-slate-900/95 border-rose-500/40 text-white shadow-rose-500/10'
            : 'bg-white border-rose-200 text-slate-900 shadow-rose-500/10'
        }`}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-2xl hover:bg-slate-500/10 transition-colors"
        >
          <X className="w-5 h-5 text-slate-400" />
        </button>

        <div className="flex items-center gap-3 mb-3">
          <div className="p-3 rounded-2xl bg-rose-500/20 text-rose-500 border border-rose-500/30">
            <Trash2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-mono tracking-wider font-bold uppercase text-rose-500">
              Security Verification
            </h3>
            <p className="text-xs font-semibold text-slate-400">
              Delete Chat History for: <span className="text-rose-400 font-bold">{personName}</span>
            </p>
          </div>
        </div>

        {isSuccess ? (
          <div className="py-6 text-center space-y-2">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto animate-bounce" />
            <p className="text-sm font-bold text-emerald-400">Deletion Authorized!</p>
            <p className="text-xs text-slate-400">Chat history cleared successfully.</p>
          </div>
        ) : (
          <>
            <p className="text-xs sm:text-sm font-medium mb-4 leading-relaxed text-slate-300">
              To confirm delete history, write the deletion password.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                  placeholder="Enter deletion password..."
                  autoFocus
                  className={`w-full pl-10 pr-4 py-3 rounded-2xl text-xs sm:text-sm border font-mono focus:outline-none focus:ring-2 ${
                    isDark
                      ? 'bg-slate-950 border-slate-700 text-white focus:ring-rose-500/40'
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:ring-rose-500/40'
                  }`}
                />
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold animate-pulse">
                  {errorMsg}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 rounded-2xl text-xs font-bold border border-slate-700 hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-2xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 transition-all spring-button"
                >
                  Confirm Delete
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
