import { PARAMS } from '../../midi/map';
import { inexactPedalSteps } from '../../model/core';
import { useEditorStore } from '../../store/editorStore';
import { commandKeys } from '../useShortcuts';

/**
 * Snapshot A/B: take a Snapshot of the Working State, flip between it (A) and ongoing edits (B) to compare by ear, then
 * adopt or discard it. While A shows, the console can't be edited, so the Snapshot stays frozen. Opening a Preset or
 * recalling a Slot discards it.
 */
export function SnapshotBar() {
  const editor = useEditorStore((s) => s.editor);
  const { takeSnapshot, flipAB, adoptSnapshot, discardSnapshot } = useEditorStore();
  const { snapshot } = editor;
  const showing = snapshot?.showing ?? false;
  const inexact = inexactPedalSteps(editor).map((id) => PARAMS[id].label);
  const take = commandKeys('K');
  const flip = commandKeys('B');
  const adopt = commandKeys('U');
  const discard = commandKeys('Backspace', '⌫');

  return (
    <section className={`card snapshot-bar${showing ? ' is-showing-snapshot' : ''}`} aria-labelledby="snapshot-heading">
      <div className="snapshot-row">
        <h2 id="snapshot-heading" className="card-title">
          Snapshot A/B
        </h2>
        {snapshot && (
          <output className="snapshot-side" aria-label="Comparing">
            {showing ? 'A · Snapshot' : 'B · Working State'}
          </output>
        )}
        <div className="snapshot-actions">
          <button
            type="button"
            className="bar-button"
            disabled={showing}
            aria-keyshortcuts={take.aria}
            title={`Freezes a copy of the Working State to compare your edits against, replacing any Snapshot. Shortcut: ${take.label}`}
            onClick={takeSnapshot}
          >
            Take Snapshot
          </button>
          {snapshot && (
            <>
              <button
                type="button"
                className="bar-button is-primary"
                aria-keyshortcuts={flip.aria}
                title={`Switches the pedal between the Snapshot (A) and the Working State (B), sending only what differs. Shortcut: ${flip.label}`}
                onClick={flipAB}
              >
                Flip A/B
              </button>
              <button
                type="button"
                className="bar-button"
                aria-keyshortcuts={adopt.aria}
                title={`Makes the Snapshot the Working State; undo takes it back. Shortcut: ${adopt.label}`}
                onClick={adoptSnapshot}
              >
                Adopt Snapshot
              </button>
              <button
                type="button"
                className="bar-button"
                aria-keyshortcuts={discard.aria}
                title={`Drops the Snapshot and keeps the Working State. Shortcut: ${discard.label}`}
                onClick={discardSnapshot}
              >
                Discard Snapshot
              </button>
            </>
          )}
        </div>
      </div>
      {showing && <p className="snapshot-note">Showing the Snapshot, which can’t be edited; Save still saves B. Flip back to B to keep editing.</p>}
      {inexact.length > 0 && (
        <p className="snapshot-note is-warning" role="status">
          A and B differ in {inexact.join(' and ')}, which MIDI can’t send: flipping leaves the pedal’s own, so the
          comparison isn’t exact for {inexact.length > 1 ? 'those settings' : 'that setting'}.
        </p>
      )}
    </section>
  );
}
