import { create } from 'zustand';
import { decode } from '../midi/decode';
import type { MidiMessage } from '../midi/encode';
import { paramByCc, type ChoiceId, type ChoiceParamId, type EffectId, type EffectParamId, type ModuleId, type PresetParamId } from '../midi/map';
import { createThrottle } from '../midi/throttle';
import { pedalOutputToSelect } from '../midi/transport/ports';
import type { MidiPort } from '../midi/transport/types';
import { VIRTUAL_PEDAL_PORT, createVirtualPedal, type VirtualPedal } from '../midi/transport/virtual';
import { requestWebMidi, type WebMidi } from '../midi/transport/webmidi';
import { dispatch, initialEditorState, type EditorAction, type EditorState } from '../model/core';
import { logSent, type SentMessage } from './monitor';

/** Continuous controls send at most one message per this many ms each, so a drag can't flood the pedal. */
const CONTINUOUS_SEND_MS = 5;

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

  return create<EditorStore>((set, get) => {
    /** Every message the editor sends goes out here, and so into the MIDI Monitor. */
    const sendToOutput = (bytes: MidiMessage) => {
      const { outputId, webMidi } = get();
      if (outputId === VIRTUAL_PEDAL_PORT.id) virtualPedal.send(bytes);
      else webMidi?.send(bytes);
      set((s) => ({ sent: logSent(s.sent, { id: nextSentId++, at: Date.now() - startedAt, bytes }) }));
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

    const requestAndListen = async () => {
      const webMidi = await requestWebMidi();
      if (!webMidi) {
        set({ webMidiStatus: 'unavailable' });
        return;
      }
      // A new outputs array on every port change also re-renders the connection indicator.
      const refresh = () => {
        const before = get().outputs;
        const now = webMidi.listOutputs();
        set({ outputs: [VIRTUAL_PEDAL_PORT, ...now] });
        const pedal = pedalOutputToSelect({ before, now, selectedId: get().outputId });
        if (pedal) get().setOutput(pedal);
      };
      webMidi.onPortsChange(refresh);
      set({ webMidi, webMidiStatus: 'available' });
      refresh();
    };

    return {
      editor: initialEditorState(),
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
      webMidi: null,
      webMidiStatus: 'pending',
      outputs: [VIRTUAL_PEDAL_PORT],
      outputId: VIRTUAL_PEDAL_PORT.id,
      sent: [],
      sendRaw: sendToOutput,
      clearSent() {
        set({ sent: [] });
      },
      setMidiChannel(midiChannel) {
        apply({ type: 'setMidiChannel', midiChannel });
      },
      setOutput(id) {
        get().webMidi?.selectOutput(id === VIRTUAL_PEDAL_PORT.id ? null : id);
        set({ outputId: id });
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
