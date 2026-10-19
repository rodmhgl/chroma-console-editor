import { controlChange, programChange, type MidiMessage } from '../midi/encode';
import {
  CALIBRATION_LEVEL,
  PARAMS,
  PRESET_PARAMS,
  clampToParam,
  ENGAGED_PARAMS,
  isEngaged,
  moduleOrderIndex,
  PEDAL_STEP_PARAMS,
  performanceAction,
  slotAddress,
  type CalibrationLevelId,
  type CcParamId,
  type ChoiceId,
  type ChoiceParamId,
  type EffectId,
  type EffectParamId,
  type ModuleId,
  type ParamDef,
  type PedalStepParamId,
  type PerformanceActionId,
  type PerformanceControlId,
  type PresetParamId,
} from '../midi/map';
import * as history from './history';
import { EMPTY_SLOT_MAP, type SlotMap } from './slotMap';
import { defaultGlobalSettings, defaultWorkingState, type GlobalSettings, type WorkingState } from './state';
import { INITIAL_SYNC_STATUS, nextSyncStatus, type SyncEvent, type SyncStatus } from './sync';

// The editor core (SPEC.md, Implementation Decisions): every change to the Editor State is one pure transition, which
// also says what MIDI to send. The store only applies it and does the sending.

/** Everything the editor believes about and controls on the pedal. */
export type EditorState = {
  working: WorkingState;
  global: GlobalSettings;
  /** Undo/redo for Working State edits. */
  history: history.History;
  /** How far the editor trusts the MIDI-reachable settings; `syncStatus` adds the Pedal Step settings. */
  midiSync: SyncStatus;
  /**
   * Each Pedal Step setting's value as the user last confirmed applying it on the pedal. Assumed to be the default
   * until then, like a new Preset.
   */
  confirmed: Record<PedalStepParamId, number>;
  /** What the editor believes each Slot holds: what it last committed there. Never confirmed by the pedal. */
  slotMap: SlotMap;
};

export type EditorAction =
  /** Any Working State param, clamped into its range. */
  | { type: 'setParam'; id: PresetParamId; value: number }
  /** A Module's Effect by name: sends the midpoint of its CC range. */
  | { type: 'selectEffect'; id: EffectParamId; effect: EffectId }
  /** Engages or Bypasses a Module; its Effect stays selected either way. */
  | { type: 'setEngaged'; module: ModuleId; engaged: boolean }
  /** A setting such as Filter style by name: sends that choice's value. */
  | { type: 'selectChoice'; id: ChoiceParamId; choice: ChoiceId }
  /**
   * A whole new Working State (an opened Preset, or New), clamped. Sends nothing: the store follows it with Send All,
   * and it is Possibly Stale until that finishes. Clears the undo history, whose steps belong to the old one.
   */
  | { type: 'loadWorking'; working: WorkingState }
  /**
   * Recalls a Slot on the pedal by its Program Change, 0–79. A Slot in the Slot Map makes its committed state the
   * Working State; any other leaves the Working State alone, no longer what the pedal sounds.
   */
  | { type: 'recallSlot'; slot: number }
  /** Module Order, a Pedal Step setting: sends nothing and needs its Pedal Step confirming. Ignored unless all four Modules. */
  | { type: 'setModuleOrder'; order: ModuleId[] }
  /** The user has performed the Pedal Step for a setting, so the pedal now holds its Working State value. Not undoable. */
  | { type: 'confirmPedalStep'; id: PedalStepParamId }
  /** The MIDI channel the editor sends on. Sends nothing and isn't undoable; a change makes the Sync Status Possibly Stale. */
  | { type: 'setMidiChannel'; midiChannel: number }
  /** One button of a Performance Control, such as Capture → Record: sends it and changes nothing in the Editor State. */
  | { type: 'perform'; control: PerformanceControlId; action: PerformanceActionId }
  /** The pedal-wide Calibration Level, a Global Setting applied to every Preset. Not undoable. */
  | { type: 'setCalibrationLevel'; level: CalibrationLevelId }
  /** Starts a knob drag: every edit until `endDrag` undoes as one step. */
  | { type: 'beginDrag' }
  | { type: 'endDrag' }
  /** Restores the Working State controls the last step changed, re-sending them so the pedal matches the screen. */
  | { type: 'undo' }
  | { type: 'redo' }
  /** The selected output has become reachable. */
  | { type: 'outputConnected' }
  /** The selected output has gone away. */
  | { type: 'outputLost' }
  /** Every message of `encodeSendAll` went out. */
  | { type: 'sendAllFinished' }
  /** A message the editor sent didn't reach the output. */
  | { type: 'sendFailed' }
  /** A message typed in Raw MIDI went out, which may have changed anything. */
  | { type: 'rawSent' };

export type CoreResult = { state: EditorState; messages: MidiMessage[] };

export function initialEditorState(): EditorState {
  const working = defaultWorkingState();
  return {
    working,
    global: defaultGlobalSettings(),
    history: history.EMPTY_HISTORY,
    midiSync: INITIAL_SYNC_STATUS,
    confirmed: pedalStepValues(working),
    slotMap: EMPTY_SLOT_MAP,
  };
}

/** The Pedal Step settings of a Working State. */
function pedalStepValues(working: WorkingState): Record<PedalStepParamId, number> {
  return Object.fromEntries(PEDAL_STEP_PARAMS.map((id) => [id, working[id]])) as Record<PedalStepParamId, number>;
}

/** The Pedal Step settings whose Working State value the user hasn't confirmed applying on the pedal. */
export function unconfirmedPedalSteps(state: Pick<EditorState, 'working' | 'confirmed'>): PedalStepParamId[] {
  return PEDAL_STEP_PARAMS.filter((id) => state.working[id] !== state.confirmed[id]);
}

/** How far the editor trusts that the pedal is sounding the Working State: an unconfirmed Pedal Step spoils In Sync. */
export function syncStatus(state: EditorState): SyncStatus {
  return state.midiSync === 'inSync' && unconfirmedPedalSteps(state).length > 0 ? 'possiblyStale' : state.midiSync;
}

/** The Editor State after `action`, and the MIDI to send for it. */
export function dispatch(state: EditorState, action: EditorAction): CoreResult {
  switch (action.type) {
    case 'setParam':
      return setParam(state, action.id, action.value);
    case 'selectEffect': {
      const effect = PARAMS[action.id].effects.find((e) => e.id === action.effect);
      if (!effect) return { state, messages: [] };
      return setParam(state, action.id, effect.value);
    }
    case 'setEngaged':
      return selectChoice(state, ENGAGED_PARAMS[action.module], action.engaged ? 'engaged' : 'bypassed');
    case 'selectChoice':
      return selectChoice(state, action.id, action.choice);
    case 'loadWorking': {
      const working = Object.fromEntries(
        PRESET_PARAMS.map((p) => [p.id, clampToParam(p, action.working[p.id as PresetParamId])]),
      ) as WorkingState;
      return { state: sync({ ...state, working, history: history.EMPTY_HISTORY }, 'load'), messages: [] };
    }
    case 'recallSlot': {
      if (!slotAddress(action.slot)) return { state, messages: [] };
      const entry = state.slotMap[action.slot];
      // Earlier steps belong to the state the Slot replaced: undoing one would send a single CC into it.
      const recalled = { ...state, working: entry?.committed ?? state.working, history: history.EMPTY_HISTORY };
      // The Slot was committed with its Pedal Steps done, so the pedal now holds its Pedal Step settings too.
      if (entry) recalled.confirmed = pedalStepValues(entry.committed);
      return {
        state: sync(recalled, entry ? 'recallKnown' : 'recallUnknown'),
        messages: [programChange(state.global.midiChannel, action.slot)],
      };
    }
    case 'setModuleOrder': {
      const index = moduleOrderIndex(action.order);
      if (index === undefined) return { state, messages: [] };
      return setParam(state, 'moduleOrder', index);
    }
    case 'confirmPedalStep':
      return { state: { ...state, confirmed: { ...state.confirmed, [action.id]: state.working[action.id] } }, messages: [] };
    case 'setMidiChannel': {
      if (action.midiChannel === state.global.midiChannel) return { state, messages: [] };
      const next = { ...state, global: { ...state.global, midiChannel: action.midiChannel } };
      return { state: sync(next, 'midiChannel'), messages: [] };
    }
    case 'perform': {
      const performed = performanceAction(action.control, action.action);
      if (!performed) return { state, messages: [] };
      return { state, messages: [controlChange(state.global.midiChannel, performed.cc, performed.value)] };
    }
    case 'setCalibrationLevel': {
      const level = CALIBRATION_LEVEL.choices.find((c) => c.id === action.level);
      if (!level) return { state, messages: [] };
      return {
        state: { ...state, global: { ...state.global, calibrationLevel: level.id } },
        messages: [controlChange(state.global.midiChannel, CALIBRATION_LEVEL.cc, level.value)],
      };
    }
    case 'beginDrag':
      return { state: { ...state, history: history.beginDrag(state.history) }, messages: [] };
    case 'endDrag':
      return { state: { ...state, history: history.endDrag(state.history) }, messages: [] };
    case 'undo':
    case 'redo': {
      const move = action.type === 'undo' ? history.undo(state.history) : history.redo(state.history);
      if (!move) return { state, messages: [] };
      let next: EditorState = { ...state, history: move.history };
      const messages: MidiMessage[] = [];
      for (const [id, value] of Object.entries(move.values) as [PresetParamId, number][]) {
        const result = setParam(next, id, value, false);
        next = result.state;
        messages.push(...result.messages);
      }
      return { state: next, messages };
    }
    case 'outputConnected':
      return { state: sync(state, 'connect'), messages: [] };
    case 'outputLost':
      return { state: sync(state, 'disconnect'), messages: [] };
    case 'sendAllFinished':
      return { state: sync(state, 'sendAll'), messages: [] };
    case 'sendFailed':
      return { state: sync(state, 'sendFailed'), messages: [] };
    case 'rawSent':
      return { state: sync(state, 'rawMidi'), messages: [] };
  }
}

function sync(state: EditorState, event: SyncEvent): EditorState {
  return { ...state, midiSync: nextSyncStatus(state.midiSync, event) };
}

function selectChoice(state: EditorState, id: ChoiceParamId, choiceId: string): CoreResult {
  const choice = (PARAMS[id] as ParamDef).choices!.find((c) => c.id === choiceId);
  if (!choice) return { state, messages: [] };
  return setParam(state, id, choice.value);
}

function setParam(state: EditorState, id: PresetParamId, value: number, undoable = true): CoreResult {
  const param: ParamDef = PARAMS[id];
  const v = clampToParam(param, value);
  const working = { ...state.working, [id]: v };
  const recorded = undoable ? history.record(state.history, id, state.working[id], v) : state.history;
  // MIDI can't reach a Pedal Step setting: until the user confirms its Pedal Step, `syncStatus` says so.
  if (param.transport === 'pedalStep') return { state: { ...state, working, history: recorded }, messages: [] };
  const next = sync(
    {
      ...state,
      working,
      history: recorded,
    },
    'edit',
  );
  const messages = [encodeParam(next, id as CcParamId)];
  // Whether the pedal engages a Bypassed Module when its Effect changes is unknown (hardware check 7), so the editor
  // says Bypassed again rather than risk the pedal and the editor disagreeing.
  if (param.kind === 'effect' && param.module && !isEngaged(next.working, param.module)) {
    messages.push(encodeParam(next, ENGAGED_PARAMS[param.module]));
  }
  return { state: next, messages };
}

/** One Working State control as the CC that sets it on the pedal. */
export function encodeParam(state: EditorState, id: CcParamId): MidiMessage {
  return controlChange(state.global.midiChannel, PARAMS[id].cc, state.working[id]);
}

/** Send All goes group by group in this order, each group in pedal map order (SPEC.md, Implementation Decisions). */
const SEND_ALL_GROUPS: ParamDef['group'][] = ['effect', 'fxSetup', 'primary', 'secondary', 'engaged'];

/** Every Working State setting in the order Send All transmits it. */
export function sendAllOrder(): CcParamId[] {
  return SEND_ALL_GROUPS.flatMap((group) => PRESET_PARAMS.filter((p) => p.group === group && p.transport === 'cc').map((p) => p.id as CcParamId));
}

/** The full Working State as MIDI, in Send All order. */
export function encodeSendAll(state: EditorState): MidiMessage[] {
  return sendAllOrder().map((id) => encodeParam(state, id));
}
