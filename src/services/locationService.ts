export interface PreciseLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
  timestamp: number;
  formattedAddress?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  status: 'idle' | 'locating' | 'granted' | 'denied' | 'prompt' | 'error';
  permissionState: 'granted' | 'denied' | 'prompt';
  errorMessage?: string;
}

class LocationService {
  private currentLocation: PreciseLocation = {
    latitude: 28.6139, // Default fallback (e.g. New Delhi)
    longitude: 77.2090,
    accuracy: 50,
    altitude: null,
    speed: null,
    heading: null,
    timestamp: Date.now(),
    city: 'New Delhi',
    state: 'Delhi',
    country: 'India',
    formattedAddress: 'New Delhi, Delhi, India',
    status: 'prompt',
    permissionState: 'prompt',
  };

  private listeners: Array<(loc: PreciseLocation) => void> = [];
  private watchId: number | null = null;
  private isWatching = false;

  constructor() {
    this.initFromStorage();
    this.checkPermissionStatus();
  }

  private initFromStorage() {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('iris_precise_location');
        if (saved) {
          const parsed = JSON.parse(saved);
          this.currentLocation = { ...this.currentLocation, ...parsed };
        }
      }
    } catch (e) {
      console.warn('Failed to load cached location:', e);
    }
  }

  public async checkPermissionStatus(): Promise<'granted' | 'denied' | 'prompt'> {
    if (typeof window === 'undefined' || !navigator.permissions || !navigator.permissions.query) {
      return this.currentLocation.permissionState;
    }

    try {
      const status = await navigator.permissions.query({ name: 'geolocation' });
      const perm = status.state as 'granted' | 'denied' | 'prompt';
      this.currentLocation = {
        ...this.currentLocation,
        permissionState: perm,
        status: perm === 'granted' ? 'granted' : perm === 'denied' ? 'denied' : 'prompt',
      };
      this.notify();

      status.onchange = () => {
        const updated = status.state as 'granted' | 'denied' | 'prompt';
        this.currentLocation = {
          ...this.currentLocation,
          permissionState: updated,
          status: updated === 'granted' ? 'granted' : updated === 'denied' ? 'denied' : 'prompt',
        };
        if (updated === 'granted') {
          this.requestPreciseLocation(true);
        }
        this.notify();
      };

      return perm;
    } catch {
      return this.currentLocation.permissionState;
    }
  }

  public getLocation(): PreciseLocation {
    return this.currentLocation;
  }

  public subscribe(cb: (loc: PreciseLocation) => void): () => void {
    this.listeners.push(cb);
    cb(this.currentLocation);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  private notify() {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('iris_precise_location', JSON.stringify(this.currentLocation));
      }
    } catch (e) {
      // ignore
    }
    this.listeners.forEach((cb) => {
      try {
        cb(this.currentLocation);
      } catch (err) {
        console.error('Error in location listener:', err);
      }
    });
  }

  public async requestPreciseLocation(highAccuracy = true): Promise<PreciseLocation> {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      this.currentLocation = {
        ...this.currentLocation,
        status: 'error',
        permissionState: 'denied',
        errorMessage: 'Geolocation is not supported by your device/browser.',
      };
      this.notify();
      return this.currentLocation;
    }

    this.currentLocation = { ...this.currentLocation, status: 'locating', errorMessage: undefined };
    this.notify();

    return new Promise<PreciseLocation>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude, accuracy, altitude, speed, heading } = position.coords;
          
          this.currentLocation = {
            ...this.currentLocation,
            latitude,
            longitude,
            accuracy: Math.round(accuracy),
            altitude: altitude ? Math.round(altitude) : null,
            speed: speed ? Math.round(speed * 3.6) : null, // km/h
            heading: heading ? Math.round(heading) : null,
            timestamp: position.timestamp || Date.now(),
            status: 'granted',
            permissionState: 'granted',
            errorMessage: undefined,
          };

          // Reverse geocode to get human address
          await this.reverseGeocode(latitude, longitude);
          this.notify();
          this.startWatch();
          resolve(this.currentLocation);
        },
        async (error) => {
          console.warn('Geolocation error:', error.message);
          let errMsg = 'Location permission denied.';
          if (error.code === error.TIMEOUT) {
            errMsg = 'Location request timed out. Using approximate location.';
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            errMsg = 'Position unavailable. Using approximate location.';
          }

          // Try IP-based location fallback if GPS fails
          await this.fallbackIpLocation();

          const isDenied = error.code === error.PERMISSION_DENIED;
          this.currentLocation = {
            ...this.currentLocation,
            status: isDenied ? 'denied' : 'error',
            permissionState: isDenied ? 'denied' : this.currentLocation.permissionState,
            errorMessage: errMsg,
          };
          this.notify();
          resolve(this.currentLocation);
        },
        {
          enableHighAccuracy: highAccuracy,
          timeout: 12000,
          maximumAge: 5000,
        }
      );
    });
  }

  public startWatch() {
    if (this.isWatching || typeof window === 'undefined' || !navigator.geolocation) return;
    this.isWatching = true;

    try {
      this.watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude, accuracy, altitude, speed, heading } = pos.coords;
          this.currentLocation = {
            ...this.currentLocation,
            latitude,
            longitude,
            accuracy: Math.round(accuracy),
            altitude: altitude ? Math.round(altitude) : null,
            speed: speed ? Math.round(speed * 3.6) : null,
            heading: heading ? Math.round(heading) : null,
            timestamp: pos.timestamp || Date.now(),
            status: 'granted',
            permissionState: 'granted',
          };
          this.notify();
        },
        (err) => {
          console.warn('WatchPosition update error:', err.message);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 10000,
        }
      );
    } catch (e) {
      console.warn('Error starting position watcher:', e);
    }
  }

  public stopWatch() {
    if (this.watchId !== null && typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.isWatching = false;
  }

  public async reverseGeocode(lat: number, lng: number): Promise<void> {
    try {
      const res = await fetch(`/api/location/reverse-geocode?lat=${lat}&lng=${lng}`);
      if (res.ok) {
        const data = await res.json();
        if (data.formattedAddress) {
          this.currentLocation = {
            ...this.currentLocation,
            formattedAddress: data.formattedAddress,
            neighborhood: data.neighborhood || data.sublocality || this.currentLocation.neighborhood,
            city: data.city || data.locality || this.currentLocation.city,
            state: data.state || data.administrativeArea || this.currentLocation.state,
            country: data.country || this.currentLocation.country,
            postalCode: data.postalCode || this.currentLocation.postalCode,
          };
          this.notify();
        }
      }
    } catch (err) {
      console.warn('Failed reverse geocoding:', err);
    }
  }

  private async fallbackIpLocation(): Promise<void> {
    try {
      const res = await fetch('https://ipapi.co/json/');
      if (res.ok) {
        const data = await res.json();
        if (data.latitude && data.longitude) {
          this.currentLocation = {
            ...this.currentLocation,
            latitude: data.latitude,
            longitude: data.longitude,
            accuracy: 1000,
            city: data.city || this.currentLocation.city,
            state: data.region || this.currentLocation.state,
            country: data.country_name || this.currentLocation.country,
            formattedAddress: `${data.city || ''}, ${data.region || ''}, ${data.country_name || ''}`.trim(),
          };
          this.notify();
        }
      }
    } catch (e) {
      // ignore
    }
  }

  /**
   * Redirects to App Info / System App Permissions or opens Permission Dialog
   */
  public openAppInfoOrSettings(): void {
    if (typeof window === 'undefined') return;

    // 1. Check if running inside Android Native APK Bridge
    const androidBridge = (window as any).AndroidBridge || (window as any).IrisNativeBridge;
    if (androidBridge) {
      try {
        if (typeof androidBridge.openAppDetailsSettings === 'function') {
          androidBridge.openAppDetailsSettings();
          return;
        }
        if (typeof androidBridge.postMessage === 'function') {
          androidBridge.postMessage(
            JSON.stringify({
              action: 'OPEN_APP_SETTINGS',
              intent: 'android.settings.APPLICATION_DETAILS_SETTINGS',
            })
          );
          return;
        }
      } catch (e) {
        console.warn('Failed to call Android bridge app settings:', e);
      }
    }

    // 2. Dispatch custom event to show interactive in-app guide and trigger prompt
    window.dispatchEvent(new CustomEvent('iris-open-location-settings'));
    this.requestPreciseLocation(true).catch(() => {});
  }
}

export const locationService = new LocationService();
