import { describe, expect, it } from 'vitest';
import { shortcutFor } from './useShortcuts';

type Mods = Partial<Record<'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey' | 'repeat', boolean>>;

const key = (key: string, mods: Mods = {}) => ({
  key,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  repeat: false,
  ...mods,
});

const MAC = true;
const PC = false;

describe('shortcutFor', () => {
  it('is ⌘Z / ⇧⌘Z on a Mac', () => {
    expect(shortcutFor(key('z', { metaKey: true }), MAC)).toEqual({ type: 'undo' });
    expect(shortcutFor(key('Z', { metaKey: true, shiftKey: true }), MAC)).toEqual({ type: 'redo' });
    expect(shortcutFor(key('z', { ctrlKey: true }), MAC)).toBeNull();
  });

  it('is Ctrl+Z / Ctrl+Shift+Z elsewhere, with Ctrl+Y for redo too', () => {
    expect(shortcutFor(key('z', { ctrlKey: true }), PC)).toEqual({ type: 'undo' });
    expect(shortcutFor(key('Z', { ctrlKey: true, shiftKey: true }), PC)).toEqual({ type: 'redo' });
    expect(shortcutFor(key('y', { ctrlKey: true }), PC)).toEqual({ type: 'redo' });
    expect(shortcutFor(key('y', { metaKey: true }), MAC)).toBeNull();
    expect(shortcutFor(key('z', { metaKey: true }), PC)).toBeNull();
  });

  it('repeats undo and redo while held', () => {
    expect(shortcutFor(key('z', { ctrlKey: true, repeat: true }), PC)).toEqual({ type: 'undo' });
    expect(shortcutFor(key('z', { metaKey: true, shiftKey: true, repeat: true }), MAC)).toEqual({ type: 'redo' });
  });

  it('is Send All for ⌘E on a Mac and Ctrl+E elsewhere', () => {
    expect(shortcutFor(key('e', { metaKey: true }), MAC)).toEqual({ type: 'sendAll' });
    expect(shortcutFor(key('E', { ctrlKey: true }), PC)).toEqual({ type: 'sendAll' });
  });

  it('doesn’t repeat Send All while held, or take ⇧', () => {
    expect(shortcutFor(key('e', { ctrlKey: true, repeat: true }), PC)).toBeNull();
    expect(shortcutFor(key('e', { ctrlKey: true, shiftKey: true }), PC)).toBeNull();
  });

  it('is ⌘K to take a Snapshot, ⌘B to flip A/B, ⌘U to adopt it and ⌘⌫ to discard it, Ctrl elsewhere', () => {
    expect(shortcutFor(key('k', { metaKey: true }), MAC)).toEqual({ type: 'takeSnapshot' });
    expect(shortcutFor(key('b', { metaKey: true }), MAC)).toEqual({ type: 'flipAB' });
    expect(shortcutFor(key('u', { metaKey: true }), MAC)).toEqual({ type: 'adoptSnapshot' });
    expect(shortcutFor(key('Backspace', { metaKey: true }), MAC)).toEqual({ type: 'discardSnapshot' });
    expect(shortcutFor(key('B', { ctrlKey: true }), PC)).toEqual({ type: 'flipAB' });
    expect(shortcutFor(key('Backspace', { ctrlKey: true }), PC)).toEqual({ type: 'discardSnapshot' });
  });

  it('doesn’t repeat a Snapshot shortcut while held, so a held ⌘B flips once', () => {
    expect(shortcutFor(key('b', { metaKey: true, repeat: true }), MAC)).toBeNull();
    expect(shortcutFor(key('k', { ctrlKey: true, shiftKey: true }), PC)).toBeNull();
  });

  it('ignores other keys and modifiers', () => {
    expect(shortcutFor(key('z'), PC)).toBeNull();
    expect(shortcutFor(key('e'), PC)).toBeNull();
    expect(shortcutFor(key('s', { ctrlKey: true }), PC)).toBeNull();
    expect(shortcutFor(key('z', { ctrlKey: true, altKey: true }), PC)).toBeNull();
    expect(shortcutFor(key('e', { ctrlKey: true, altKey: true }), PC)).toBeNull();
    expect(shortcutFor(key('z', { ctrlKey: true, metaKey: true }), PC)).toBeNull();
    expect(shortcutFor(key('e', { metaKey: true }), PC)).toBeNull();
    expect(shortcutFor(key('e', { ctrlKey: true }), MAC)).toBeNull();
  });
});
