import { create } from 'zustand';
import { DEFAULT_MIDI_CHANNEL } from '../midi/map';
import { pedalOutputToSelect } from '../midi/transport/ports';
import type { MidiPort } from '../midi/transport/types';
import { VIRTUAL_PEDAL_PORT, createVirtualPedal } from '../midi/transport/virtual';
import { requestWebMidi, type WebMidi } from '../midi/transport/webmidi';

export type WebMidiStatus = 'pending' | 'available' | 'unavailable';

type EditorStore = {
  webMidi: WebMidi | null;
  webMidiStatus: WebMidiStatus;
  /** Virtual Pedal first, then every connected Web MIDI output. */
  outputs: MidiPort[];
  outputId: string;
  /** The MIDI channel the editor sends on, 1–16. It must match the pedal's own, set in its Global Settings. */
  midiChannel: number;
  setMidiChannel(midiChannel: number): void;
  setOutput(id: string): void;
  isOutputConnected(): boolean;
  /** Asks the browser for Web MIDI once, then follows hot-plugging, selecting the pedal's USB port as it appears. */
  connectWebMidi(): Promise<void>;
};

/** The editor's connection to the pedal: its outputs, the selected one and the MIDI channel. */
export function createEditorStore() {
  /** Shared so React StrictMode's double effect asks the browser only once. */
  let webMidiRequest: Promise<void> | undefined;

  return create<EditorStore>((set, get) => {
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
      webMidi: null,
      webMidiStatus: 'pending',
      outputs: [VIRTUAL_PEDAL_PORT],
      outputId: VIRTUAL_PEDAL_PORT.id,
      midiChannel: DEFAULT_MIDI_CHANNEL,
      setMidiChannel(midiChannel) {
        set({ midiChannel });
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

export const useEditorStore = createEditorStore();
