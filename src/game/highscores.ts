export interface ScoreEntry {
  name: string;
  score: number;
  level: number;
  date: number;
}

const KEY = "dsa_highscores_v1";
const NAME_KEY = "dsa_lastname";
export const MAX_SCORES = 10;

export function loadScores(): ScoreEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as ScoreEntry[];
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((e) => e && typeof e.score === "number")
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_SCORES);
  } catch {
    return [];
  }
}

export function qualifies(score: number): boolean {
  if (score <= 0) return false;
  const list = loadScores();
  if (list.length < MAX_SCORES) return true;
  return score > list[list.length - 1].score;
}

/** Adds the entry and returns its rank (0-based) or -1 if it didn't make the table. */
export function addScore(entry: ScoreEntry): number {
  const list = loadScores();
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  const trimmed = list.slice(0, MAX_SCORES);
  try {
    localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    /* ignore */
  }
  return trimmed.indexOf(entry);
}

export function getLastName(): string {
  try {
    return localStorage.getItem(NAME_KEY) || "";
  } catch {
    return "";
  }
}

export function setLastName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* ignore */
  }
}
