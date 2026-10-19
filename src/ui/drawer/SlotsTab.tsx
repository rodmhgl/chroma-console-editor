import { BANKS, slotAddress, slotsInBank } from '../../midi/map';
import { useEditorStore } from '../../store/editorStore';
import { slotInfo, useLibraryStore, useWorkingStateModified, type SlotInfo } from '../../store/library';
import { useArmedConfirm } from '../useArmedConfirm';

/** Shown after a Slot's name when its Preset has changed since it was committed. */
export const CHANGED_SINCE_COMMIT = 'changed since commit';

/** What an armed recall says: the known Slot replaces the Working State and its unsaved edits. */
const DISCARD_PROMPT = 'Discard edits? Click again';

/**
 * The Slot Map: all 80 Slots as Banks A–D × 20, each with what the editor believes it holds. Clicking a Slot recalls it
 * on the pedal by Program Change.
 */
export function SlotsTab() {
  const slotMap = useEditorStore((s) => s.editor.slotMap);
  // Subscribing to `outputs` re-renders this on every hot-plug, which re-reads the connection state.
  useEditorStore((s) => s.outputs);
  const connected = useEditorStore.getState().isOutputConnected();
  const presets = useLibraryStore((s) => s.presets);
  const modified = useWorkingStateModified();

  return (
    <div className="slots-tab">
      <p className="slots-note">
        What the editor believes each Slot holds. The pedal can’t report its Slots, so one never committed from here is
        unknown.
      </p>
      {BANKS.map((bank) => (
        <section key={bank} className="slot-bank" aria-label={`Bank ${bank}`}>
          <h3 className="slot-bank-title">Bank {bank}</h3>
          <ul className="slot-list">
            {slotsInBank(bank).map((slot) => (
              <SlotRow
                key={slot}
                slot={slot}
                info={slotInfo(slotMap, presets, slot)}
                connected={connected}
                modified={modified}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function SlotRow({ slot, info, connected, modified }: { slot: number; info: SlotInfo | undefined; connected: boolean; modified: boolean }) {
  const recallSlot = useLibraryStore((s) => s.recallSlot);
  const address = slotAddress(slot)!;
  // Only a known Slot replaces the Working State.
  const recall = useArmedConfirm(() => recallSlot(slot), modified, modified && !!info);
  const name = info?.name ?? 'unknown';
  const description = `${name}${info?.changed ? `, ${CHANGED_SINCE_COMMIT}` : ''}`;

  return (
    <li className={`slot-row${info ? '' : ' is-unknown'}`}>
      <button
        type="button"
        className={`slot-recall${recall.armed ? ' is-armed' : ''}`}
        disabled={!connected}
        aria-label={`Recall ${address} · ${recall.armed ? DISCARD_PROMPT : description}`}
        title={
          !connected
            ? 'Connect an output to recall a Slot.'
            : info
              ? `Sends PC ${slot}: the pedal recalls ${address} and the Working State becomes what was committed there.`
              : `Sends PC ${slot}: the pedal recalls ${address}, which the editor knows nothing about.`
        }
        onClick={recall.click}
      >
        <span className="slot-address">{address}</span>
        <span className="slot-name">
          {recall.armed ? DISCARD_PROMPT : name}
          {!recall.armed && info?.changed && (
            <span className="changed-marker" title={`Its Preset has ${CHANGED_SINCE_COMMIT}`}>
              {' '}
              ↻
            </span>
          )}
        </span>
      </button>
    </li>
  );
}
