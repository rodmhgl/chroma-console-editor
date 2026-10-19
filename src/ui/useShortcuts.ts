import { useEffect } from 'react';
import { useEditorStore } from '../store/editorStore';

type KeyLike = Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey' | 'repeat'>;

export type Shortcut = { type: 'undo' | 'redo' | 'sendAll' | 'takeSnapshot' | 'flipAB' | 'adoptSnapshot' | 'discardSnapshot' };

/** ⌘ (Ctrl elsewhere) + key, without ⇧: K keeps a Snapshot, B flips A/B, U uses the Snapshot, ⌫ discards it. */
const COMMANDS: Record<string, Shortcut['type']> = {
  e: 'sendAll',
  k: 'takeSnapshot',
  b: 'flipAB',
  u: 'adoptSnapshot',
  backspace: 'discardSnapshot',
};

/** Fields whose own text undo ⌘Z should reach instead. */
const TEXT_EDIT = 'input:not([type="checkbox"], [type="radio"], [type="range"], [type="button"]), textarea, [contenteditable]';

/**
 * Where a shortcut belongs to the focused field instead: ⌘⌫ deletes text in one. ⌘E and the other letters mean nothing
 * to a field, so they work everywhere.
 */
const TEXT_OWNS: Partial<Record<Shortcut['type'], string>> = { undo: TEXT_EDIT, redo: TEXT_EDIT, discardSnapshot: TEXT_EDIT };

/**
 * The editor's keyboard shortcuts (SPEC.md story 82), with ⌘ on a Mac and Ctrl elsewhere, where Ctrl+Y redoes too.
 * Held keys repeat only undo and redo.
 */
export function shortcutFor(e: KeyLike, mac: boolean): Shortcut | null {
  const key = e.key.toLowerCase();
  const command = mac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
  if (!command || e.altKey) return null;
  if (key === 'z') return { type: e.shiftKey ? 'redo' : 'undo' };
  if (key === 'y' && !mac && !e.shiftKey) return { type: 'redo' };
  const type = COMMANDS[key];
  return type && !e.shiftKey && !e.repeat ? { type } : null;
}

/** ⌘ (Ctrl elsewhere) + key, as tooltips show it. */
const commandLabel = (key: string, mac: boolean) => (mac ? `⌘${key}` : `Ctrl+${key}`);

const isMac = () => /Mac|iPhone|iPad/.test(navigator.userAgent);

/** A ⌘ (Ctrl elsewhere) shortcut, for `aria-keyshortcuts` and to show in a tooltip as `label`. */
export function commandKeys(key: string, label = key): { aria: string; label: string } {
  const mac = isMac();
  return { aria: `${mac ? 'Meta' : 'Control'}+${key}`, label: commandLabel(label, mac) };
}

function run(shortcut: Shortcut) {
  const editor = useEditorStore.getState();
  switch (shortcut.type) {
    case 'undo':
    case 'redo':
      return editor[shortcut.type]();
    case 'sendAll':
      if (editor.canSendAll()) void editor.sendAll();
      return;
    case 'takeSnapshot':
    case 'flipAB':
    case 'adoptSnapshot':
    case 'discardSnapshot':
      return editor[shortcut.type]();
  }
}

/** Listens for the editor's shortcuts anywhere but an open dialog, or a text field for the keys it owns. */
export function useShortcuts() {
  useEffect(() => {
    const mac = isMac();
    const onKeyDown = (e: KeyboardEvent) => {
      const shortcut = shortcutFor(e, mac);
      if (!shortcut) return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest('dialog[open]')) return;
      const fieldOwns = TEXT_OWNS[shortcut.type];
      if (fieldOwns && target?.closest(fieldOwns)) return;
      e.preventDefault();
      run(shortcut);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
