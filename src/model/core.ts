import { controlChange, type MidiMessage } from '../midi/encode';
import { PARAMS, clampToParam, type EffectId, type EffectParamId, type ParamDef, type PresetParamId } from '../midi/map';
import { defaultGlobalSettings, defaultWorkingState, type GlobalSettings, type WorkingState } from './state';

// The editor core (SPEC.md, Implementation Decisions): every change to the Editor State is one pure transition, which
// also says what MIDI to send. The store only applies it and does the sending.

/** Everything the editor believes about and controls on the pedal. Sync Status, Slot Map and history arrive later. */
export type EditorState = {
  working: WorkingState;
  global: GlobalSettings;
};

export type EditorAction =
  /** Any Working State param, clamped into its range. */
  | { type: 'setParam'; id: PresetParamId; value: number }
  /** A Module's Effect by name: sends the midpoint of its CC range. */
  | { type: 'selectEffect'; id: EffectParamId; effect: EffectId }
  /** The MIDI channel the editor sends on. Sends nothing. */
  | { type: 'setMidiChannel'; midiChannel: number };

export type CoreResult = { state: EditorState; messages: MidiMessage[] };

export function initialEditorState(): EditorState {
  return { working: defaultWorkingState(), global: defaultGlobalSettings() };
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
    case 'setMidiChannel':
      return { state: { ...state, global: { ...state.global, midiChannel: action.midiChannel } }, messages: [] };
  }
}

function setParam(state: EditorState, id: PresetParamId, value: number): CoreResult {
  const param: ParamDef = PARAMS[id];
  const v = clampToParam(param, value);
  const next = { ...state, working: { ...state.working, [id]: v } };
  return { state: next, messages: [encodeParam(next, id)] };
}

/** One Working State control as the CC that sets it on the pedal. */
function encodeParam(state: EditorState, id: PresetParamId): MidiMessage {
  return controlChange(state.global.midiChannel, PARAMS[id].cc, state.working[id]);
}
