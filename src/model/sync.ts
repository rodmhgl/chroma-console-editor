// How far the editor trusts that the pedal is sounding the Working State (SPEC.md, Implementation Decisions). The pedal
// sends no MIDI (ADR 0001), so these rules are all the editor has.

export type SyncStatus = 'inSync' | 'possiblyStale' | 'unknown';

/** What can move the Sync Status. */
export type SyncEvent =
  /** Every MIDI-reachable setting reached the pedal. */
  | 'sendAll'
  /** An output has become reachable: the pedal on it may hold anything. */
  | 'connect'
  /** The output went away, so nothing the editor sends arrives. */
  | 'disconnect'
  /** A message didn't reach the output. */
  | 'sendFailed'
  /** A Raw MIDI message went out, which may have changed anything. */
  | 'rawMidi'
  /** The editor now sends on another MIDI channel, which the pedal may not listen on. */
  | 'midiChannel'
  /** One Working State setting sent live. */
  | 'edit'
  /** A whole new Working State (an opened Preset, or New): the pedal holds the old one until Send All finishes. */
  | 'load'
  /** The last session taken up at launch: the pedal may have been changed since. */
  | 'restore'
  /** A Slot recalled whose Slot Map entry the Working State now is. */
  | 'recallKnown'
  /** A Slot recalled that the Slot Map has no entry for: the pedal now sounds something the editor can't know. */
  | 'recallUnknown';

export const SYNC_STATUS_LABELS: Record<SyncStatus, string> = {
  inSync: 'In Sync',
  possiblyStale: 'Possibly Stale',
  unknown: 'Unknown',
};

/** No output is selected yet. */
export const INITIAL_SYNC_STATUS: SyncStatus = 'unknown';

export function nextSyncStatus(status: SyncStatus, event: SyncEvent): SyncStatus {
  switch (event) {
    case 'sendAll':
      return 'inSync';
    case 'connect':
    // The Slot replaces whatever the pedal was sounding with what the editor committed there, but the pedal never
    // confirmed that, and it may not keep every setting in a Slot (hardware check 6).
    case 'recallKnown':
      return 'possiblyStale';
    case 'disconnect':
    case 'recallUnknown':
      return 'unknown';
    case 'sendFailed':
    case 'rawMidi':
    case 'midiChannel':
    case 'load':
    case 'restore':
      // Unknown already trusts nothing.
      return status === 'unknown' ? status : 'possiblyStale';
    case 'edit':
      // A single edit only fixes one setting, so it can never earn trust it didn't have.
      return status;
  }
}
