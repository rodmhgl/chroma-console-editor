import type { PresetParamId } from '../midi/map';
import type { WorkingState } from './state';

// Undo/redo for Working State edits (SPEC.md stories 36–37). Each step keeps only the controls it changed,
// so undoing it leaves every other control alone. Raw MIDI isn't recorded: undoing an edit to the same
// control afterwards still restores the value from before that edit.

type Step = Partial<Record<PresetParamId, { before: number; after: number }>>;

export type History = {
  past: Step[];
  future: Step[];
  /** A knob drag is under way: its edits all go into one step. */
  dragging: boolean;
  /** The last step in `past` belongs to the open drag, so further edits merge into it. */
  merging: boolean;
};

export const EMPTY_HISTORY: History = { past: [], future: [], dragging: false, merging: false };

/** Oldest steps are dropped beyond this. */
export const HISTORY_LIMIT = 200;

/** What an undo or redo sets: each changed control and the value to give it. */
export type HistoryMove = { history: History; values: Partial<WorkingState> };

export const canUndo = (h: History) => h.past.length > 0;
export const canRedo = (h: History) => h.future.length > 0;

/** Records a Working State edit, as a new step or, within a drag, merged into the drag's step. */
export function record(h: History, id: PresetParamId, before: number, after: number): History {
  if (before === after) return h;
  if (h.merging) {
    const step = { ...h.past[h.past.length - 1] };
    const merged = { before: step[id]?.before ?? before, after };
    if (merged.before === merged.after) delete step[id];
    else step[id] = merged;
    const past = h.past.slice(0, -1);
    // A drag that ends where it began leaves nothing to undo; its next edit starts the step again.
    if (Object.keys(step).length === 0) return { ...h, past, merging: false };
    return { ...h, past: [...past, step] };
  }
  return { ...pushStep(h, { [id]: { before, after } }), merging: h.dragging };
}

/** Records a change to many controls at once, such as adopting a Snapshot, as one step of every control it changed. */
export function recordAll(h: History, before: WorkingState, after: WorkingState): History {
  const step: Step = {};
  for (const id of Object.keys(after) as PresetParamId[]) {
    if (before[id] !== after[id]) step[id] = { before: before[id], after: after[id] };
  }
  if (Object.keys(step).length === 0) return h;
  return { ...pushStep(h, step), merging: false };
}

/** Adds a new step, dropping the oldest beyond the limit; it replaces anything there was to redo. */
function pushStep(h: History, step: Step): History {
  return { ...h, past: [...h.past, step].slice(-HISTORY_LIMIT), future: [] };
}

export function beginDrag(h: History): History {
  return { ...h, dragging: true, merging: false };
}

export function endDrag(h: History): History {
  return { ...h, dragging: false, merging: false };
}

export function undo(h: History): HistoryMove | null {
  const step = h.past[h.past.length - 1];
  if (!step) return null;
  return {
    // Mid-drag, the rest of the drag becomes one new step.
    history: { ...h, past: h.past.slice(0, -1), future: [step, ...h.future], merging: false },
    values: valuesOf(step, 'before'),
  };
}

export function redo(h: History): HistoryMove | null {
  const [step, ...future] = h.future;
  if (!step) return null;
  return {
    history: { ...h, past: [...h.past, step], future, merging: false },
    values: valuesOf(step, 'after'),
  };
}

function valuesOf(step: Step, side: 'before' | 'after'): Partial<WorkingState> {
  return Object.fromEntries(Object.entries(step).map(([id, change]) => [id, change[side]]));
}
