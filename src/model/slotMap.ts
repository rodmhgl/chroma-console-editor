import type { PresetParamId } from '../midi/map';
import type { Preset } from './schema';
import type { WorkingState } from './state';

// The Slot Map: the editor's belief about what each Slot holds (CONTEXT.md). The pedal never confirms it.

/**
 * What the editor last committed to a Slot. `presetId` links the Preset it came from, if any; `name` is that Preset's
 * name when committed (or "Untitled"), kept so the Slot still has a name once the Preset is deleted.
 */
export type SlotMapEntry = { committed: WorkingState; presetId: string | null; name: string };

/** A Slot's Program Change, 0–79 → entry. A Slot with no entry is one the editor knows nothing about. */
export type SlotMap = Partial<Record<number, SlotMapEntry>>;

export const EMPTY_SLOT_MAP: SlotMap = {};

/**
 * Whether the linked Preset's params have moved on since the Slot was committed. A rename or a notes or tags edit
 * doesn't count. `preset` is the linked Preset, or undefined if there is none (or it was deleted).
 */
export function isChangedSinceCommit(entry: SlotMapEntry, preset: Preset | undefined): boolean {
  if (!preset) return false;
  return (Object.keys(entry.committed) as PresetParamId[]).some((id) => preset.params[id] !== entry.committed[id]);
}

/** The linked Preset's current name, or the name the Slot was committed with. */
export function slotName(entry: SlotMapEntry, preset: Preset | undefined): string {
  return preset?.name ?? entry.name;
}
