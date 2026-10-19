import { useEffect } from 'react';
import { useEditorStore } from '../store/editorStore';

type KeyLike = Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>;

export type Shortcut = { type: 'undo' | 'redo' };

/** Fields whose own text undo ⌘Z should reach instead. */
const TEXT_EDIT = 'input:not([type="checkbox"], [type="radio"], [type="range"], [type="button"]), textarea, [contenteditable]';

/**
 * The editor's keyboard shortcuts (SPEC.md story 82), with ⌘ on a Mac and Ctrl elsewhere, where Ctrl+Y redoes too.
 * Held keys repeat.
 */
export function shortcutFor(e: KeyLike, mac: boolean): Shortcut | null {
  const key = e.key.toLowerCase();
  const command = mac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
  if (!command || e.altKey) return null;
  if (key === 'z') return { type: e.shiftKey ? 'redo' : 'undo' };
  if (key === 'y' && !mac && !e.shiftKey) return { type: 'redo' };
  return null;
}

const isMac = () => /Mac|iPhone|iPad/.test(navigator.userAgent);

/** Listens for the editor's shortcuts anywhere but a text field or an open dialog. */
export function useShortcuts() {
  useEffect(() => {
    const mac = isMac();
    const onKeyDown = (e: KeyboardEvent) => {
      const shortcut = shortcutFor(e, mac);
      if (!shortcut) return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest(`dialog[open], ${TEXT_EDIT}`)) return;
      e.preventDefault();
      useEditorStore.getState()[shortcut.type]();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
