const STORAGE_KEY = "nomi.voice.activeCallBar.position";

export type ActiveCallBarPosition = {
  x: number;
  y: number;
};

export const loadActiveCallBarPosition = (): ActiveCallBarPosition | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveCallBarPosition;
    if (
      typeof parsed?.x !== "number" ||
      typeof parsed?.y !== "number" ||
      !Number.isFinite(parsed.x) ||
      !Number.isFinite(parsed.y)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const saveActiveCallBarPosition = (position: ActiveCallBarPosition) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
  } catch {
    // Ignore quota / private mode.
  }
};

export const clampActiveCallBarPosition = (
  x: number,
  y: number,
  width: number,
  height: number,
): ActiveCallBarPosition => {
  const margin = 8;
  const maxX = Math.max(margin, window.innerWidth - width - margin);
  const maxY = Math.max(margin, window.innerHeight - height - margin);
  return {
    x: Math.min(Math.max(margin, x), maxX),
    y: Math.min(Math.max(margin, y), maxY),
  };
};

export const defaultActiveCallBarPosition = (
  width: number,
  height: number,
): ActiveCallBarPosition => {
  const margin = 16;
  return {
    x: Math.max(margin, (window.innerWidth - width) / 2),
    y: Math.max(margin, window.innerHeight - height - margin),
  };
};
