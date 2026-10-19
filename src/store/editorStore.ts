import { create } from 'zustand';
import { decode } from '../midi/decode';
import type { MidiMessage } from '../midi/encode';
import {
  paramByCc,
  type CalibrationLevelId,
  type ChoiceId,
  type ChoiceParamId,
  type EffectId,
  type EffectParamId,
  type ModuleId,
  type PerformanceActionId,
  type PerformanceControlId,
  type PresetParamId,
} from '../midi/map';
import { createThrottle } from '../midi/throttle';
import { pedalOutputToSelect } from '../midi/transport/ports';
import type { MidiPort } from '../midi/transport/types';
import { VIRTUAL_PEDAL_PORT, createVirtualPedal, type VirtualPedal } from '../midi/transport/virtual';
import { requestWebMidi, type WebMidi } from '../midi/transport/webmidi';
import { dispatch, encodeParam, initialEditorState, sendAllOrder, type EditorAction, type EditorState } from '../model/core';
import type { WorkingState } from '../model/state';
import { logSent, type SentMessage } from './monitor';

/** Continuous controls send at most one message per this many ms each, so a drag can't flood the pedal. */
const CONTINUOUS_SEND_MS = 5;

/** The gap between Send All messages, in ms. Hardware check 3 will find the smallest the pedal never drops. */
export const SEND_GAP_RANGE = { min: 0, max: 50 };
export const DEFAULT_SEND_GAP_MS = 5;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type WebMidiStatus = 'pending' | 'available' | 'unavailable';

type EditorStore = {
  /** Every change to it goes through the editor core's `dispatch`. */
  editor: EditorState;
  /** Sets a Working State control and sends it. */
  setParam(id: PresetParamId, value: number): void;
  /** Chooses a Module's Effect by name and sends it. */
  selectEffect<P extends EffectParamId>(id: P, effect: EffectId<P>): void;
  /** Engages or Bypasses a Module and sends it; its Effect stays selected. */
  setEngaged(module: ModuleId, engaged: boolean): void;
  /** Chooses a setting such as Filter style by name and sends it. */
  selectChoice<P extends ChoiceParamId>(id: P, choice: ChoiceId<P>): void;
  /** Presses one button of a Performance Control, such as Capture → Record; sent at once, never stored. */
  perform<C extends PerformanceControlId>(control: C, action: PerformanceActionId<C>): void;
  /** Sets the pedal-wide Calibration Level and sends it. */
  setCalibrationLevel(level: CalibrationLevelId): void;
  /** Starts a knob drag: every edit until `endDrag` undoes as one step. */
  beginDrag(): void;
  endDrag(): void;
  /** Steps back through Working State edits, re-sending what each restores so the pedal matches the screen. */
  undo(): void;
  redo(): void;
  /**
   * Sends every MIDI-reachable setting of the Working State, `sendGapMs` apart, then makes the Sync Status In Sync.
   * Resolves false if it was abandoned part-way: the output changed, a send failed, or another Send All began.
   */
  sendAll(): Promise<boolean>;
  /**
   * Makes `working` the Working State (an opened Preset, or New), then Sends All when an output is connected. Resolves
   * like `sendAll`, or false with no output.
   */
  loadWorking(working: WorkingState): Promise<boolean>;
  /**
   * Recalls a Slot on the pedal by its Program Change, 0–79: a Slot the Slot Map knows becomes the Working State.
   * False, sending nothing, with no output connected. Abandons a Send All, which would send over what the Slot holds.
   */
  recallSlot(slot: number): boolean;
  sendingAll: boolean;
  /** An output is connected and no Send All is running. */
  canSendAll(): boolean;
  /** The gap between Send All messages, in ms (Settings). */
  sendGapMs: number;
  setSendGapMs(ms: number): void;
  webMidi: WebMidi | null;
  webMidiStatus: WebMidiStatus;
  /** Virtual Pedal first, then every connected Web MIDI output. */
  outputs: MidiPort[];
  outputId: string;
  /** Outgoing messages for the MIDI Monitor, newest first. */
  sent: SentMessage[];
  /** A message typed in Raw MIDI, for hardware checks: sent to the selected output unchanged, never throttled. */
  sendRaw(bytes: MidiMessage): void;
  clearSent(): void;
  /** Sets the MIDI channel the editor sends on, 1–16. It must match the pedal's own, set in its Global Settings. */
  setMidiChannel(midiChannel: number): void;
  setOutput(id: string): void;
  isOutputConnected(): boolean;
  /** Asks the browser for Web MIDI once, then follows hot-plugging, selecting the pedal's USB port as it appears. */
  connectWebMidi(): Promise<void>;
};

/** Monitor times count from when the editor started. */
const startedAt = Date.now();

/** The Editor State and the connection to the pedal, sending to `virtualPedal` whenever it is the selected output. */
export function createEditorStore(virtualPedal: VirtualPedal) {
  /** Shared so React StrictMode's double effect asks the browser only once. */
  let webMidiRequest: Promise<void> | undefined;
  let nextSentId = 1;

  /** Bumped to abandon a Send All in progress (see `sendAll`). */
  let sendAllRun = 0;

  return create<EditorStore>((set, get) => {
    /** Every message the editor sends goes out here, and so into the MIDI Monitor. False if it didn't go out. */
    const sendToOutput = (bytes: MidiMessage): boolean => {
      const { outputId, webMidi } = get();
      try {
        if (outputId === VIRTUAL_PEDAL_PORT.id) virtualPedal.send(bytes);
        else webMidi?.send(bytes);
      } catch {
        abandonSendAll();
        apply({ type: 'sendFailed' });
        return false;
      }
      set((s) => ({ sent: logSent(s.sent, { id: nextSentId++, at: Date.now() - startedAt, bytes }) }));
      return true;
    };
    const continuousThrottle = createThrottle(CONTINUOUS_SEND_MS, sendToOutput);
    /** Paces continuous controls through the throttle, like a knob; everything else goes straight out. */
    const sendPaced = (bytes: MidiMessage) => {
      const msg = decode(bytes);
      const param = msg.kind === 'cc' ? paramByCc(msg.cc) : undefined;
      if (param?.kind === 'continuous') continuousThrottle.send(param.id, bytes);
      else sendToOutput(bytes);
    };
    /** Applies `action` with the editor core and sends what it says to. */
    const apply = (action: EditorAction) => {
      const { state, messages } = dispatch(get().editor, action);
      set({ editor: state });
      messages.forEach(sendPaced);
    };
    const abandonSendAll = () => {
      sendAllRun++;
      set({ sendingAll: false });
    };
    /** The selected output has just been chosen, plugged in or unplugged. */
    const onOutputChange = () => {
      abandonSendAll();
      apply({ type: get().isOutputConnected() ? 'outputConnected' : 'outputLost' });
    };

    const requestAndListen = async () => {
      const webMidi = await requestWebMidi();
      if (!webMidi) {
        set({ webMidiStatus: 'unavailable' });
        return;
      }
      // A new outputs array on every port change also re-renders the connection indicator.
      // Web MIDI has already changed by the time it reports a port change, so compare the outputs list instead.
      const selectedListed = () => get().outputs.some((p) => p.id === get().outputId);
      const refresh = () => {
        const before = get().outputs;
        const wasListed = selectedListed();
        const now = webMidi.listOutputs();
        set({ outputs: [VIRTUAL_PEDAL_PORT, ...now] });
        const pedal = pedalOutputToSelect({ before, now, selectedId: get().outputId });
        if (pedal) get().setOutput(pedal);
        else if (selectedListed() !== wasListed) onOutputChange();
      };
      webMidi.onPortsChange(refresh);
      set({ webMidi, webMidiStatus: 'available' });
      refresh();
    };

    return {
      // The Virtual Pedal is selected from the start.
      editor: dispatch(initialEditorState(), { type: 'outputConnected' }).state,
      setParam(id, value) {
        apply({ type: 'setParam', id, value });
      },
      selectEffect(id, effect) {
        apply({ type: 'selectEffect', id, effect });
      },
      setEngaged(module, engaged) {
        apply({ type: 'setEngaged', module, engaged });
      },
      selectChoice(id, choice) {
        apply({ type: 'selectChoice', id, choice });
      },
      perform(control, action) {
        apply({ type: 'perform', control, action });
      },
      setCalibrationLevel(level) {
        apply({ type: 'setCalibrationLevel', level });
      },
      beginDrag() {
        apply({ type: 'beginDrag' });
      },
      endDrag() {
        apply({ type: 'endDrag' });
      },
      undo() {
        apply({ type: 'undo' });
      },
      redo() {
        apply({ type: 'redo' });
      },
      loadWorking(working) {
        apply({ type: 'loadWorking', working });
        if (get().isOutputConnected()) return get().sendAll();
        abandonSendAll();
        return Promise.resolve(false);
      },
      recallSlot(slot) {
        if (!get().isOutputConnected()) return false;
        abandonSendAll();
        apply({ type: 'recallSlot', slot });
        return true;
      },
      async sendAll() {
        const run = ++sendAllRun;
        set({ sendingAll: true });
        for (const [i, id] of sendAllOrder().entries()) {
          if (i > 0) await sleep(get().sendGapMs);
          if (run !== sendAllRun) return false;
          // Read the latest state each step, so an edit made part-way isn't overwritten with an older value.
          if (!sendToOutput(encodeParam(get().editor, id))) return false;
        }
        set({ sendingAll: false });
        apply({ type: 'sendAllFinished' });
        return true;
      },
      sendingAll: false,
      canSendAll() {
        return get().isOutputConnected() && !get().sendingAll;
      },
      sendGapMs: DEFAULT_SEND_GAP_MS,
      setSendGapMs(sendGapMs) {
        set({ sendGapMs });
      },
      webMidi: null,
      webMidiStatus: 'pending',
      outputs: [VIRTUAL_PEDAL_PORT],
      outputId: VIRTUAL_PEDAL_PORT.id,
      sent: [],
      sendRaw(bytes) {
        if (sendToOutput(bytes)) apply({ type: 'rawSent' });
      },
      clearSent() {
        set({ sent: [] });
      },
      setMidiChannel(midiChannel) {
        apply({ type: 'setMidiChannel', midiChannel });
      },
      setOutput(id) {
        get().webMidi?.selectOutput(id === VIRTUAL_PEDAL_PORT.id ? null : id);
        set({ outputId: id });
        onOutputChange();
      },
      isOutputConnected() {
        const { outputId, webMidi } = get();
        return outputId === VIRTUAL_PEDAL_PORT.id || !!webMidi?.isConnected(outputId);
      },
      connectWebMidi() {
        webMidiRequest ??= requestAndListen();
        return webMidiRequest;
      },
    };
  });
}

export const virtualPedal = createVirtualPedal();

export const useEditorStore = createEditorStore(virtualPedal);
