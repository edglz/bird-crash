// Progress saved in localStorage: best star count per level.
const KEY = 'bird-crash-progress';

export function loadProgress(levelCount: number): number[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.from({ length: levelCount }, (_, i) => (Number(raw[i]) || 0));
  } catch {
    return new Array(levelCount).fill(0);
  }
}

export function saveStars(progress: number[], level: number, stars: number): number[] {
  const next = [...progress];
  next[level] = Math.max(next[level] ?? 0, stars);
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

// A level unlocks once the previous one is beaten.
export const isUnlocked = (progress: number[], level: number) => level === 0 || (progress[level - 1] ?? 0) > 0;
