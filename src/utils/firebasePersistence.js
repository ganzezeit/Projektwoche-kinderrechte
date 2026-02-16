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
 * Prepare state for Firebase: strip volume, ensure arrays/objects.
 */
function prepareSafeState(state) {
  const { volume, ...stateWithoutVolume } = state;
  return {
    ...stateWithoutVolume,
    completedDays: Array.isArray(stateWithoutVolume.completedDays) ? stateWithoutVolume.completedDays : [],
    usedEnergizers: Array.isArray(stateWithoutVolume.usedEnergizers) ? stateWithoutVolume.usedEnergizers : [],
  };
}

/**
 * Save class state to Firebase (debounced).
 * Strips volume (device-specific).
 * Optional 3rd param: callback({ success, timestamp }) called after save completes/fails.
 */
export function saveClassState(className, state, onSaveResult) {
  if (isRemoteUpdate) return;
  if (!className) return;

  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    try {
      const safeState = prepareSafeState(state);
      const stateRef = ref(db, 'classes/' + className + '/state');
      const timestamp = Date.now();
      set(stateRef, safeState)
        .then(() => {
          set(ref(db, 'classes/' + className + '/lastUpdated'), timestamp).catch(() => {});
          if (onSaveResult) onSaveResult({ success: true, timestamp });
        })
        .catch((err) => {
          console.error('[firebasePersistence] Error saving class state:', err);
          if (onSaveResult) onSaveResult({ success: false, timestamp: null });
        });
    } catch (err) {
      console.error('[firebasePersistence] Error preparing save:', err);
      if (onSaveResult) onSaveResult({ success: false, timestamp: null });
    }
  }, DEBOUNCE_MS);
}

/**
 * Immediate (non-debounced) save. Cancels any pending debounce timer.
 * Returns Promise<boolean>.
 */
export async function forceSaveClassState(className, state) {
  if (!className) return false;
  if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
  try {
    const safeState = prepareSafeState(state);
    const stateRef = ref(db, 'classes/' + className + '/state');
    const timestamp = Date.now();
    await set(stateRef, safeState);
    await set(ref(db, 'classes/' + className + '/lastUpdated'), timestamp);
    return true;
  } catch (err) {
    console.error('[firebasePersistence] Error force-saving:', err);
    return false;
  }
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
 * List all classes with details: { name, lastUpdated, state }.
 * Sorted by lastUpdated descending (most recent first).
 */
export async function listClassesWithDetails() {
  try {
    const snap = await get(ref(db, 'classes'));
    const data = snap.val();
    if (!data) return [];
    return Object.entries(data)
      .map(([name, val]) => ({
        name,
        lastUpdated: val?.lastUpdated || null,
        state: mergeWithDefaults(val?.state),
      }))
      .sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));
  } catch (err) {
    console.error('[firebasePersistence] Error listing classes with details:', err);
    return [];
  }
}

/**
 * Get lastUpdated timestamp for a class. Returns number or null.
 */
export async function getLastUpdated(className) {
  try {
    const snap = await get(ref(db, 'classes/' + className + '/lastUpdated'));
    return snap.val() || null;
  } catch (err) {
    console.error('[firebasePersistence] Error getting lastUpdated:', err);
    return null;
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

/**
 * Save task timing (startedAt or completedAt) for a step.
 * field = 'startedAt' | 'completedAt'
 * startedAt is only written if not already set (no overwrite).
 */
export async function saveTaskTiming(className, stepId, field) {
  if (!className || !stepId) return;
  try {
    const timingRef = ref(db, 'classes/' + className + '/taskTimings/' + stepId + '/' + field);
    if (field === 'startedAt') {
      const snap = await get(timingRef);
      if (snap.val()) return; // already set
    }
    await set(timingRef, Date.now());
  } catch (err) {
    console.error('[firebasePersistence] Error saving task timing:', err);
  }
}

/**
 * Get all task timings for a class.
 * Returns { [stepId]: { startedAt?, completedAt? } }
 */
export async function getTaskTimings(className) {
  if (!className) return {};
  try {
    const snap = await get(ref(db, 'classes/' + className + '/taskTimings'));
    return snap.val() || {};
  } catch (err) {
    console.error('[firebasePersistence] Error getting task timings:', err);
    return {};
  }
}
