import React, { useState, useRef, useEffect } from 'react';
import {
  X, Sparkles, Upload, Download, Image, ArrowRight, Check, AlertCircle,
  Layers, Palette, Sun, Eye, ZoomIn, RefreshCw, RefreshCw as RotateCcw,
  UserPlus, UserMinus, Minimize2, Move, HelpCircle, Camera
} from 'lucide-react';
import { FuturisticScrollTrack } from './FuturisticScrollTrack.tsx';
import { DeviceActionBridge } from '../services/deviceActionBridge.ts';

interface ImageEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  bridge: DeviceActionBridge;
  initialInstruction?: string;
  initialAction?: string;
}

// Sample test templates so the user can play with image edits instantly
const TEMPLATE_IMAGES = [
  {
    id: 'cyber-cat',
    name: 'Ginger Cat',
    url: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=600&q=80',
    description: 'A cute orange ginger cat sitting calmly looking at the camera.',
  },
  {
    id: 'minimalist-desk',
    name: 'Creative Workspace',
    url: 'https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?auto=format&fit=crop&w=600&q=80',
    description: 'A clean desk with a laptop, a notebook, and a small green plant.',
  },
  {
    id: 'mountain-peak',
    name: 'Mountain Lake',
    url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=600&q=80',
    description: 'Serene mountain range reflected perfectly in a clear alpine lake.',
  }
];

const QUICK_INSTRUCTIONS = [
  { text: 'Add a high-tech glowing cyan cybernetic visor to the cat', icon: UserPlus, type: 'add' },
  { text: 'Replace background with a rain-slicked cyberpunk Tokyo street at night', icon: Layers, type: 'replace_background' },
  { text: 'Remove the plant and laptop, replace with a steaming cup of tea', icon: UserMinus, type: 'remove' },
  { text: 'Change the lighting to a dramatic golden hour sunset casting warm shadows', icon: Sun, type: 'recolor' },
];

export const ImageEditorModal: React.FC<ImageEditorModalProps> = ({
  isOpen,
  onClose,
  bridge,
  initialInstruction = '',
  initialAction = 'general',
}) => {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [editedImage, setEditedImage] = useState<string | null>(null);
  const [instruction, setInstruction] = useState(initialInstruction);
  const [selectedAction, setSelectedAction] = useState(initialAction);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStatusText, setCurrentStatusText] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Target coordinates for interactive localized edit
  const [targetCoords, setTargetCoords] = useState<{ x: number; y: number } | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Synthesized master prompt returned from the backend
  const [masterPrompt, setMasterPrompt] = useState<string>('');
  const [isSimulated, setIsSimulated] = useState(false);

  // Initialize with any currently uploaded image from the bridge
  useEffect(() => {
    if (isOpen) {
      const activeFile = bridge.getUploadedFile();
      if (activeFile && activeFile.mimeType?.startsWith('image/')) {
        // Find if we have a saved preview URL
        const previewUrl = (activeFile as any).previewUrl;
        if (previewUrl) {
          setOriginalImage(previewUrl);
        }
      }
      
      if (initialInstruction) {
        setInstruction(initialInstruction);
      }
      if (initialAction) {
        setSelectedAction(initialAction);
      }
    }
  }, [isOpen, bridge, initialInstruction, initialAction]);

  // Listen to tool event dispatches from chat
  useEffect(() => {
    const handleEditRequest = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        const { instruction: newInst, action: newAct } = customEvent.detail;
        if (newInst) {
          setInstruction(newInst);
          setSelectedAction(newAct || 'general');
          // If we already have an image, trigger edit automatically!
          if (originalImage) {
            triggerImageEdit(originalImage, newInst, newAct || 'general');
          }
        }
      }
    };

    window.addEventListener('iris-modify-image-request', handleEditRequest);
    return () => {
      window.removeEventListener('iris-modify-image-request', handleEditRequest);
    };
  }, [originalImage]);

  if (!isOpen) return null;

  // Handle template selection
  const handleSelectTemplate = async (templateUrl: string) => {
    setError(null);
    setIsLoading(true);
    setCurrentStatusText('Loading sample image template...');
    try {
      // Fetch and convert to base64 to allow safe editing on the backend
      const response = await fetch(templateUrl, { referrerPolicy: 'no-referrer' });
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        setOriginalImage(reader.result as string);
        setEditedImage(null);
        setTargetCoords(null);
        setIsLoading(false);
      };
      reader.onerror = () => {
        throw new Error('Failed to read image blob');
      };
      reader.readAsDataURL(blob);
    } catch (err: any) {
      console.warn('Cors template fetch failed, using direct URL:', err);
      // Fallback to direct URL if base64 conversion is blocked
      setOriginalImage(templateUrl);
      setEditedImage(null);
      setTargetCoords(null);
      setIsLoading(false);
    }
  };

  // Convert File object to Base64
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      setOriginalImage(reader.result as string);
      setEditedImage(null);
      setTargetCoords(null);
      // Update bridge state so Iris is aware of the file
      bridge.setUploadedFile({
        name: file.name,
        type: 'image',
        mimeType: file.type || 'image/jpeg',
        previewUrl: reader.result as string
      } as any);
    };
    reader.onerror = () => {
      setError('Arey yaar, photo upload fail ho gaya! Dobara try karo na.');
    };
    reader.readAsDataURL(file);
  };

  // Interactive Target Pointer Click Handler
  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setTargetCoords({ x: Math.round(x), y: Math.round(y) });
  };

  // Trigger Image Edit API
  const triggerImageEdit = async (imgData: string, instText: string, actType: string) => {
    if (!imgData) {
      setError('Pehle koi image select ya upload karo na yaar!');
      return;
    }
    if (!instText.trim()) {
      setError('Batao to sahi ki photo mein kya edit karna hai!');
      return;
    }

    setIsLoading(true);
    setError(null);
    setEditedImage(null);
    setIsSimulated(false);

    const statuses = [
      'Scanning pixels & image dimensions...',
      'Deconstructing subjects, lighting, and composition...',
      'Synthesizing contextual Imagen-3 prompt details...',
      'Executing comprehensive element add/remove/replacement...',
      'Refining textures, blend, and ambient shadows...',
      'Polishing final high-resolution render...'
    ];

    let statusIndex = 0;
    setCurrentStatusText(statuses[0]);
    const statusInterval = setInterval(() => {
      if (statusIndex < statuses.length - 1) {
        statusIndex++;
        setCurrentStatusText(statuses[statusIndex]);
      }
    }, 1200);

    try {
      // Localized target tag if coordinate is set
      let finalPrompt = instText;
      if (targetCoords) {
        finalPrompt += ` (Focus this edit specifically around position X: ${targetCoords.x}%, Y: ${targetCoords.y}% on the canvas)`;
      }

      const res = await fetch('/api/edit-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalImage: imgData,
          prompt: finalPrompt,
          action: actType,
          aspectRatio: '1:1'
        })
      });

      clearInterval(statusInterval);

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Server image editing failed');
      }

      const data = await res.json();
      if (data.success && data.editedImage) {
        setEditedImage(data.editedImage);
        setMasterPrompt(data.masterPrompt || '');
        setIsSimulated(!!data.isSimulated);
        if (data.isSimulated) {
          // If simulated, let's execute a beautiful CSS filter or Canvas composite in UI as mock fallback
          applyCanvasSimulatedFilter(imgData, instText);
        }
      } else {
        throw new Error('Could not retrieve edited image output');
      }
    } catch (err: any) {
      clearInterval(statusInterval);
      console.error('Image modification error:', err);
      setError(err?.message || 'Something went wrong while editing the photo. Please try again!');
    } finally {
      setIsLoading(false);
    }
  };

  // Fun simulation filters on Canvas to provide a high-fidelity direct interaction even if API limits are hit!
  const applyCanvasSimulatedFilter = (base64: string, filterPrompt: string) => {
    const canvas = document.createElement('canvas');
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.src = base64;
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Draw original
      ctx.drawImage(img, 0, 0);

      // Analyze prompt keywords to add fun overlay visual assets dynamically!
      const p = filterPrompt.toLowerCase();
      
      if (p.includes('cyber') || p.includes('neon') || p.includes('visor') || p.includes('glowing')) {
        // Draw cyberpunk cybernetics / visor overlay
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = Math.max(4, img.width * 0.008);
        ctx.shadowColor = '#06b6d4';
        ctx.shadowBlur = Math.max(15, img.width * 0.02);
        
        // Add futuristic HUD lines
        ctx.beginPath();
        if (targetCoords) {
          const px = (targetCoords.x / 100) * img.width;
          const py = (targetCoords.y / 100) * img.height;
          ctx.arc(px, py, img.width * 0.08, 0, Math.PI * 2);
          ctx.stroke();
          
          ctx.beginPath();
          ctx.moveTo(px - img.width * 0.15, py);
          ctx.lineTo(px + img.width * 0.15, py);
          ctx.stroke();
        } else {
          // Center screen
          ctx.arc(img.width * 0.5, img.height * 0.45, img.width * 0.1, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else if (p.includes('golden') || p.includes('sunset') || p.includes('warm') || p.includes('sun')) {
        // Add a warm orange/gold gradient map overlay for a spectacular golden hour lighting blend!
        ctx.globalCompositeOperation = 'color-burn';
        const grad = ctx.createRadialGradient(img.width * 0.8, img.height * 0.2, 50, img.width * 0.5, img.height * 0.5, img.width * 0.8);
        grad.addColorStop(0, 'rgba(249, 115, 22, 0.45)'); // Warm Orange
        grad.addColorStop(1, 'rgba(251, 191, 36, 0.15)'); // Soft Yellow
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, img.width, img.height);
      } else if (p.includes('remove') || p.includes('delete') || p.includes('clean')) {
        // Simulate object removal by blur-healing the targeted coordinate!
        if (targetCoords) {
          const tx = (targetCoords.x / 100) * img.width;
          const ty = (targetCoords.y / 100) * img.height;
          const r = img.width * 0.07;
          
          ctx.save();
          ctx.beginPath();
          ctx.arc(tx, ty, r, 0, Math.PI * 2);
          ctx.clip();
          
          // Draw blurred neighboring pixels
          ctx.filter = 'blur(12px)';
          ctx.drawImage(img, -10, -10, img.width + 20, img.height + 20);
          ctx.restore();
        }
      } else if (p.includes('recolor') || p.includes('change color') || p.includes('blue') || p.includes('red') || p.includes('green')) {
        // Hue shift filter simulation
        ctx.globalCompositeOperation = 'hue';
        ctx.fillStyle = p.includes('red') ? '#ef4444' : p.includes('green') ? '#22c55e' : p.includes('blue') ? '#3b82f6' : '#a855f7';
        ctx.fillRect(0, 0, img.width, img.height);
      } else {
        // Cinematic cool color grading overlay
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = 'rgba(6, 182, 212, 0.08)'; // Cyan tint
        ctx.fillRect(0, 0, img.width, img.height);
      }

      setEditedImage(canvas.toDataURL('image/jpeg'));
    };
  };

  const handleDownload = () => {
    if (!editedImage) return;
    const a = document.createElement('a');
    a.href = editedImage;
    a.download = `iris_edit_${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/90 backdrop-blur-md animate-motion-blur-in">
      <div className="w-full max-w-5xl max-h-[92vh] bg-slate-900 border border-cyan-500/35 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.2)] flex flex-col overflow-hidden relative">
        
        {/* Specular Ambient Glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none z-0" />

        {/* Modal Header */}
        <div className="px-5 py-4 bg-slate-950 border-b border-cyan-500/20 flex items-center justify-between shrink-0 z-10 relative">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-md shadow-cyan-500/25">
              <Sparkles className="w-4 h-4 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-white tracking-wide">
                  Iris Image Modification Lab
                </h3>
                <span className="text-[9px] font-mono font-bold tracking-widest uppercase bg-cyan-950 text-cyan-400 px-2 py-0.5 rounded-full border border-cyan-500/20">
                  Multimodal
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Add, remove, recolor or replace elements with masterfully preserved style and lighting conditions
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
            title="Close Modification Lab"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Main Body (Scrollable Split Pane) */}
        <div className="flex-1 overflow-y-auto lg:overflow-hidden flex flex-col lg:flex-row z-10 relative">
          
          {/* Left Console Workspace (Inputs & Presets) */}
          <div className="w-full lg:w-96 p-5 border-b lg:border-b-0 lg:border-r border-slate-800 bg-slate-950/40 flex flex-col gap-4 lg:overflow-y-auto shrink-0 select-text">
            
            {/* Template Images Quick Test */}
            <div className="space-y-2">
              <label className="text-[11px] font-mono uppercase tracking-widest text-cyan-400 font-bold block">
                1. Select / Upload Target Image
              </label>
              
              <div className="grid grid-cols-3 gap-2">
                {TEMPLATE_IMAGES.map((img) => (
                  <button
                    key={img.id}
                    onClick={() => handleSelectTemplate(img.url)}
                    className="group relative h-16 rounded-lg overflow-hidden border border-slate-800 hover:border-cyan-500/50 transition-all flex flex-col items-center justify-end cursor-pointer"
                  >
                    <img
                      src={img.url}
                      alt={img.name}
                      referrerPolicy="no-referrer"
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent pointer-events-none" />
                    <span className="relative z-10 text-[9px] font-bold text-white pb-1 truncate max-w-full px-1">
                      {img.name}
                    </span>
                  </button>
                ))}
              </div>

              {/* Native Upload Trigger */}
              <div className="pt-1">
                <label htmlFor="image-editor-left-upload" className="w-full h-11 border border-dashed border-slate-800 hover:border-cyan-500/40 bg-slate-900/40 hover:bg-slate-900/70 rounded-xl cursor-pointer transition-all flex items-center justify-center gap-2">
                  <Upload className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-semibold text-slate-300">Upload your own photo</span>
                </label>
                <input
                  id="image-editor-left-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  style={{ display: 'none' }}
                />
              </div>
            </div>

            {/* Target Edit Point Help */}
            {originalImage && (
              <div className="p-3 bg-cyan-950/20 border border-cyan-500/15 rounded-xl space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-cyan-400 font-bold">
                  <Move className="w-3.5 h-3.5 text-cyan-400" />
                  <span>LOCALIZED POINTER TARGETING</span>
                </div>
                <p className="text-[10px] text-slate-300 leading-relaxed">
                  Tap on the original image canvas to set a precise pointer location. Iris will focus the subject insertion or removal directly on that coordinate!
                </p>
                {targetCoords && (
                  <div className="pt-1 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-cyan-300">Target Selected:</span>
                    <span className="text-[10px] font-mono bg-cyan-900/60 text-cyan-200 px-2 py-0.5 rounded border border-cyan-500/30">
                      X: {targetCoords.x}% • Y: {targetCoords.y}%
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Instruction Prompts */}
            <div className="space-y-2">
              <label className="text-[11px] font-mono uppercase tracking-widest text-cyan-400 font-bold block">
                2. Editing Action & Instructions
              </label>

              {/* Action Category Selector */}
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { value: 'add', label: '👤 Add Subject' },
                  { value: 'remove', label: '❌ Remove Item' },
                  { value: 'replace_background', label: '🌄 Replace BG' },
                  { value: 'recolor', label: '🎨 Color/Light' }
                ].map((act) => (
                  <button
                    key={act.value}
                    onClick={() => setSelectedAction(act.value)}
                    className={`py-1.5 px-2.5 rounded-lg border text-[11px] font-bold transition-all text-left ${
                      selectedAction === act.value
                        ? 'bg-cyan-950/80 border-cyan-500/50 text-cyan-300 shadow-md shadow-cyan-500/10'
                        : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {act.label}
                  </button>
                ))}
              </div>

              {/* Custom Command Box */}
              <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="Ex: 'Add a cute robotic bird sitting on the laptop shoulder and shift lighting to bright studio lamp...'"
                rows={3}
                className="w-full p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-cyan-500/50 transition-all font-medium leading-relaxed resize-none shadow-inner"
              />
            </div>

            {/* Quick Presets / Suggestions */}
            <div className="space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">
                Quick Preset Commands:
              </span>
              <div className="flex flex-col gap-1.5">
                {QUICK_INSTRUCTIONS.map((preset, idx) => {
                  const Icon = preset.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        setInstruction(preset.text);
                        setSelectedAction(preset.type);
                      }}
                      className="text-left p-2 rounded-lg border border-slate-800/60 bg-slate-900/20 hover:bg-slate-900 text-[11px] text-slate-300 hover:text-cyan-400 transition-all flex items-start gap-2 group"
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-500 group-hover:text-cyan-400" />
                      <span className="leading-normal">{preset.text}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Primary Action Button */}
            <button
              onClick={() => triggerImageEdit(originalImage || '', instruction, selectedAction)}
              disabled={isLoading || !originalImage || !instruction.trim()}
              className={`w-full py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg ${
                isLoading || !originalImage || !instruction.trim()
                  ? 'bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-cyan-500/20 active:scale-[0.98]'
              }`}
            >
              <Sparkles className="w-4 h-4 text-slate-950" />
              <span>Synthesize Seamless Edit</span>
            </button>

          </div>

          {/* Right Dual Canvas Workspace (Before/After) */}
          <div className="flex-1 bg-slate-950 p-5 flex flex-col gap-5 lg:overflow-y-auto">
            
            {error && (
              <div className="p-3.5 bg-rose-950/30 border border-rose-500/20 text-rose-300 rounded-xl text-xs flex items-center gap-2.5 animate-pulse">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {!originalImage ? (
              // Empty State (Guide Upload)
              <div className="flex-1 min-h-[300px] border border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center p-8 space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center shadow-lg">
                  <Image className="w-8 h-8 text-cyan-400" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-white">No Image Loaded</h4>
                  <p className="text-xs text-slate-500 max-w-sm">
                    Upload a photograph, screenshot, or graphic, or select one of the templates on the left to start editing elements in real time!
                  </p>
                </div>
                <div className="pt-2">
                  <label htmlFor="image-editor-empty-upload" className="px-4 py-2 bg-slate-900 border border-slate-800 hover:border-cyan-500/30 rounded-xl text-xs font-semibold text-cyan-400 cursor-pointer transition-colors block">
                    Upload Photo
                  </label>
                  <input
                    id="image-editor-empty-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    style={{ display: 'none' }}
                  />
                </div>
              </div>
            ) : (
              // Dual Canvas Split Preview
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 flex-1 min-h-[320px]">
                
                {/* Left Side: Original Image */}
                <div className="flex flex-col space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-slate-400">ORIGINAL CANVAS</span>
                    {targetCoords && (
                      <button
                        onClick={() => setTargetCoords(null)}
                        className="text-[10px] font-mono text-cyan-400 hover:text-cyan-200 transition-colors"
                      >
                        [Clear Pointer]
                      </button>
                    )}
                  </div>
                  
                  <div className="relative flex-1 bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden flex items-center justify-center min-h-[250px]">
                    <img
                      ref={imageRef}
                      onClick={handleImageClick}
                      src={originalImage}
                      alt="Original workspace"
                      referrerPolicy="no-referrer"
                      className="max-h-[350px] object-contain cursor-crosshair select-none"
                    />

                    {/* target coordinate laser indicator overlay */}
                    {targetCoords && (
                      <div
                        className="absolute w-6 h-6 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none"
                        style={{ left: `${targetCoords.x}%`, top: `${targetCoords.y}%` }}
                      >
                        <span className="absolute inset-0 rounded-full bg-cyan-400/30 animate-ping" />
                        <span className="absolute w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#06b6d4]" />
                      </div>
                    )}
                    
                    <div className="absolute bottom-3 left-3 bg-slate-950/80 px-2.5 py-1 rounded-md text-[10px] font-mono text-cyan-400/80 border border-slate-800">
                      Tap anywhere to set localized edit pointer
                    </div>
                  </div>
                </div>

                {/* Right Side: Edited Result */}
                <div className="flex flex-col space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-cyan-400 font-bold flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>EDITED IMAGE RESULT</span>
                    </span>
                    {editedImage && (
                      <button
                        onClick={handleDownload}
                        className="text-[10px] font-semibold text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1 bg-emerald-950/40 border border-emerald-500/20 px-2 py-0.5 rounded"
                      >
                        <Download className="w-3 h-3" />
                        <span>Download Edit</span>
                      </button>
                    )}
                  </div>

                  <div className="relative flex-1 bg-slate-900/50 rounded-2xl border border-cyan-500/20 overflow-hidden flex items-center justify-center min-h-[250px]">
                    {isLoading ? (
                      // Gorgeous holographic scanline loading state
                      <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 space-y-4">
                        <div className="relative w-16 h-16 flex items-center justify-center">
                          <span className="absolute inset-0 rounded-full border border-dashed border-cyan-500/30 animate-spin" style={{ animationDuration: '6s' }} />
                          <span className="absolute inset-2 rounded-full border border-dashed border-cyan-400/40 animate-spin" style={{ animationDuration: '3s' }} />
                          <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin" />
                        </div>
                        <div className="text-center space-y-1">
                          <p className="text-xs font-bold text-white tracking-wide">{currentStatusText}</p>
                          <p className="text-[10px] text-cyan-500/70 font-mono">Iris AI Synthesis Engine Active</p>
                        </div>
                        {/* Scanner overlay */}
                        <div className="absolute inset-x-0 h-0.5 bg-cyan-500 shadow-[0_0_15px_#06b6d4] opacity-50 animate-bounce top-0 pointer-events-none" />
                      </div>
                    ) : editedImage ? (
                      <img
                        src={editedImage}
                        alt="Edited output result"
                        referrerPolicy="no-referrer"
                        className="max-h-[350px] object-contain select-none"
                      />
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500">
                        <Eye className="w-10 h-10 text-slate-700 mb-2" />
                        <span className="text-xs font-semibold">Awaiting synthesis...</span>
                        <p className="text-[10px] text-slate-600 mt-1 max-w-[200px]">
                          Submit your edit prompt on the left console to generate modified photo.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* Synthesized System prompt info footer */}
            {editedImage && masterPrompt && (
              <div className="p-3.5 rounded-xl bg-slate-900/95 border border-slate-800 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-300 font-bold">
                    PRESERVATION ANALYSIS / MASTER IMAGEN PROMPT
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed font-sans max-h-24 overflow-y-auto">
                  {masterPrompt}
                </p>
                {isSimulated && (
                  <div className="text-[10px] text-amber-400 font-mono bg-amber-950/20 border border-amber-500/10 p-2 rounded-md">
                    Note: Simulated mode generated a canvas visual composite. Style preservation filters applied successfully.
                  </div>
                )}
              </div>
            )}

          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-slate-950 border-t border-cyan-500/20 flex items-center justify-between shrink-0 z-10 relative text-xs">
          <span className="text-slate-500 font-mono">
            Iris Image Editing Hub • v3.5
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 hover:text-white font-semibold transition-colors"
          >
            Close lab
          </button>
        </div>

      </div>
    </div>
  );
};
