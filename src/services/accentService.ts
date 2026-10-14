// Service for extracting vibrant accent palettes from wallpapers and applying them across the application

export interface AccentPalette {
  primary: string;        // Hex color, e.g. '#10b981'
  primaryHover: string;   // Hex color slightly darker/lighter
  text: string;           // Contrasting text color, e.g. '#12131a' or '#ffffff'
  glow: string;           // rgba glow
  subtle: string;         // rgba low-opacity background
  border: string;         // rgba border
  secondary: string;      // Secondary harmonious hue for gradients
  gradient: string;       // CSS gradient string
}

const DEFAULT_GOLD_PALETTE: AccentPalette = {
  primary: '#DEBA5A',
  primaryHover: '#CFAB49',
  text: '#151206',
  glow: 'rgba(222, 186, 90, 0.45)',
  subtle: 'rgba(222, 186, 90, 0.16)',
  border: 'rgba(222, 186, 90, 0.35)',
  secondary: '#F59E0B',
  gradient: 'linear-gradient(135deg, #DEBA5A 0%, #F59E0B 100%)',
};

// Known aesthetic palettes for standard wallpapers
const KNOWN_PALETTES: Record<string, AccentPalette> = {
  // Blue / Ocean / Windows Bloom
  blue: {
    primary: '#38BDF8',
    primaryHover: '#0EA5E9',
    text: '#082F49',
    glow: 'rgba(56, 189, 248, 0.45)',
    subtle: 'rgba(56, 189, 248, 0.16)',
    border: 'rgba(56, 189, 248, 0.35)',
    secondary: '#6366F1',
    gradient: 'linear-gradient(135deg, #38BDF8 0%, #6366F1 100%)',
  },
  // Dark / Indigo
  indigo: {
    primary: '#818CF8',
    primaryHover: '#6366F1',
    text: '#0F172A',
    glow: 'rgba(129, 140, 248, 0.45)',
    subtle: 'rgba(129, 140, 248, 0.16)',
    border: 'rgba(129, 140, 248, 0.35)',
    secondary: '#A855F7',
    gradient: 'linear-gradient(135deg, #818CF8 0%, #A855F7 100%)',
  },
  // Green / Nature / Landscape
  green: {
    primary: '#34D399',
    primaryHover: '#10B981',
    text: '#064E3B',
    glow: 'rgba(52, 211, 153, 0.45)',
    subtle: 'rgba(52, 211, 153, 0.16)',
    border: 'rgba(52, 211, 153, 0.35)',
    secondary: '#06B6D4',
    gradient: 'linear-gradient(135deg, #34D399 0%, #06B6D4 100%)',
  },
  // Sunset / Peach / Orange
  orange: {
    primary: '#FB923C',
    primaryHover: '#F97316',
    text: '#431407',
    glow: 'rgba(251, 146, 60, 0.45)',
    subtle: 'rgba(251, 146, 60, 0.16)',
    border: 'rgba(251, 146, 60, 0.35)',
    secondary: '#F43F5E',
    gradient: 'linear-gradient(135deg, #FB923C 0%, #F43F5E 100%)',
  },
  // Purple / Violet / Flow
  purple: {
    primary: '#C084FC',
    primaryHover: '#A855F7',
    text: '#3B0764',
    glow: 'rgba(192, 132, 252, 0.45)',
    subtle: 'rgba(192, 132, 252, 0.16)',
    border: 'rgba(192, 132, 252, 0.35)',
    secondary: '#EC4899',
    gradient: 'linear-gradient(135deg, #C084FC 0%, #EC4899 100%)',
  },
  // Pink / Rose
  pink: {
    primary: '#F472B6',
    primaryHover: '#EC4899',
    text: '#500724',
    glow: 'rgba(244, 114, 182, 0.45)',
    subtle: 'rgba(244, 114, 182, 0.16)',
    border: 'rgba(244, 114, 182, 0.35)',
    secondary: '#FB7185',
    gradient: 'linear-gradient(135deg, #F472B6 0%, #FB7185 100%)',
  },
};

class AccentService {
  private currentPalette: AccentPalette = DEFAULT_GOLD_PALETTE;
  private listeners: Set<(palette: AccentPalette) => void> = new Set();

  constructor() {
    // Restore saved accent if available
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('boty_active_accent');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.primary) {
            this.currentPalette = parsed;
            this.applyToCss(parsed);
          }
        }
      } catch {}
    }
  }

  getCurrentPalette(): AccentPalette {
    return this.currentPalette;
  }

  subscribe(callback: (palette: AccentPalette) => void): () => void {
    this.listeners.add(callback);
    callback(this.currentPalette);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notify() {
    this.listeners.forEach((cb) => {
      try {
        cb(this.currentPalette);
      } catch (err) {
        console.error('Error notifying accent listener:', err);
      }
    });
  }

  // Injects CSS variables into :root
  applyToCss(palette: AccentPalette) {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.style.setProperty('--app-accent', palette.primary);
    root.style.setProperty('--app-accent-hover', palette.primaryHover);
    root.style.setProperty('--app-accent-text', palette.text);
    root.style.setProperty('--app-accent-glow', palette.glow);
    root.style.setProperty('--app-accent-subtle', palette.subtle);
    root.style.setProperty('--app-accent-border', palette.border);
    root.style.setProperty('--app-accent-gradient', palette.gradient);
  }

  // Set palette directly and persist
  setPalette(palette: AccentPalette) {
    this.currentPalette = palette;
    this.applyToCss(palette);
    this.notify();
    try {
      localStorage.setItem('boty_active_accent', JSON.stringify(palette));
    } catch {}
  }

  // Generate AccentPalette from hex color
  generateFromHex(hex: string): AccentPalette {
    // Clean hex
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map((x) => x + x).join('');
    if (c.length === 8) c = c.substring(0, 6); // Drop alpha

    const r = parseInt(c.substring(0, 2), 16) || 222;
    const g = parseInt(c.substring(2, 4), 16) || 186;
    const b = parseInt(c.substring(4, 6), 16) || 90;

    // Convert to HSL to produce vibrant primary
    const [h, s, l] = rgbToHsl(r, g, b);

    // Ensure it's not too dark (bump lightness to min 0.52 for dark theme visibility)
    // and keep good saturation (min 0.65)
    const tunedL = Math.max(0.48, Math.min(0.68, l));
    const tunedS = Math.max(0.65, Math.min(0.95, s));
    const [tr, tg, tb] = hslToRgb(h, tunedS, tunedL);
    const primary = rgbToHex(tr, tg, tb);

    // Hover (slightly brighter/darker)
    const [hr, hg, hb] = hslToRgb(h, tunedS, Math.min(0.78, tunedL + 0.08));
    const primaryHover = rgbToHex(hr, hg, hb);

    // Secondary hue (shifted by 25 degrees)
    const [sr, sg, sb] = hslToRgb((h + 25) % 360, tunedS, tunedL);
    const secondary = rgbToHex(sr, sg, sb);

    // Contrast text calculation
    const luminance = 0.299 * tr + 0.587 * tg + 0.114 * tb;
    const text = luminance > 135 ? '#151206' : '#FFFFFF';

    return {
      primary,
      primaryHover,
      text,
      glow: `rgba(${tr}, ${tg}, ${tb}, 0.45)`,
      subtle: `rgba(${tr}, ${tg}, ${tb}, 0.16)`,
      border: `rgba(${tr}, ${tg}, ${tb}, 0.35)`,
      secondary,
      gradient: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`,
    };
  }

  // Extract vibrant dominant color from an image URL or base64
  async extractFromImage(imageSrc: string): Promise<AccentPalette> {
    return new Promise((resolve) => {
      // 1. Check known keywords in image source
      const lowerSrc = imageSrc.toLowerCase();
      if (lowerSrc.includes('green') || lowerSrc.includes('landscape') || lowerSrc.includes('grass') || lowerSrc.includes('nature')) {
        return resolve(KNOWN_PALETTES.green);
      }
      if (lowerSrc.includes('bloom') || lowerSrc.includes('blue') || lowerSrc.includes('ocean') || lowerSrc.includes('sky')) {
        return resolve(KNOWN_PALETTES.blue);
      }
      if (lowerSrc.includes('sunrise') || lowerSrc.includes('sunset') || lowerSrc.includes('glow') || lowerSrc.includes('warm')) {
        return resolve(KNOWN_PALETTES.orange);
      }
      if (lowerSrc.includes('motion') || lowerSrc.includes('purple') || lowerSrc.includes('violet') || lowerSrc.includes('themea')) {
        return resolve(KNOWN_PALETTES.purple);
      }

      // 2. Load into HTML Image element and sample offscreen canvas
      const img = new Image();
      img.crossOrigin = 'anonymous';

      const timeout = setTimeout(() => {
        // Fallback to default if image takes too long
        resolve(this.currentPalette);
      }, 1500);

      img.onload = () => {
        clearTimeout(timeout);
        try {
          const canvas = document.createElement('canvas');
          const size = 48;
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(DEFAULT_GOLD_PALETTE);
            return;
          }

          ctx.drawImage(img, 0, 0, size, size);
          const imageData = ctx.getImageData(0, 0, size, size).data;

          // Color bucket scoring
          // Discard greys and pure black/white, find the most vibrant and prominent color
          let bestScore = -1;
          let bestR = 222, bestG = 186, bestB = 90;

          // Hue histogram (16 buckets)
          const bucketScores = new Array(16).fill(0);
          const bucketColors = new Array(16).fill(null).map(() => ({ r: 0, g: 0, b: 0, count: 0 }));

          for (let i = 0; i < imageData.length; i += 4) {
            const r = imageData[i];
            const g = imageData[i + 1];
            const b = imageData[i + 2];
            const a = imageData[i + 3];
            if (a < 128) continue;

            const [h, s, l] = rgbToHsl(r, g, b);

            // Filter out near black/white and low saturation grays
            if (l < 0.12 || l > 0.90 || s < 0.20) continue;

            // Score favoring saturated, balanced lightness
            const score = s * (1 - Math.abs(l - 0.55) * 1.3);
            const bucketIndex = Math.min(15, Math.floor((h / 360) * 16));

            bucketScores[bucketIndex] += score;
            bucketColors[bucketIndex].r += r;
            bucketColors[bucketIndex].g += g;
            bucketColors[bucketIndex].b += b;
            bucketColors[bucketIndex].count++;
          }

          for (let b = 0; b < 16; b++) {
            if (bucketScores[b] > bestScore && bucketColors[b].count > 0) {
              bestScore = bucketScores[b];
              bestR = Math.round(bucketColors[b].r / bucketColors[b].count);
              bestG = Math.round(bucketColors[b].g / bucketColors[b].count);
              bestB = Math.round(bucketColors[b].b / bucketColors[b].count);
            }
          }

          const hex = rgbToHex(bestR, bestG, bestB);
          resolve(this.generateFromHex(hex));
        } catch {
          resolve(DEFAULT_GOLD_PALETTE);
        }
      };

      img.onerror = () => {
        clearTimeout(timeout);
        resolve(this.currentPalette);
      };

      img.src = imageSrc;
    });
  }

  // Quick helper to apply wallpaper item
  async updateFromWallpaper(item: { id?: string; label?: string; src?: string; path?: string }) {
    if (!item) return;

    // Check label first for immediate response
    const label = (item.label || item.id || '').toLowerCase();
    if (label.includes('green') || label.includes('landscape')) {
      this.setPalette(KNOWN_PALETTES.green);
      return;
    }
    if (label.includes('bloom') || label.includes('blue') || label.includes('ocean')) {
      this.setPalette(KNOWN_PALETTES.blue);
      return;
    }
    if (label.includes('dark') || label.includes('indigo')) {
      this.setPalette(KNOWN_PALETTES.indigo);
      return;
    }
    if (label.includes('motion') || label.includes('purple')) {
      this.setPalette(KNOWN_PALETTES.purple);
      return;
    }
    if (label.includes('sunrise') || label.includes('glow')) {
      this.setPalette(KNOWN_PALETTES.orange);
      return;
    }

    // If it has an image src (data URL, http, or blob)
    if (item.src) {
      const palette = await this.extractFromImage(item.src);
      this.setPalette(palette);
    }
  }
}

// Color conversion helpers
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
      case g: h = ((b - r) / d + 2) * 60; break;
      case b: h = ((r - g) / d + 4) * 60; break;
    }
  }
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  let r: number, g: number, b: number;
  h = ((h % 360) + 360) % 360;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h / 360 + 1 / 3);
    g = hue2rgb(p, q, h / 360);
    b = hue2rgb(p, q, h / 360 - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export const accentService = new AccentService();
