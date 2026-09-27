import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Music2,
  ExternalLink,
} from 'lucide-react';
import { DeviceActionBridge, MediaState } from '../services/deviceActionBridge.ts';

interface MediaControlWidgetProps {
  bridge: DeviceActionBridge;
}

export const MediaControlWidget: React.FC<MediaControlWidgetProps> = ({ bridge }) => {
  const [mediaState, setMediaState] = useState<MediaState>(() => bridge.getMediaState());

  useEffect(() => {
    const unsubscribe = bridge.subscribe(() => {
      setMediaState({ ...bridge.getMediaState() });
    });
    return unsubscribe;
  }, [bridge]);

  const handlePlayPause = () => {
    bridge.controlMedia('toggle');
    setMediaState({ ...bridge.getMediaState() });
  };

  const handleNext = () => {
    bridge.controlMedia('next');
    setMediaState({ ...bridge.getMediaState() });
  };

  const handlePrev = () => {
    bridge.controlMedia('previous');
    setMediaState({ ...bridge.getMediaState() });
  };

  const handleMuteToggle = () => {
    bridge.controlMedia(mediaState.isMuted ? 'unmute' : 'mute');
    setMediaState({ ...bridge.getMediaState() });
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    bridge.controlMedia('volume', undefined, val);
    setMediaState({ ...bridge.getMediaState() });
  };

  const handleOpenSpotify = () => {
    bridge.openApp('spotify');
  };

  return (
    <div className="bg-white/92 border border-slate-200/90 backdrop-blur-md rounded-2xl p-3 shadow-md shadow-blue-500/5 flex items-center justify-between gap-3 max-w-lg w-full text-xs transition-all duration-200 hover:shadow-lg">
      {/* Track Info */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <div className={`p-2 rounded-xl transition-transform spring-button ${mediaState.isPlaying ? 'bg-blue-600 text-white animate-pulse' : 'bg-slate-100 text-slate-500'}`}>
          <Music2 className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-slate-900 truncate text-xs">{mediaState.trackTitle || 'Media Player Standby'}</p>
          <p className="text-[11px] text-slate-500 truncate">{mediaState.artist || 'Spotify / YouTube Music Ready'}</p>
        </div>
      </div>

      {/* Playback Controls */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={handlePrev}
          title="Previous Track"
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors spring-button"
        >
          <SkipBack className="w-4 h-4" />
        </button>

        <button
          onClick={handlePlayPause}
          title={mediaState.isPlaying ? 'Pause' : 'Play'}
          className="p-2 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20 spring-button"
        >
          {mediaState.isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
        </button>

        <button
          onClick={handleNext}
          title="Next Track"
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors spring-button"
        >
          <SkipForward className="w-4 h-4" />
        </button>
      </div>

      {/* Volume Slider with 60fps Thumb Physics */}
      <div className="hidden sm:flex items-center gap-2 w-24">
        <button
          onClick={handleMuteToggle}
          title={mediaState.isMuted ? 'Unmute' : 'Mute'}
          className="text-slate-400 hover:text-blue-600 transition-colors spring-button"
        >
          {mediaState.isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
        </button>
        <input
          type="range"
          min="0"
          max="100"
          value={mediaState.isMuted ? 0 : mediaState.volume}
          onChange={handleVolumeChange}
          className="w-full accent-blue-600 h-1 bg-slate-200 rounded-lg cursor-pointer"
        />
      </div>

      {/* Open App */}
      <button
        onClick={handleOpenSpotify}
        title="Open in Spotify Web"
        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-emerald-600 transition-colors spring-button"
      >
        <ExternalLink className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
