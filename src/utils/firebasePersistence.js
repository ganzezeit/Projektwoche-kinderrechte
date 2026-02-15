import { ref, set, get, onValue, remove } from 'firebase/database';
import { db } from '../firebase';
import { INITIAL_ENERGY } from './constants';

let debounceTimer = null;
const DEBOUNCE_MS = 2000;

// Flag to prevent save loops: set true when applying remote state
export let isRemoteUpdate = false;
export function setIsRemoteUpdate(val) { isRemoteUpdate = val; }

// Default state shape — Firebase drops empty arrays/objects, so we must restore them
const DEFAULT_STATE = {
  currentDay: 1,
  energy: INITIAL_ENERGY,
  completedSteps: {},
  completedDays: [],
  usedEnergizers: [],
  introCompleted: false,
  dayIntroSeen: {},
};

/**
 * Merge remote Firebase state with defaults to fill in missing fields.
 * Firebase stores null for empty arrays, so we must restore them.
 */
function mergeWithDefaults(remoteState) {
  if (!remoteState || typeof remoteState !== 'object') return { ...DEFAULT_STATE };
  return {
    ...DEFAULT_STATE,
    ...remoteState,
    // Ensure arrays are arrays (Firebase turns [] into null)
    completedDays: Array.isArray(remoteState.completedDays) ? remoteState.completedDays : [],
    usedEnergizers: Array.isArray(remoteState.usedEnergizers) ? remoteState.usedEnergizers : [],
    // Ensure objects are objects
    completedSteps: (remoteState.completedSteps && typeof remoteState.completedSteps === 'object') ? remoteState.completedSteps : {},
    dayIntroSeen: (remoteState.dayIntroSeen && typeof remoteState.dayIntroSeen === 'object') ? remoteState.dayIntroSeen : {},
    // Ensure numbers are numbers
    energy: typeof remoteState.energy === 'number' ? remoteState.energy : INITIAL_ENERGY,
    currentDay: typeof remoteState.currentDay === 'number' ? remoteState.currentDay : 1,
  };
}

/**
 * Subscribe to class state changes in Firebase.
 * Returns unsubscribe function.
 * Callback is called with merged state (always valid shape).
 * Calls callback with null if no data exists (new class).
 */
export function subscribeToClass(className, callback) {
  try {
    const stateRef = ref(db, 'classes/' + className + '/state');
    const unsub = onValue(stateRef, (snap) => {
      try {
        const data = snap.val();
        if (data) {
          callback(mergeWithDefaults(data));
        } else {
          // New class — no data yet, signal with null
          callback(null);
        }
      } catch (err) {
        console.error('[firebasePersistence] Error processing class state:', err);
        callback(null);
      }
    }, (err) => {
      console.error('[firebasePersistence] Error subscribing to class:', err);
    });
    return unsub;
  } catch (err) {
    console.error('[firebasePersistence] Error setting up subscription:', err);
    return () => {};
  }
}

/**
 * Save class state to Firebase (debounced).
 * Strips volume (device-specific).
 */
export function saveClassState(className, state) {
  if (isRemoteUpdate) return;
  if (!className) return;

  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    try {
      const { volume, ...stateWithoutVolume } = state;
      // Ensure arrays stay as arrays for Firebase (convert empty to placeholder)
      const safeState = {
        ...stateWithoutVolume,
        completedDays: Array.isArray(stateWithoutVolume.completedDays) ? stateWithoutVolume.completedDays : [],
        usedEnergizers: Array.isArray(stateWithoutVolume.usedEnergizers) ? stateWithoutVolume.usedEnergizers : [],
      };
      const stateRef = ref(db, 'classes/' + className + '/state');
      set(stateRef, safeState)
        .then(() => {
          set(ref(db, 'classes/' + className + '/lastUpdated'), Date.now()).catch(() => {});
        })
        .catch((err) => {
          console.error('[firebasePersistence] Error saving class state:', err);
        });
    } catch (err) {
      console.error('[firebasePersistence] Error preparing save:', err);
    }
  }, DEBOUNCE_MS);
}

/**
 * List all class names from Firebase. Returns array of strings.
 */
export async function listClasses() {
  try {
    const snap = await get(ref(db, 'classes'));
    const data = snap.val();
    if (!data) return [];
    return Object.keys(data);
  } catch (err) {
    console.error('[firebasePersistence] Error listing classes:', err);
    return [];
  }
}

/**
 * Delete a class from Firebase.
 */
export function deleteClass(className) {
  try {
    return remove(ref(db, 'classes/' + className));
  } catch (err) {
    console.error('[firebasePersistence] Error deleting class:', err);
    return Promise.resolve();
  }
}

/**
 * Sanitize class name: trim, lowercase, replace spaces with hyphens, max 30 chars.
 */
export function sanitizeClassName(name) {
  return name.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 30);
}
