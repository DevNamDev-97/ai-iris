/**
 * ScreenAnnotationService
 * Manages active screen highlight shapes, bounding boxes, arrows,
 * laser points, and drawing overlays requested by Iris or created by user.
 */

export interface HighlightShape {
  id: string;
  type: 'rect' | 'circle' | 'spotlight' | 'arrow' | 'laser';
  x: number; // 0-100 percentage
  y: number; // 0-100 percentage
  width?: number; // 0-100 percentage
  height?: number; // 0-100 percentage
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  label?: string;
  color?: 'cyan' | 'emerald' | 'amber' | 'rose' | 'purple' | string;
  createdAt: number;
  durationMs: number;
}

export type AnnotationListener = (highlights: HighlightShape[]) => void;

class ScreenAnnotationService {
  private highlights: HighlightShape[] = [];
  private listeners: Set<AnnotationListener> = new Set();
  private cleanupTimer: number | null = null;

  constructor() {
    this.startAutoCleanup();
  }

  public subscribe(listener: AnnotationListener) {
    this.listeners.add(listener);
    listener([...this.highlights]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const copy = [...this.highlights];
    this.listeners.forEach((l) => l(copy));
  }

  public addHighlight(shape: Omit<HighlightShape, 'id' | 'createdAt'>): HighlightShape {
    const id = 'hl_' + Math.random().toString(36).substring(2, 9);
    const newShape: HighlightShape = {
      ...shape,
      id,
      createdAt: Date.now(),
      durationMs: shape.durationMs || 8000, // Default 8 seconds highlight
    };

    // If spotlight or laser, we can replace previous laser/spotlight to keep UI clean
    if (shape.type === 'laser' || shape.type === 'spotlight') {
      this.highlights = this.highlights.filter((h) => h.type !== shape.type);
    }

    this.highlights.push(newShape);
    this.notify();
    return newShape;
  }

  public clearAll() {
    this.highlights = [];
    this.notify();
  }

  public removeHighlight(id: string) {
    this.highlights = this.highlights.filter((h) => h.id !== id);
    this.notify();
  }

  public getHighlights(): HighlightShape[] {
    return [...this.highlights];
  }

  private startAutoCleanup() {
    if (typeof window === 'undefined') return;
    this.cleanupTimer = window.setInterval(() => {
      const now = Date.now();
      const initialCount = this.highlights.length;
      if (initialCount === 0) return;

      this.highlights = this.highlights.filter(
        (h) => h.durationMs <= 0 || now - h.createdAt < h.durationMs
      );

      if (this.highlights.length !== initialCount) {
        this.notify();
      }
    }, 500);
  }
}

export const screenAnnotationService = new ScreenAnnotationService();
