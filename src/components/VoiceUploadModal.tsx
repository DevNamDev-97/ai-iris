import React, { useState, useRef } from 'react';
import {
  Upload,
  X,
  Image as ImageIcon,
  Video as VideoIcon,
  FileCode,
  Sparkles,
  Send,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { AttachedFile } from './ChatPanel.tsx';

interface VoiceUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileType: 'image' | 'video' | 'document' | 'any';
  irisMessage?: string;
  onSendToVoice: (file: { name: string; mimeType: string; data: string; type: 'image' | 'video' | 'document'; previewUrl?: string }) => void;
  onOpenInChat?: () => void;
}

export const VoiceUploadModal: React.FC<VoiceUploadModalProps> = ({
  isOpen,
  onClose,
  fileType,
  irisMessage,
  onSendToVoice,
  onOpenInChat,
}) => {
  const [selectedFile, setSelectedFile] = useState<AttachedFile | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const getAcceptType = () => {
    switch (fileType) {
      case 'image':
        return 'image/*';
      case 'video':
        return 'video/*';
      case 'document':
        return '.txt,.py,.js,.ts,.tsx,.jsx,.json,.csv,.pdf,.md,.html,.css,.sql';
      default:
        return 'image/*,video/*,.txt,.py,.js,.ts,.tsx,.jsx,.json,.csv,.pdf,.md,.html,.css,.sql';
    }
  };

  const getTitle = () => {
    switch (fileType) {
      case 'image':
        return 'Show Photo to Iris';
      case 'video':
        return 'Share Video with Iris';
      case 'document':
        return 'Upload File / Code for Iris';
      default:
        return 'Show File or Photo to Iris';
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setIsProcessing(true);

    try {
      const reader = new FileReader();
      const mimeType = file.type || 'application/octet-stream';
      let type: 'image' | 'video' | 'document' = 'document';

      if (mimeType.startsWith('image/')) type = 'image';
      else if (mimeType.startsWith('video/')) type = 'video';

      reader.onload = () => {
        const result = reader.result as string;
        const base64Data = result.includes(';base64,') ? result.split(';base64,')[1] : result;
        const previewUrl = type === 'image' || type === 'video' ? URL.createObjectURL(file) : undefined;

        setSelectedFile({
          id: Date.now().toString(),
          name: file.name,
          mimeType,
          size: file.size,
          data: base64Data,
          previewUrl,
          type,
        });
        setIsProcessing(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('File read error:', err);
      setIsProcessing(false);
    }
  };

  const handleSend = () => {
    if (!selectedFile) return;
    setIsSent(true);
    onSendToVoice({
      name: selectedFile.name,
      mimeType: selectedFile.mimeType,
      data: selectedFile.data,
      type: selectedFile.type,
      previewUrl: selectedFile.previewUrl,
    });

    setTimeout(() => {
      onClose();
      setSelectedFile(null);
      setIsSent(false);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-motion-blur-in">
      <div className="w-full max-w-lg bg-slate-900 border border-cyan-500/40 rounded-2xl shadow-2xl p-5 relative overflow-hidden flex flex-col space-y-4 motion-blur-glass">
        {/* Glow ambient accent */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">{getTitle()}</h3>
              <p className="text-xs text-cyan-300 font-medium">
                {irisMessage || 'Iris: "Haan bilkul, upload kar na! Main dekh rahi hoon!"'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept={getAcceptType()}
          className="hidden"
        />

        {/* Main Drop / Upload Area */}
        {!selectedFile ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-cyan-500/30 hover:border-cyan-400/60 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer bg-slate-950/50 hover:bg-cyan-950/20 transition-all text-center space-y-3 group"
          >
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 group-hover:bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center transition-colors">
              {fileType === 'image' && <ImageIcon className="w-7 h-7 text-cyan-400" />}
              {fileType === 'video' && <VideoIcon className="w-7 h-7 text-emerald-400" />}
              {fileType === 'document' && <FileCode className="w-7 h-7 text-blue-400" />}
              {fileType === 'any' && <Upload className="w-7 h-7 text-cyan-400" />}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200">
                Click to browse or drop {fileType === 'image' ? 'photo / screenshot' : fileType === 'video' ? 'video clip' : 'file / code'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Supports JPEG, PNG, MP4, WebM, PDF, Python, JS, TS, JSON, CSV
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-slate-950 border border-cyan-500/30 p-3 space-y-3">
            {/* Live Preview */}
            {selectedFile.type === 'image' && selectedFile.previewUrl && (
              <div className="rounded-lg overflow-hidden max-h-56 bg-black/60 flex items-center justify-center">
                <img
                  src={selectedFile.previewUrl}
                  alt={selectedFile.name}
                  className="max-h-56 w-auto object-contain rounded-lg"
                />
              </div>
            )}
            {selectedFile.type === 'video' && selectedFile.previewUrl && (
              <div className="rounded-lg overflow-hidden max-h-56 bg-black/60">
                <video
                  src={selectedFile.previewUrl}
                  controls
                  className="w-full max-h-56 rounded-lg"
                />
              </div>
            )}

            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2 truncate">
                {selectedFile.type === 'image' && <ImageIcon className="w-4 h-4 text-cyan-400 shrink-0" />}
                {selectedFile.type === 'video' && <VideoIcon className="w-4 h-4 text-emerald-400 shrink-0" />}
                {selectedFile.type === 'document' && <FileCode className="w-4 h-4 text-blue-400 shrink-0" />}
                <span className="text-xs font-medium text-slate-200 truncate">{selectedFile.name}</span>
                <span className="text-[11px] text-slate-400">
                  ({(selectedFile.size / 1024).toFixed(1)} KB)
                </span>
              </div>
              <button
                onClick={() => setSelectedFile(null)}
                className="text-xs text-rose-400 hover:text-rose-300 px-2 py-0.5 rounded hover:bg-rose-950/40"
              >
                Change
              </button>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-3 pt-2">
          {onOpenInChat && (
            <button
              onClick={() => {
                onClose();
                onOpenInChat();
              }}
              className="text-xs text-cyan-300/80 hover:text-cyan-200 underline"
            >
              Open in Text Chat instead
            </button>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
            >
              Cancel
            </button>

            <button
              onClick={handleSend}
              disabled={!selectedFile || isProcessing || isSent}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/20 transition-all active:scale-95"
            >
              {isSent ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-slate-950" />
                  <span>Sent to Iris!</span>
                </>
              ) : isProcessing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Send to Iris Voice</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
