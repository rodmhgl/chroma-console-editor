import { describe, expect, it } from 'vitest';
import { BANKS, slotsInBank } from '../midi/map';
import type { Preset } from './schema';
import { EMPTY_SLOT_MAP, isChangedSinceCommit, slotName, type SlotMapEntry } from './slotMap';
import { defaultWorkingState } from './state';

const snapshot = { ...defaultWorkingState(), sensitivity: 90 };

const entry = (over: Partial<SlotMapEntry> = {}): SlotMapEntry => ({
  committed: snapshot,
  presetId: 'shimmer',
  name: 'Shimmer Tape',
  ...over,
});

const preset = (over: Partial<Preset> = {}): Preset => ({
  id: 'shimmer',
  name: 'Shimmer Tape',
  notes: '',
  tags: [],
  createdAt: '2026-10-01T10:00:00.000Z',
  modifiedAt: '2026-10-01T10:00:00.000Z',
  params: snapshot,
  ...over,
});

describe('Slots', () => {
  it('are four Banks of 20, recalled by PC 0–79 from A-1 to D-20', () => {
    expect(BANKS).toEqual(['A', 'B', 'C', 'D']);
    expect(slotsInBank('A')).toEqual(Array.from({ length: 20 }, (_, i) => i));
    expect(slotsInBank('B')[0]).toBe(20);
    expect(slotsInBank('D').at(-1)).toBe(79);
  });
});

describe('Slot Map', () => {
  it('starts knowing no Slot', () => {
    expect(EMPTY_SLOT_MAP).toEqual({});
  });
});

describe('changed since commit', () => {
  it('is false while the linked Preset still has the snapshot’s params', () => {
    expect(isChangedSinceCommit(entry(), preset())).toBe(false);
  });

  it('is true once the linked Preset’s params differ', () => {
    expect(isChangedSinceCommit(entry(), preset({ params: { ...snapshot, sensitivity: 10 } }))).toBe(true);
  });

  it('ignores a rename, notes or tags edit', () => {
    expect(isChangedSinceCommit(entry(), preset({ name: 'Renamed', notes: 'Big wash', tags: ['ambient'] }))).toBe(false);
  });

  it('is false with no linked Preset, or once it has been deleted', () => {
    expect(isChangedSinceCommit(entry({ presetId: null }), undefined)).toBe(false);
    expect(isChangedSinceCommit(entry(), undefined)).toBe(false);
  });
});

describe('Slot name', () => {
  it('follows the linked Preset’s current name', () => {
    expect(slotName(entry(), preset({ name: 'Renamed' }))).toBe('Renamed');
  });

  it('keeps the name it was committed with once the Preset has been deleted', () => {
    expect(slotName(entry(), undefined)).toBe('Shimmer Tape');
  });
});
