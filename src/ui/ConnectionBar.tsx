import { useEffect, useId } from 'react';
import { UPDATE_WAITING_HELP, useAppStore } from '../store/appStore';
import { useEditorStore } from '../store/editorStore';
import { useLayoutStore } from '../store/layoutStore';
import { DATA_BUTTON_ID, DATA_DRAWER_ID } from './domIds';
import { MIDI_CHANNELS, midiChannelLabel } from './midiChannels';

/** How to find the pedal's own MIDI channel, for when edits aren't heard. */
export const MIDI_CHANNEL_HINT =
  'Must match the pedal’s. To check it, press A, B, C and D together to open the pedal’s Global Settings: the TILT knob sets its MIDI channel (1 by default).';

/** The top bar: output, MIDI channel, connection indicator and the Data drawer button. */
export function ConnectionBar() {
  const { outputs, outputId, midiChannel, setOutput, setMidiChannel, connectWebMidi } = useEditorStore();
  const drawerOpen = useLayoutStore((s) => s.drawerOpen);
  const toggleDrawer = useLayoutStore((s) => s.toggleDrawer);
  // Subscribing to `outputs` above re-renders this on every hot-plug, which re-reads the connection state.
  const connected = useEditorStore.getState().isOutputConnected();
  const connectionLabel = connected ? 'Connected' : 'Disconnected';
  const hintId = useId();

  useEffect(() => {
    connectWebMidi();
  }, [connectWebMidi]);

  const selectedMissing = !outputs.some((p) => p.id === outputId);

  return (
    <header className="top-bar" aria-label="Connection">
      <h1 className="wordmark">
        Chroma Console<span> / Editor</span>
      </h1>
      <UpdatePill />
      <div className="connection">
        <output
          className={`connection-dot ${connected ? 'is-connected' : 'is-disconnected'}`}
          aria-label="Connection status"
          title={connectionLabel}
        >
          <span className="sr-only">{connectionLabel}</span>
        </output>
        <select aria-label="MIDI output" value={outputId} onChange={(e) => setOutput(e.target.value)}>
          {outputs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
          {selectedMissing && <option value={outputId}>(unplugged)</option>}
        </select>
        <span aria-hidden="true">·</span>
        <select
          aria-label="MIDI channel"
          aria-describedby={hintId}
          title={MIDI_CHANNEL_HINT}
          value={midiChannel}
          onChange={(e) => setMidiChannel(Number(e.target.value))}
        >
          {MIDI_CHANNELS.map((n) => (
            <option key={n} value={n}>
              {midiChannelLabel(n)}
            </option>
          ))}
        </select>
        <span id={hintId} className="sr-only">
          {MIDI_CHANNEL_HINT}
        </span>
      </div>
      <div className="top-actions">
        <button
          id={DATA_BUTTON_ID}
          type="button"
          className={`bar-button${drawerOpen ? ' is-inverted' : ''}`}
          aria-expanded={drawerOpen}
          aria-controls={DATA_DRAWER_ID}
          onClick={toggleDrawer}
        >
          Data {drawerOpen ? '◂' : '▸'}
        </button>
      </div>
    </header>
  );
}

/** A new version waits; it never reloads by itself, which would drop the MIDI connection mid-edit. */
function UpdatePill() {
  const updateWaiting = useAppStore((s) => s.updateWaiting);
  const reload = useAppStore((s) => s.reload);
  if (!updateWaiting) return null;
  return (
    <div className="update-pill" role="status" title={UPDATE_WAITING_HELP}>
      Update available
      <button type="button" className="text-button" onClick={reload}>
        Reload
      </button>
    </div>
  );
}

/** Shown above the console when the browser offers no Web MIDI. */
export function WebMidiNote() {
  const webMidiStatus = useEditorStore((s) => s.webMidiStatus);
  if (webMidiStatus !== 'unavailable') return null;
  return (
    <p className="connection-note" role="status">
      Web MIDI is unavailable — use Chrome or Edge and allow MIDI access. The Virtual Pedal still works.
    </p>
  );
}
