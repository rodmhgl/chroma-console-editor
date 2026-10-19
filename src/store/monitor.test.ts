import { describe, expect, it } from 'vitest';
import { describeSent, logSent, type SentMessage } from './monitor';

const sent = (id: number, bytes: number[]): SentMessage => ({ id, at: id, bytes });

describe('MIDI Monitor log', () => {
  it('keeps the newest message first', () => {
    const log = logSent(logSent([], sent(1, [0xb0, 65, 1])), sent(2, [0xb0, 64, 1]));

    expect(log.map((m) => m.id)).toEqual([2, 1]);
  });

  it('updates the newest row when the same CC follows within a drag’s pace, so a drag reads as one row', () => {
    let log = logSent([], sent(1, [0xb0, 65, 1]));
    log = logSent(log, sent(2, [0xb0, 64, 1]));
    log = logSent(log, sent(3, [0xb0, 64, 2]));

    expect(log.map((m) => [m.id, m.bytes[2]])).toEqual([
      [3, 2],
      [1, 1],
    ]);
  });

  it('keeps separate sends of the same CC, such as taps, as separate rows', () => {
    const log = [0, 500, 1000].reduce<SentMessage[]>((l, at, i) => logSent(l, { id: i, at, bytes: [0xb0, 93, 127] }), []);

    expect(log).toHaveLength(3);
  });

  it('treats the same CC on another MIDI channel, or a repeated PC, as a new row', () => {
    let log = logSent(logSent([], sent(1, [0xb0, 65, 1])), sent(2, [0xb4, 65, 1]));
    log = logSent(logSent(log, sent(3, [0xc0, 3])), sent(4, [0xc0, 3]));

    expect(log).toHaveLength(4);
  });

  it('is capped', () => {
    const log = [1, 2, 3, 4].reduce<SentMessage[]>((l, i) => logSent(l, sent(i, [0xb0, i, 0]), 3), []);

    expect(log.map((m) => m.id)).toEqual([4, 3, 2]);
  });
});

describe('describeSent', () => {
  it.each([
    // Effect selections name the Effect whose range holds the value, and OFF.
    [[0xb4, 16, 76], { type: 'CC', number: '16', value: '76', label: 'Character → Howl' }],
    [[0xb0, 17, 21], { type: 'CC', number: '17', value: '21', label: 'Movement → Doubler' }],
    [[0xb0, 18, 88], { type: 'CC', number: '18', value: '88', label: 'Diffusion → Reverse' }],
    [[0xb0, 19, 110], { type: 'CC', number: '19', value: '110', label: 'Texture → OFF' }],
    // Continuous controls name the control and its Module.
    [[0xb0, 65, 100], { type: 'CC', number: '65', value: '100', label: 'Character → Amount' }],
    [[0xb0, 64, 20], { type: 'CC', number: '64', value: '20', label: 'Character → Tilt' }],
    [[0xb0, 70, 127], { type: 'CC', number: '70', value: '127', label: 'Texture → Mix' }],
    [[0xb0, 76, 5], { type: 'CC', number: '76', value: '5', label: 'Diffusion → Drift' }],
    [[0xb0, 78, 64], { type: 'CC', number: '78', value: '64', label: 'Output Level' }],
    // Switches and Performance Controls name the setting the value lands in.
    [[0xb0, 105, 0], { type: 'CC', number: '105', value: '0', label: 'Diffusion → Bypassed' }],
    [[0xb0, 92, 47], { type: 'CC', number: '92', value: '47', label: 'Dual Bypass → Dual Bypass' }],
    [[0xb0, 84, 65], { type: 'CC', number: '84', value: '65', label: 'Filter style → Tilt' }],
    [[0xb0, 94, 111], { type: 'CC', number: '94', value: '111', label: 'Calibration Level → Very High' }],
    [[0xb0, 93, 127], { type: 'CC', number: '93', value: '127', label: 'Tap' }],
    [[0xb0, 81, 0], { type: 'CC', number: '81', value: '0', label: 'Gesture → Stop/Erase' }],
    [[0xb0, 20, 1], { type: 'CC', number: '20', value: '1', label: '—' }],
    [[0xc0, 0], { type: 'PC', number: '0', value: '', label: 'Recall Slot A-1' }],
    [[0xc4, 33], { type: 'PC', number: '33', value: '', label: 'Recall Slot B-14' }],
    [[0xc0, 79], { type: 'PC', number: '79', value: '', label: 'Recall Slot D-20' }],
    [[0xc0, 80], { type: 'PC', number: '80', value: '', label: 'No Slot' }],
    [[0xf8], { type: '—', number: '', value: '', label: 'F8' }],
  ])('describes %j', (bytes, row) => {
    expect(describeSent(bytes)).toEqual(row);
  });
});
