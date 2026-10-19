import { useEffect, useId } from 'react';
import { SYNC_STATUS_LABELS, type SyncStatus } from '../model/sync';
import { UPDATE_WAITING_HELP, useAppStore } from '../store/appStore';
import { useEditorStore } from '../store/editorStore';
import { useLayoutStore } from '../store/layoutStore';
import { DATA_BUTTON_ID, DATA_DRAWER_ID } from './domIds';
import { MIDI_CHANNELS, midiChannelLabel } from './midiChannels';
import { commandKeys } from './useShortcuts';

/** How to find the pedal's own MIDI channel, for when edits aren't heard. */
export const MIDI_CHANNEL_HINT =
  'Must match the pedal’s. To check it, press A, B, C and D together to open the pedal’s Global Settings: the TILT knob sets its MIDI channel (1 by default).';

const SYNC_STATUS_HELP: Record<SyncStatus, string> = {
  inSync: 'The pedal should be sounding what the editor shows: everything was sent. Touching the pedal’s own controls isn’t detected.',
  possiblyStale: 'Since connecting, a MIDI channel change, Raw MIDI or a failed send, the pedal may hold anything. Send All to match it.',
  unknown: 'No output is connected, so nothing reaches the pedal.',
};

/** The top bar: Sync Status, output, MIDI channel, connection indicator, Send All and the Data drawer button. */
export function ConnectionBar() {
  const { outputs, outputId, editor, setOutput, setMidiChannel, sendAll, canSendAll, connectWebMidi } = useEditorStore();
  const { midiChannel } = editor.global;
  const sendAllKeys = commandKeys('E');
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
      <output className={`sync-pill is-${editor.sync}`} aria-label="Sync Status" title={SYNC_STATUS_HELP[editor.sync]}>
        {SYNC_STATUS_LABELS[editor.sync]}
      </output>
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
          type="button"
          className="bar-button"
          disabled={!canSendAll()}
          aria-keyshortcuts={sendAllKeys.aria}
          title={`Sends every MIDI-reachable setting of the Working State to the pedal, so the two match. Shortcut: ${sendAllKeys.label}`}
          onClick={() => void sendAll()}
        >
          Send All
        </button>
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
