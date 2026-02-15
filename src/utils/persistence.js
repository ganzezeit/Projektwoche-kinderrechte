import { STORAGE_KEY, INITIAL_ENERGY } from './constants';

const DEFAULT_STATE = {
  currentDay: 1,
  energy: INITIAL_ENERGY,
  completedSteps: {},
  completedDays: [],
  usedEnergizers: [],
  introCompleted: false,
  dayIntroSeen: {},
  volume: 0.3
};

export function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return { ...DEFAULT_STATE, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.warn('Fehler beim Laden des Spielstands:', e);
  }
  return { ...DEFAULT_STATE };
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Fehler beim Speichern:', e);
  }
}

export function resetState() {
  localStorage.removeItem(STORAGE_KEY);
  return { ...DEFAULT_STATE };
}
