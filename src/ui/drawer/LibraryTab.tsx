import { useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { MAX_NAME_LENGTH } from '../../model/schema';
import {
  MODIFIED_HELP,
  folderAccessAvailable,
  goneMessage,
  libraryReachable,
  useLibraryStore,
  useWorkingStateModified,
  type LibraryEntry,
  type PresetDetails,
} from '../../store/library';
import { useArmedConfirm } from '../useArmedConfirm';

type Editing = { kind: 'saveAs' } | { kind: 'details'; id: string } | null;

/** What an armed Open or New says: going ahead loses the Working State's unsaved edits. */
const DISCARD_PROMPT = 'Discard edits? Click again';

/**
 * The Library (a folder, or browser storage), the Working State's file actions and its Presets.
 * Every action here is written at once and can't be undone.
 */
export function LibraryTab() {
  const {
    storage,
    folderName,
    remembered,
    presets,
    problems,
    source,
    pickFolder,
    reopenFolder,
    newWorkingState,
    save,
    saveAs,
    editDetails,
    duplicate,
    deletePreset,
    openPreset,
  } = useLibraryStore();
  const modified = useWorkingStateModified();
  // A remembered folder still to open counts: the action opens it first.
  const reachable = libraryReachable({ folderName, remembered });
  const [editing, setEditing] = useState<Editing>(null);
  const [error, setError] = useState<string | null>(null);

  /** Runs a file action, showing what went wrong instead of failing silently. Resolves whether it worked. */
  const runFileAction = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    }
  };
  const closeIfDone = (ok: boolean) => ok && setEditing(null);
  const saveWorking = () =>
    runFileAction(async () => {
      if (!(await save())) setEditing({ kind: 'saveAs' });
    });
  const startNew = useArmedConfirm(() => void runFileAction(newWorkingState), source, modified);

  return (
    <div className="library-tab">
      <section className="working-card" aria-label="Working State">
        <div className="working-card-reach">Working State</div>
        <div className="working-card-name">
          {source.name}
          {modified && (
            <span className="modified-marker" title={MODIFIED_HELP}>
              {' '}
              •
            </span>
          )}
        </div>
        <div className="working-card-actions">
          <button
            type="button"
            className={`outline-button${startNew.armed ? ' is-armed' : ''}`}
            aria-label={startNew.armed ? `New: ${DISCARD_PROMPT}` : 'New'}
            title="Starts again from the neutral Preset and sends it to the pedal."
            onClick={startNew.click}
          >
            {startNew.armed ? DISCARD_PROMPT : 'New'}
          </button>
          <button type="button" className="solid-button" disabled={!reachable} onClick={saveWorking}>
            Save
          </button>
          <button
            type="button"
            className="outline-button"
            disabled={!reachable}
            onClick={() => setEditing({ kind: 'saveAs' })}
          >
            Save As…
          </button>
        </div>
        {editing?.kind === 'saveAs' && (
          <NameForm
            label="Save As"
            initial={source.name}
            onCancel={() => setEditing(null)}
            onSubmit={(name) => runFileAction(() => saveAs(name)).then(closeIfDone)}
          />
        )}
      </section>

      {storage === 'browser' ? (
        <div className="library-folder">
          <span title="Clearing this site’s data in the browser deletes it.">Browser storage · kept in this browser only</span>
        </div>
      ) : remembered?.status === 'opening' ? (
        <div className="library-folder" role="status">
          <span>Opening {remembered.name}…</span>
        </div>
      ) : (
        <div className="library-folder">
          <span>
            {folderName
              ? `Folder · ${folderName}`
              : remembered?.status === 'needsPermission'
                ? `Folder · ${remembered.name}`
                : remembered?.status === 'gone'
                  ? goneMessage(remembered.name)
                  : 'No Library folder yet'}
          </span>
          {remembered?.status === 'needsPermission' && (
            <button
              type="button"
              className="solid-button"
              title="The browser asks again after a restart before the editor can use the folder."
              onClick={() => runFileAction(reopenFolder)}
            >
              Reopen
            </button>
          )}
          {folderAccessAvailable && (
            <button type="button" className="outline-button" onClick={() => runFileAction(pickFolder)}>
              {reachable ? 'Change folder…' : 'Choose folder…'}
            </button>
          )}
        </div>
      )}

      {error && (
        <p className="library-error" role="alert">
          {error}
        </p>
      )}
      {problems.length > 0 && (
        <details className="library-problems">
          <summary>
            {problems.length} file {problems.length === 1 ? 'problem' : 'problems'}
          </summary>
          <ul>
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </details>
      )}

      {folderName && (
        <ul className="preset-list" aria-label="Presets">
          {presets.length === 0 && (
            <li className="preset-empty">No Presets in {storage === 'browser' ? 'this Library' : 'this folder'} yet.</li>
          )}
          {presets.map((entry) => (
            <PresetRow
              key={entry.preset.id}
              entry={entry}
              current={entry.preset.id === source.presetId}
              browser={storage === 'browser'}
              modified={modified}
              editing={editing?.kind === 'details' && editing.id === entry.preset.id}
              onOpen={() => runFileAction(() => openPreset(entry.preset.id))}
              onEdit={() => setEditing({ kind: 'details', id: entry.preset.id })}
              onEdited={(details) => runFileAction(() => editDetails(entry.preset.id, details)).then(closeIfDone)}
              onCancelEdit={() => setEditing(null)}
              onDuplicate={() => runFileAction(() => duplicate(entry.preset.id))}
              onDelete={() => runFileAction(() => deletePreset(entry.preset.id))}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function PresetRow(props: {
  entry: LibraryEntry;
  current: boolean;
  /** Kept in browser storage, which has no file names to show. */
  browser: boolean;
  /** The Working State has unsaved edits, which opening a Preset would discard. */
  modified: boolean;
  editing: boolean;
  onOpen(): void;
  onEdit(): void;
  onEdited(details: PresetDetails): void;
  onCancelEdit(): void;
  onDuplicate(): void;
  onDelete(): void;
}) {
  const { preset, fileName } = props.entry;
  const { browser } = props;
  const open = useArmedConfirm(props.onOpen, props.modified, props.modified);
  const remove = useArmedConfirm(props.onDelete);

  if (props.editing) {
    return (
      <li className="preset-row">
        <DetailsForm
          label={`Details of ${preset.name}`}
          initial={{ name: preset.name, notes: preset.notes, tags: preset.tags.join(', ') }}
          onSubmit={props.onEdited}
          onCancel={props.onCancelEdit}
        />
      </li>
    );
  }

  return (
    <li className={`preset-row${props.current ? ' is-active' : ''}`} aria-current={props.current ? 'true' : undefined}>
      <div className="preset-main">
        <button
          type="button"
          className={`preset-name${open.armed ? ' is-armed' : ''}`}
          aria-label={open.armed ? `Open ${preset.name}: ${DISCARD_PROMPT}` : `Open ${preset.name}`}
          title={`Makes ${browser ? preset.name : fileName} the Working State and sends it to the pedal.`}
          onClick={open.click}
        >
          {open.armed ? DISCARD_PROMPT : preset.name}
        </button>
        {preset.tags.length > 0 && (
          <ul className="preset-tags" aria-label="Tags">
            {preset.tags.map((tag) => (
              <li key={tag}>{tag}</li>
            ))}
          </ul>
        )}
        {preset.notes && <div className="preset-notes">{preset.notes}</div>}
        <div className="preset-dates">
          Created {formatDate(preset.createdAt)} · Modified {formatDate(preset.modifiedAt)}
        </div>
      </div>
      <button
        type="button"
        className="text-button"
        aria-label={`Details of ${preset.name}`}
        title="Rename it, or change its notes and tags."
        onClick={props.onEdit}
      >
        Details
      </button>
      <button type="button" className="text-button" aria-label={`Duplicate ${preset.name}`} onClick={props.onDuplicate}>
        Duplicate
      </button>
      <button
        type="button"
        className={`text-button${remove.armed ? ' is-armed' : ''}`}
        aria-label={remove.armed ? `Delete ${preset.name}? Click again` : `Delete ${preset.name}`}
        title={
          browser
            ? `Deletes ${preset.name} from this browser’s Library. This can’t be undone.`
            : `Deletes ${fileName} from the Library folder. This can’t be undone.`
        }
        onClick={remove.click}
      >
        {remove.armed ? 'Delete? Click again' : 'Delete'}
      </button>
    </li>
  );
}

/** A date as the user's locale writes it. */
function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
}

/** Escape cancels the form only: the drawer stays open. */
const cancelOnEscape = (onCancel: () => void) => (e: KeyboardEvent) => {
  if (e.key !== 'Escape') return;
  e.preventDefault();
  onCancel();
};

/** A Preset name field: trimmed, non-empty, at most 64 characters. */
function NameForm(props: { label: string; initial: string; onSubmit(name: string): void; onCancel(): void }) {
  const [name, setName] = useState(props.initial);
  return (
    <form
      className="name-form"
      aria-label={props.label}
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) props.onSubmit(name);
      }}
      onKeyDown={cancelOnEscape(props.onCancel)}
    >
      <input
        aria-label="Preset name"
        value={name}
        maxLength={MAX_NAME_LENGTH}
        autoFocus
        onFocus={(e) => e.target.select()}
        onChange={(e) => setName(e.target.value)}
      />
      <button type="submit" className="solid-button" disabled={!name.trim()}>
        OK
      </button>
      <button type="button" className="outline-button" onClick={props.onCancel}>
        Cancel
      </button>
    </form>
  );
}

/** A Preset's name, notes and tags, edited together. */
function DetailsForm(props: { label: string; initial: PresetDetails; onSubmit(details: PresetDetails): void; onCancel(): void }) {
  const [details, setDetails] = useState(props.initial);
  const change = (field: keyof PresetDetails) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDetails({ ...details, [field]: e.target.value });
  return (
    <form
      className="details-form"
      aria-label={props.label}
      onSubmit={(e) => {
        e.preventDefault();
        if (details.name.trim()) props.onSubmit(details);
      }}
      onKeyDown={cancelOnEscape(props.onCancel)}
    >
      <label>
        Name
        <input value={details.name} maxLength={MAX_NAME_LENGTH} autoFocus onChange={change('name')} />
      </label>
      <label>
        Notes
        <textarea
          value={details.notes}
          rows={3}
          placeholder="e.g. Expects a Gesture recording on Rate."
          onChange={change('notes')}
        />
      </label>
      <label>
        Tags
        <input value={details.tags} placeholder="Separated by commas" onChange={change('tags')} />
      </label>
      <div className="working-card-actions">
        <button type="submit" className="solid-button" disabled={!details.name.trim()}>
          OK
        </button>
        <button type="button" className="outline-button" onClick={props.onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
