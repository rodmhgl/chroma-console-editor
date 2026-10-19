import { useEditorStore } from '../../store/editorStore';
import { describeSent } from '../../store/monitor';
import { midiChannelLabel } from '../midiChannels';
import { RawMidiPanel } from '../RawMidiPanel';

/** mm:ss.s since the editor started. */
function clock(ms: number): string {
  const s = ms / 1000;
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${(s % 60).toFixed(1).padStart(4, '0')}`;
}

/** Outgoing MIDI, newest first, plus the Raw MIDI sender for hardware checks. */
export function MidiMonitor() {
  const sent = useEditorStore((s) => s.sent);
  const midiChannel = useEditorStore((s) => s.editor.global.midiChannel);
  const clearSent = useEditorStore((s) => s.clearSent);

  return (
    <div className="midi-monitor">
      <div className="monitor-head">
        <span>Out · {midiChannelLabel(midiChannel)} · newest first</span>
        <button type="button" className="link-button" onClick={clearSent}>
          Clear
        </button>
      </div>
      {sent.length === 0 ? (
        <p className="monitor-empty">Send a message to see it here.</p>
      ) : (
        <ol className="monitor-log" role="log" aria-label="Outgoing MIDI">
          {sent.map((m) => {
            const row = describeSent(m.bytes);
            return (
              <li key={m.id}>
                <span className="is-muted">{clock(m.at)}</span>
                <span>{row.type}</span>
                <span>{row.number}</span>
                <span className="is-strong">{row.value}</span>
                <span className="monitor-label">{row.label}</span>
              </li>
            );
          })}
        </ol>
      )}
      <RawMidiPanel />
    </div>
  );
}
