import { describe, expect, it } from 'vitest';
import { initialEditorState } from '../model/core';
import { defaultWorkingState } from '../model/state';
import { DEFAULT_SEND_GAP_MS } from './editorStore';
import { SESSION_VERSION, parseSession, type Session } from './session';

const working = { ...defaultWorkingState(), tilt: 20, moduleOrder: 3 };
const session: Session = {
  version: SESSION_VERSION,
  working,
  snapshot: { state: { ...working, mix: 40 }, showing: true },
  slotMap: { 12: { committed: working, presetId: 'p-1', name: 'Shimmer' }, 13: { committed: working, presetId: null, name: 'Untitled' } },
  confirmed: { ...initialEditorState().confirmed, moduleOrder: 3 },
  midiChannel: 9,
  source: { presetId: 'p-1', name: 'Shimmer', params: defaultWorkingState() },
  settings: { theme: 'charcoal', uiScale: 150, sendGapMs: 12 },
};

describe('parseSession', () => {
  it('reads back a session as saved, through JSON', () => {
    expect(parseSession(JSON.parse(JSON.stringify(session)))).toEqual(session);
  });

  it('reads nothing from something that isn’t a session of this version', () => {
    for (const raw of [undefined, null, 'junk', [], { ...session, version: SESSION_VERSION + 1 }]) {
      expect(parseSession(raw)).toBeNull();
    }
  });

  it('falls back to defaults field by field for whatever is missing or damaged', () => {
    const parsed = parseSession({
      version: SESSION_VERSION,
      working: { tilt: 20, mix: 400, characterEffect: 120, bogus: 1 },
      snapshot: 'junk',
      slotMap: { 12: session.slotMap[12], 80: session.slotMap[12], x: session.slotMap[12], 3: { name: 'No state' } },
      confirmed: { moduleOrder: 'three' },
      midiChannel: 17,
      source: { name: 'No params' },
      settings: { theme: 'neon', uiScale: 1000, sendGapMs: -4 },
    });

    expect(parsed).toEqual({
      version: SESSION_VERSION,
      working: { ...defaultWorkingState(), tilt: 20, mix: 127, characterEffect: 98 },
      snapshot: null,
      slotMap: { 12: session.slotMap[12] },
      confirmed: initialEditorState().confirmed,
      midiChannel: 1,
      source: null,
      settings: { theme: 'light', uiScale: 200, sendGapMs: 0 },
    });
    expect(parseSession({ version: SESSION_VERSION })?.settings.sendGapMs).toBe(DEFAULT_SEND_GAP_MS);
  });
});
