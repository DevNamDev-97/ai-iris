import React, { useState } from 'react';
import { Volume2, CheckCircle2, AlertTriangle } from 'lucide-react';

interface SpeakerDiagnosticProps {
  onRunTest: () => Promise<{ success: boolean; message: string }>;
}

export const SpeakerDiagnostic: React.FC<SpeakerDiagnosticProps> = ({ onRunTest }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTest = async () => {
    setIsRunning(true);
    setResult(null);
    try {
      const res = await onRunTest();
      setResult(res);
    } catch (e: any) {
      setResult({
        success: false,
        message: `Speaker test failed: ${e?.message || e}`,
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="bg-slate-900/70 border border-cyan-500/30 rounded-xl p-3 sm:p-4 backdrop-blur-md text-xs sm:text-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-cyan-300 font-medium">
          <Volume2 className="w-4 h-4 text-cyan-400" />
          <span>Speaker Output Diagnostic</span>
        </div>
        <button
          onClick={handleTest}
          disabled={isRunning}
          className="px-3 py-1.5 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-400/50 text-cyan-200 font-medium transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
        >
          {isRunning ? (
            <>
              <span className="w-3 h-3 rounded-full border-2 border-cyan-300 border-t-transparent animate-spin" />
              <span>Playing...</span>
            </>
          ) : (
            <span>Test Speaker (440Hz)</span>
          )}
        </button>
      </div>

      {result && (
        <div
          className={`mt-2.5 p-2 rounded-lg border flex items-start gap-2 ${
            result.success
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
          }`}
        >
          {result.success ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          )}
          <span className="text-xs leading-relaxed">{result.message}</span>
        </div>
      )}
    </div>
  );
};
