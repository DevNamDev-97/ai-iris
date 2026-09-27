import React, { useState, useEffect, useRef } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  useMap,
} from '@vis.gl/react-google-maps';
import {
  X,
  Navigation,
  Crosshair,
  Search,
  MapPin,
  Compass,
  Layers,
  Share2,
  ExternalLink,
  Car,
  Mic,
  MicOff,
  Volume2,
  Sparkles,
} from 'lucide-react';
import { locationService, PreciseLocation } from '../services/locationService.ts';

interface GoogleMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
  initialCenter?: { lat: number; lng: number };
  initialZoom?: number;
  initialCategory?: string;
  apiKey?: string;
  isLiveActive?: boolean;
  audioLevel?: number;
  onToggleSession?: () => void;
}

interface PlaceResultItem {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating?: number;
  userRatingsTotal?: number;
  openNow?: boolean;
  types?: string[];
  distanceKm?: number;
}

// Inner Controller for programmatic pan/zoom and places search
const MapController: React.FC<{
  center: { lat: number; lng: number };
  zoom: number;
  selectedPlace: PlaceResultItem | null;
}> = ({ center, zoom, selectedPlace }) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    if (selectedPlace) {
      map.panTo({ lat: selectedPlace.lat, lng: selectedPlace.lng });
      map.setZoom(16);
    } else if (center) {
      map.panTo(center);
      map.setZoom(zoom);
    }
  }, [map, center, zoom, selectedPlace]);

  return null;
};

export const GoogleMapModal: React.FC<GoogleMapModalProps> = ({
  isOpen,
  onClose,
  initialQuery = '',
  initialCenter,
  initialZoom = 15,
  initialCategory,
  apiKey: propApiKey,
  isLiveActive = false,
  audioLevel = 0,
  onToggleSession,
}) => {
  const [apiKey, setApiKey] = useState<string>(
    propApiKey ||
    (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) ||
    'AIzaSyBd0UTFAPshyps6PSOM4wNZtpO4Vw5q_ZQ'
  );

  const [userLocation, setUserLocation] = useState<PreciseLocation>(() => locationService.getLocation());
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({
    lat: initialCenter?.lat || userLocation.latitude,
    lng: initialCenter?.lng || userLocation.longitude,
  });
  const [zoom, setZoom] = useState<number>(initialZoom);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [searchResults, setSearchResults] = useState<PlaceResultItem[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<PlaceResultItem | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [mapType, setMapType] = useState<'roadmap' | 'satellite' | 'hybrid' | 'terrain'>('roadmap');
  const [isLocating, setIsLocating] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(initialCategory || null);

  // Fetch API key from server config if missing
  useEffect(() => {
    if (!apiKey || apiKey === 'MY_GOOGLE_MAPS_API_KEY') {
      fetch('/api/config/maps-key')
        .then((res) => res.json())
        .then((data) => {
          if (data.apiKey) {
            setApiKey(data.apiKey);
          }
        })
        .catch(() => {});
    }
  }, [apiKey]);

  // Subscribe to live location updates
  useEffect(() => {
    const unsub = locationService.subscribe((loc) => {
      setUserLocation(loc);
      if (!initialCenter && (!searchResults.length || !selectedPlace)) {
        setMapCenter({ lat: loc.latitude, lng: loc.longitude });
      }
    });
    return unsub;
  }, [initialCenter, searchResults.length, selectedPlace]);

  // Listen to AI Voice Map Controls in real-time
  useEffect(() => {
    const handleMapControl = (e: any) => {
      const detail = e.detail || {};
      if (detail.mapType) {
        const t = String(detail.mapType).toLowerCase();
        if (t.includes('sat')) setMapType('satellite');
        else if (t.includes('hyb')) setMapType('hybrid');
        else if (t.includes('ter')) setMapType('terrain');
        else if (t.includes('road') || t.includes('norm') || t.includes('def')) setMapType('roadmap');
      }

      if (detail.zoom !== undefined) {
        if (detail.zoom === 'in') {
          setZoom((prev) => Math.min(20, prev + 2));
        } else if (detail.zoom === 'out') {
          setZoom((prev) => Math.max(2, prev - 2));
        } else if (typeof detail.zoom === 'number') {
          setZoom(Math.max(1, Math.min(20, detail.zoom)));
        }
      }

      if (detail.center && detail.center.lat && detail.center.lng) {
        setMapCenter({ lat: detail.center.lat, lng: detail.center.lng });
      }

      if (detail.query) {
        setSearchQuery(detail.query);
        handleSearch(detail.query);
      }
    };

    window.addEventListener('iris-map-control', handleMapControl);
    return () => window.removeEventListener('iris-map-control', handleMapControl);
  }, [userLocation]);

  // Trigger initial query search if provided
  useEffect(() => {
    if (isOpen) {
      if (initialQuery) {
        setSearchQuery(initialQuery);
        handleSearch(initialQuery);
      } else if (initialCategory) {
        handleQuickCategory(initialCategory);
      }
    }
  }, [isOpen, initialQuery, initialCategory]);

  const handleRecenter = async () => {
    setIsLocating(true);
    const loc = await locationService.requestPreciseLocation(true);
    setIsLocating(false);
    setSelectedPlace(null);
    setMapCenter({ lat: loc.latitude, lng: loc.longitude });
    setZoom(16);
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(1));
  };

  const handleSearch = async (queryText: string) => {
    if (!queryText.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(
        `/api/places/search?query=${encodeURIComponent(queryText)}&lat=${userLocation.latitude}&lng=${userLocation.longitude}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.results && data.results.length > 0) {
          const items: PlaceResultItem[] = data.results.map((r: any) => ({
            id: r.place_id || `place-${Math.random()}`,
            name: r.name,
            address: r.formatted_address || r.vicinity || 'Address not listed',
            lat: r.geometry?.location?.lat || userLocation.latitude,
            lng: r.geometry?.location?.lng || userLocation.longitude,
            rating: r.rating,
            userRatingsTotal: r.user_ratings_total,
            openNow: r.opening_hours?.open_now,
            types: r.types || [],
            distanceKm: calculateDistance(
              userLocation.latitude,
              userLocation.longitude,
              r.geometry?.location?.lat || userLocation.latitude,
              r.geometry?.location?.lng || userLocation.longitude
            ),
          }));
          setSearchResults(items);
          setSelectedPlace(items[0]);
          setMapCenter({ lat: items[0].lat, lng: items[0].lng });
          setZoom(15);
        } else {
          setSearchResults([]);
        }
      }
    } catch (e) {
      console.warn('Place search failed:', e);
    } finally {
      setIsSearching(false);
    }
  };

  const handleQuickCategory = (cat: string) => {
    setActiveCategory(cat);
    setSearchQuery(cat);
    handleSearch(cat);
  };

  const openInGoogleMaps = (destLat: number, destLng: number, queryLabel?: string) => {
    const url = queryLabel
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(queryLabel)}&travelmode=driving`
      : `https://www.google.com/maps/dir/?api=1&origin=${userLocation.latitude},${userLocation.longitude}&destination=${destLat},${destLng}&travelmode=driving`;
    window.open(url, '_blank');
  };

  const shareLocation = () => {
    const shareUrl = `https://www.google.com/maps/search/?api=1&query=${userLocation.latitude},${userLocation.longitude}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    }
  };

  if (!isOpen) return null;

  const quickCategories = [
    { label: 'Restaurants', query: 'restaurants nearby', icon: '🍽️' },
    { label: 'Cafes', query: 'cafes coffee shop', icon: '☕' },
    { label: 'Hospitals', query: 'hospital clinic emergency', icon: '🏥' },
    { label: 'Petrol/EV', query: 'petrol pump gas station', icon: '⛽' },
    { label: 'ATMs', query: 'atm bank cash machine', icon: '🏧' },
    { label: 'Pharmacies', query: 'pharmacy chemist medicine', icon: '💊' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl h-[92vh] max-h-[840px] bg-slate-900 border border-slate-700/80 rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden text-white">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/90 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm tracking-wide text-white font-mono">
                  IRIS GOOGLE MAPS & LIVE RADAR
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/30 text-emerald-300 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  GPS ACTIVE (±{userLocation.accuracy}m)
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate max-w-md">
                {userLocation.formattedAddress || `${userLocation.latitude.toFixed(4)}, ${userLocation.longitude.toFixed(4)}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Live AI Voice Status / Mic Toggle */}
            {onToggleSession && (
              <button
                onClick={onToggleSession}
                title={isLiveActive ? 'Iris is listening' : 'Start Voice Session'}
                className={`px-3 py-1.5 rounded-xl border text-xs font-mono flex items-center gap-1.5 transition-all ${
                  isLiveActive
                    ? 'bg-blue-600/30 border-blue-500/60 text-blue-300 shadow-md shadow-blue-500/20'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                }`}
              >
                {isLiveActive ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                    <Mic className="w-3.5 h-3.5 text-blue-400" />
                    <span className="hidden sm:inline">Iris Active</span>
                  </>
                ) : (
                  <>
                    <MicOff className="w-3.5 h-3.5 text-slate-400" />
                    <span className="hidden sm:inline">Mic Idle</span>
                  </>
                )}
              </button>
            )}

            <button
              onClick={shareLocation}
              title="Copy Google Maps Pin Link"
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono text-slate-300 flex items-center gap-1.5 transition-colors"
            >
              <Share2 className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">{copyFeedback ? 'Copied!' : 'Share Pin'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search & Quick Filter Bar */}
        <div className="px-4 py-2.5 bg-slate-950/70 border-b border-slate-800/80 flex flex-col sm:flex-row items-center gap-2 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch(searchQuery);
            }}
            className="flex-1 w-full flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 shadow-inner"
          >
            <Search className="w-4 h-4 text-cyan-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search places, restaurants, addresses, hospitals, city... (or ask Iris to control map)"
              className="bg-transparent border-none text-white focus:outline-none w-full text-xs placeholder:text-slate-500"
            />
            {isSearching && (
              <span className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin shrink-0" />
            )}
            <button
              type="submit"
              className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-[11px] font-semibold transition-colors"
            >
              Search
            </button>
          </form>

          {/* Quick Categories */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
            {quickCategories.map((c) => (
              <button
                key={c.label}
                type="button"
                onClick={() => handleQuickCategory(c.query)}
                className={`text-[11px] px-2.5 py-1 rounded-lg font-mono whitespace-nowrap transition-all flex items-center gap-1 ${
                  activeCategory === c.query
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 font-bold'
                    : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700'
                }`}
              >
                <span>{c.icon}</span>
                <span>{c.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Main Workspace: Interactive Map & Side Drawer */}
        <div className="flex-1 relative flex overflow-hidden">
          
          {/* Google Map Container with Explicit Height */}
          <div className="flex-1 h-full w-full relative">
            <APIProvider apiKey={apiKey}>
              <Map
                internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                mapId="DEMO_MAP_ID"
                defaultCenter={mapCenter}
                defaultZoom={zoom}
                gestureHandling="greedy"
                mapTypeId={mapType}
                fullscreenControl={false}
                streetViewControl={true}
                className="w-full h-full"
              >
                <MapController center={mapCenter} zoom={zoom} selectedPlace={selectedPlace} />

                {/* Live High-Accuracy User Location Marker with Radar Beacon */}
                <AdvancedMarker
                  position={{ lat: userLocation.latitude, lng: userLocation.longitude }}
                  title="My Precise Location"
                  onClick={() => {
                    setSelectedPlace(null);
                    setMapCenter({ lat: userLocation.latitude, lng: userLocation.longitude });
                  }}
                >
                  <div className="relative flex items-center justify-center cursor-pointer group">
                    <div className="absolute w-8 h-8 rounded-full bg-cyan-500/30 animate-ping" />
                    <div className="relative w-5 h-5 rounded-full bg-cyan-500 border-2 border-white shadow-lg flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-white" />
                    </div>
                  </div>
                </AdvancedMarker>

                {/* Searched Place Markers */}
                {searchResults.map((place, idx) => (
                  <AdvancedMarker
                    key={place.id}
                    position={{ lat: place.lat, lng: place.lng }}
                    title={place.name}
                    onClick={() => {
                      setSelectedPlace(place);
                    }}
                  >
                    <div
                      className={`relative flex items-center justify-center cursor-pointer transition-transform hover:scale-125 ${
                        selectedPlace?.id === place.id ? 'scale-125 z-30' : 'z-20'
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold text-white shadow-md border-2 border-white ${
                          selectedPlace?.id === place.id
                            ? 'bg-rose-600 shadow-rose-500/50'
                            : 'bg-blue-600 shadow-blue-500/40'
                        }`}
                      >
                        {idx + 1}
                      </div>
                    </div>
                  </AdvancedMarker>
                ))}
              </Map>
            </APIProvider>

            {/* Floating Map Controls & POV View Switcher */}
            <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
              {/* Recenter Button */}
              <button
                onClick={handleRecenter}
                disabled={isLocating}
                title="Recenter to My Live Location"
                className="p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-cyan-500/40 text-cyan-400 shadow-lg backdrop-blur-md transition-all active:scale-95 flex items-center justify-center"
              >
                <Crosshair className={`w-4 h-4 ${isLocating ? 'animate-spin text-cyan-300' : ''}`} />
              </button>

              {/* Map Type Switcher */}
              <div className="p-1 rounded-xl bg-slate-900/90 border border-slate-700 shadow-lg backdrop-blur-md flex flex-col gap-1">
                {(['roadmap', 'satellite', 'hybrid', 'terrain'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setMapType(type)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-mono capitalize transition-all ${
                      mapType === type
                        ? 'bg-cyan-500 text-white font-bold shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              {/* Zoom In / Out Buttons */}
              <div className="p-1 rounded-xl bg-slate-900/90 border border-slate-700 shadow-lg backdrop-blur-md flex flex-col gap-1">
                <button
                  onClick={() => setZoom((z) => Math.min(20, z + 1))}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800"
                  title="Zoom In"
                >
                  +
                </button>
                <button
                  onClick={() => setZoom((z) => Math.max(2, z - 1))}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800"
                  title="Zoom Out"
                >
                  −
                </button>
              </div>
            </div>
          </div>

          {/* Side Place Details / Search Results Drawer */}
          {searchResults.length > 0 && (
            <div className="w-80 sm:w-96 bg-slate-950/95 border-l border-slate-800 flex flex-col h-full overflow-hidden shrink-0">
              <div className="p-3 border-b border-slate-800 flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-slate-300">
                  {searchResults.length} PLACES FOUND
                </span>
                <button
                  onClick={() => {
                    setSearchResults([]);
                    setSelectedPlace(null);
                  }}
                  className="text-[10px] font-mono text-slate-500 hover:text-slate-300"
                >
                  Clear Results
                </button>
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 p-2 space-y-1">
                {searchResults.map((item, idx) => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedPlace(item)}
                    className={`p-2.5 rounded-xl cursor-pointer transition-all ${
                      selectedPlace?.id === item.id
                        ? 'bg-cyan-950/70 border border-cyan-500/40 text-white shadow-md'
                        : 'bg-slate-900/40 hover:bg-slate-900/90 text-slate-300 border border-transparent'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-lg bg-blue-600/80 text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <h4 className="font-semibold text-xs leading-snug">{item.name}</h4>
                      </div>
                      {item.distanceKm !== undefined && (
                        <span className="text-[10px] font-mono text-cyan-400 shrink-0">
                          {item.distanceKm} km
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 pl-7 truncate">{item.address}</p>

                    {/* Bottom Actions for Selected Place */}
                    {selectedPlace?.id === item.id && (
                      <div className="mt-2.5 pt-2 border-t border-cyan-500/20 flex items-center gap-2 pl-7">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openInGoogleMaps(item.lat, item.lng, item.name);
                          }}
                          className="flex-1 py-1.5 px-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors shadow-md"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                          <span>Start Navigation</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(
                              `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.name + ' ' + item.address)}`,
                              '_blank'
                            );
                          }}
                          title="Open in Google Maps App"
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Status & Live Coordinates Info */}
        <div className="px-4 py-2 bg-slate-950 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-400 shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-slate-300">
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              <span>LAT: {userLocation.latitude.toFixed(6)}</span>
              <span className="text-slate-600">|</span>
              <span>LNG: {userLocation.longitude.toFixed(6)}</span>
            </span>
            {userLocation.speed !== null && (
              <span className="flex items-center gap-1 text-emerald-400">
                <Car className="w-3.5 h-3.5" />
                <span>{userLocation.speed} km/h</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500">Google Maps Platform • Voice POV Controlled</span>
            <button
              onClick={() => openInGoogleMaps(userLocation.latitude, userLocation.longitude)}
              className="text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1"
            >
              <span>Open in Google Maps</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
