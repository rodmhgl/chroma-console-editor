import { describe, expect, it } from 'vitest';
import { pedalOutputToSelect } from './ports';
import { VIRTUAL_PEDAL_PORT } from './virtual';

const PEDAL = { id: 'usb-1', name: 'HOLOGRAM Chroma Console MIDI' };
const DIN = { id: 'din-1', name: 'USB MIDI Interface' };

describe('pedalOutputToSelect', () => {
  it('picks the pedal’s USB port when it is listed at launch, instead of the Virtual Pedal', () => {
    expect(pedalOutputToSelect({ before: [], now: [PEDAL], selectedId: VIRTUAL_PEDAL_PORT.id })).toBe(PEDAL.id);
  });

  it('picks it when it is plugged in later', () => {
    expect(pedalOutputToSelect({ before: [DIN], now: [DIN, PEDAL], selectedId: VIRTUAL_PEDAL_PORT.id })).toBe(PEDAL.id);
  });

  it('picks it in place of an output that has been unplugged', () => {
    expect(pedalOutputToSelect({ before: [DIN], now: [PEDAL], selectedId: DIN.id })).toBe(PEDAL.id);
  });

  it('leaves a connected DIN interface selected: that is the user’s cable setup', () => {
    expect(pedalOutputToSelect({ before: [DIN], now: [DIN, PEDAL], selectedId: DIN.id })).toBeNull();
  });

  it('leaves the selection alone while the pedal stays plugged in, so choosing another output sticks', () => {
    expect(pedalOutputToSelect({ before: [PEDAL], now: [PEDAL], selectedId: VIRTUAL_PEDAL_PORT.id })).toBeNull();
  });

  it('recognises the port whatever the operating system adds around the name', () => {
    const named = (name: string) => ({ id: 'x', name });
    for (const name of ['HOLOGRAM Chroma Console MIDI', '2- HOLOGRAM Chroma Console MIDI', 'Chroma Console MIDI 1', 'hologram chroma console midi'])
      expect(pedalOutputToSelect({ before: [], now: [named(name)], selectedId: VIRTUAL_PEDAL_PORT.id })).toBe('x');
  });

  it('picks nothing when the pedal isn’t listed', () => {
    expect(pedalOutputToSelect({ before: [], now: [DIN], selectedId: VIRTUAL_PEDAL_PORT.id })).toBeNull();
  });
});
