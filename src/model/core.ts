import { controlChange, type MidiMessage } from '../midi/encode';
import {
  CALIBRATION_LEVEL,
  PARAMS,
  PERFORMANCE_CONTROLS,
  clampToParam,
  ENGAGED_PARAMS,
  isEngaged,
  type ChoiceId,
  type ChoiceParamId,
  type EffectId,
  type EffectParamId,
  type ModuleId,
  type CalibrationLevelId,
  type ParamDef,
  type PerformanceActionId,
  type PerformanceControlDef,
  type PerformanceControlId,
  type PresetParamId,
} from '../midi/map';
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
  /** Engages or Bypasses a Module; its Effect stays selected either way. */
  | { type: 'setEngaged'; module: ModuleId; engaged: boolean }
  /** A setting such as Filter style by name: sends that choice's value. */
  | { type: 'selectChoice'; id: ChoiceParamId; choice: ChoiceId }
  /** The MIDI channel the editor sends on. Sends nothing. */
  | { type: 'setMidiChannel'; midiChannel: number }
  /** One button of a Performance Control, such as Capture → Record: sends it and changes nothing in the Editor State. */
  | { type: 'perform'; control: PerformanceControlId; action: PerformanceActionId }
  /** The pedal-wide Calibration Level, a Global Setting applied to every Preset. */
  | { type: 'setCalibrationLevel'; level: CalibrationLevelId };

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
    case 'setEngaged':
      return selectChoice(state, ENGAGED_PARAMS[action.module], action.engaged ? 'engaged' : 'bypassed');
    case 'selectChoice':
      return selectChoice(state, action.id, action.choice);
    case 'setMidiChannel':
      return { state: { ...state, global: { ...state.global, midiChannel: action.midiChannel } }, messages: [] };
    case 'perform': {
      const control: PerformanceControlDef = PERFORMANCE_CONTROLS[action.control];
      const performed = control.actions.find((a) => a.id === action.action);
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
  }
}

function selectChoice(state: EditorState, id: ChoiceParamId, choiceId: string): CoreResult {
  const choice = (PARAMS[id] as ParamDef).choices!.find((c) => c.id === choiceId);
  if (!choice) return { state, messages: [] };
  return setParam(state, id, choice.value);
}

function setParam(state: EditorState, id: PresetParamId, value: number): CoreResult {
  const param: ParamDef = PARAMS[id];
  const v = clampToParam(param, value);
  const next = { ...state, working: { ...state.working, [id]: v } };
  const messages = [encodeParam(next, id)];
  // Whether the pedal engages a Bypassed Module when its Effect changes is unknown (hardware check 7), so the editor
  // says Bypassed again rather than risk the pedal and the editor disagreeing.
  if (param.kind === 'effect' && param.module && !isEngaged(next.working, param.module)) {
    messages.push(encodeParam(next, ENGAGED_PARAMS[param.module]));
  }
  return { state: next, messages };
}

/** One Working State control as the CC that sets it on the pedal. */
function encodeParam(state: EditorState, id: PresetParamId): MidiMessage {
  return controlChange(state.global.midiChannel, PARAMS[id].cc, state.working[id]);
}
