export interface SavedRunState {
  levelIndex: number;
  score: number;
  displayScore: number;
  hull: number;
  streak: number;
  stats: {
    moorings: number;
    bumps: number;
    perfects: number;
    streak: number;
    bestStreak: number;
  };
  runSeed: number;
  savedAt: number;
}

const STORAGE_KEY = "dsa_active_run";

export function loadSavedRun(): SavedRunState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SavedRunState;
    if (!data || typeof data.levelIndex !== "number" || data.levelIndex < 1) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function saveActiveRun(state: SavedRunState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore storage quota or private mode errors */
  }
}

export function clearSavedRun(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
