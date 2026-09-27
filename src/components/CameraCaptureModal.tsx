import React, { useState, useEffect, useRef } from 'react';
import { Camera, RefreshCw, X, Sparkles, Check, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { triggerHaptic } from '../utils/haptics.ts';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapturePhoto: (dataUrl: string, fileName: string) => void;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onCapturePhoto,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const startCamera = async () => {
    stopCamera();
    setErrorMsg(null);
    setHasPermission(null);

    if (typeof window === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setHasPermission(false);
      setErrorMsg('Camera API is not available in this browser context.');
      return;
    }

    const constraintOptions: MediaStreamConstraints[] = [
      { video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
      { video: { facingMode: facingMode }, audio: false },
      { video: { width: { max: 1280 } }, audio: false },
      { video: true, audio: false }
    ];

    let stream: MediaStream | null = null;
    let lastError: any = null;

    for (const constraints of constraintOptions) {
      try {
        console.log('📷 [CameraCaptureModal] Attempting getUserMedia constraints:', constraints);
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (stream) {
          console.log('✅ [CameraCaptureModal] Camera stream acquired successfully!');
          break;
        }
      } catch (err: any) {
        console.warn('⚠️ [CameraCaptureModal] Constraint failed:', err?.name || err?.message);
        lastError = err;
      }
    }

    if (stream) {
      streamRef.current = stream;
      setHasPermission(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn('Video play warning:', playErr);
        }
      }
    } else {
      console.error('❌ [CameraCaptureModal] All camera constraint attempts failed:', lastError);
      setHasPermission(false);
      const errName = lastError?.name || '';
      const errText = lastError?.message || '';

      if (errName === 'NotAllowedError' || errText.toLowerCase().includes('permission')) {
        setErrorMsg('Camera permission was blocked by browser. Click the lock/camera icon in your address bar to allow camera access.');
      } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
        setErrorMsg('Camera is currently in use by another application or browser tab.');
      } else {
        setErrorMsg(`Camera error (${errName || 'Unavailable'}): ${errText || 'Unable to open camera stream'}.`);
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const toggleCameraFacing = () => {
    triggerHaptic('light');
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const handleSnapPhoto = () => {
    if (!videoRef.current || isCapturing) return;

    try {
      setIsCapturing(true);
      triggerHaptic('heavy');
      setIsFlashing(true);

      const video = videoRef.current;
      const w = video.videoWidth || 1280;
      const h = video.videoHeight || 720;

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not create 2D rendering context for snapshot.');

      // If front facing camera, mirror image for natural snapshot
      if (facingMode === 'user') {
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(video, 0, 0, w, h);

      // Flash feedback duration
      setTimeout(() => {
        setIsFlashing(false);
      }, 150);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      const fileName = `iris_snap_${Date.now()}.jpg`;

      // Delay slightly for smooth shutter animation, then pass photo
      setTimeout(() => {
        stopCamera();
        setIsCapturing(false);
        onClose();
        onCapturePhoto(dataUrl, fileName);
      }, 250);
    } catch (err: any) {
      console.error('Snapshot capture error:', err);
      setIsCapturing(false);
      setIsFlashing(false);
    }
  };

  const handleFileUploadFallback = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        onClose();
        onCapturePhoto(result, file.name);
      };
      reader.readAsDataURL(file);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 shadow-[0_25px_60px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col text-white">
        {/* Shutter Flash Animation Overlay */}
        {isFlashing && (
          <div className="absolute inset-0 bg-white z-50 pointer-events-none animate-fadeOut" />
        )}

        {/* Top Header Bar */}
        <div className="px-5 py-3.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-wide">Iris Camera Viewfinder</h3>
              <p className="text-[10px] text-slate-400 font-mono">Real-time Vision Snapshot</p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Viewfinder Stream / Error Fallback */}
        <div className="relative w-full aspect-4/3 bg-black flex items-center justify-center overflow-hidden">
          {hasPermission === false ? (
            <div className="p-6 text-center space-y-3 max-w-sm">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-200">Camera Access Blocked or Unavailable</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                {errorMsg || 'Please allow camera permission in browser settings, or select a photo from your gallery below.'}
              </p>
              <div className="pt-2 flex flex-col gap-2 w-full max-w-xs mx-auto">
                <button
                  onClick={() => nativeCameraInputRef.current?.click()}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-xs font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-all"
                >
                  <Camera className="w-4 h-4" />
                  Take Photo with Device Camera
                </button>
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={startCamera}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 border border-slate-700 flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Retry Viewfinder
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 border border-slate-700 flex items-center gap-1.5"
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
                    Gallery
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Live Video Feed */}
              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                className={`w-full h-full object-cover ${facingMode === 'user' ? '-scale-x-100' : ''}`}
              />

              {/* Viewfinder Camera Reticle Crosshair overlay */}
              <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between">
                <div className="flex justify-between">
                  <div className="w-6 h-6 border-t-2 border-l-2 border-cyan-400/80 rounded-tl-lg" />
                  <div className="w-6 h-6 border-t-2 border-r-2 border-cyan-400/80 rounded-tr-lg" />
                </div>
                <div className="flex justify-between">
                  <div className="w-6 h-6 border-b-2 border-l-2 border-cyan-400/80 rounded-bl-lg" />
                  <div className="w-6 h-6 border-b-2 border-r-2 border-cyan-400/80 rounded-br-lg" />
                </div>
              </div>

              {/* Live Status Badge */}
              <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-slate-900/80 border border-slate-700/80 text-[10px] font-mono font-bold text-cyan-300 flex items-center gap-1.5 backdrop-blur-md">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>CAMERA LIVE • {facingMode.toUpperCase()}</span>
              </div>
            </>
          )}
        </div>

        {/* Hidden File Input Fallbacks */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileUploadFallback}
        />
        <input
          ref={nativeCameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileUploadFallback}
        />

        {/* Bottom Shutter Controls Bar */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-all text-xs font-medium flex items-center gap-2"
            title="Upload photo from device gallery"
          >
            <ImageIcon className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline">Gallery</span>
          </button>

          {/* Big Circular Camera Shutter Button */}
          <button
            onClick={handleSnapPhoto}
            disabled={hasPermission === false || isCapturing}
            className="relative group p-1 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 hover:from-blue-400 hover:to-cyan-300 shadow-[0_0_25px_rgba(59,130,246,0.6)] disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
            title="Snap photo & send directly to Iris"
          >
            <div className="w-14 h-14 rounded-full bg-slate-900 flex items-center justify-center border-2 border-white/90">
              <div className="w-10 h-10 rounded-full bg-white group-hover:bg-cyan-200 transition-colors flex items-center justify-center shadow-inner">
                <Sparkles className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </button>

          {/* Flip Front/Rear Camera Button */}
          <button
            onClick={toggleCameraFacing}
            disabled={hasPermission === false}
            className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-all text-xs font-medium flex items-center gap-2 disabled:opacity-50"
            title="Switch front/back camera"
          >
            <RefreshCw className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline">Flip</span>
          </button>
        </div>
      </div>
    </div>
  );
};
