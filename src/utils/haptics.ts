export const triggerHaptic = (type: 'light' | 'medium' | 'heavy' | 'double' = 'light') => {
  if (typeof window !== 'undefined' && 'navigator' in window && typeof navigator.vibrate === 'function') {
    try {
      if (type === 'light') navigator.vibrate(12);
      else if (type === 'medium') navigator.vibrate(24);
      else if (type === 'heavy') navigator.vibrate(40);
      else if (type === 'double') navigator.vibrate([12, 40, 12]);
    } catch {
      // Vibration not supported or blocked by user gesture requirements
    }
  }
};
