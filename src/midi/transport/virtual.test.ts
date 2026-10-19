import { describe, expect, it } from 'vitest';
import { VIRTUAL_PEDAL_PORT, createVirtualPedal } from './virtual';

const logOf = (pedal: ReturnType<typeof createVirtualPedal>) => pedal.getSnapshot().log.map((e) => e.text);

describe('Virtual Pedal transport', () => {
  it('lists itself as an output', () => {
    expect(createVirtualPedal().listOutputs()).toEqual([VIRTUAL_PEDAL_PORT]);
  });

  it('listens on MIDI channel 1 by default and logs what it hears', () => {
    const pedal = createVirtualPedal();

    pedal.send([0xb0, 16, 76]);
    pedal.send([0xc0, 3]);

    expect(logOf(pedal)).toEqual(['CC 16 = 76 → (not in MIDI map)', 'PC 3 → (not in MIDI map)']);
  });

  it('ignores messages on another MIDI channel', () => {
    const pedal = createVirtualPedal(1);

    pedal.send([0xb4, 16, 76]);

    expect(logOf(pedal)).toEqual(['CC 16 = 76 on MIDI channel 5 → ignored (pedal listens on MIDI channel 1)']);
  });

  it('logs MIDI clock as unknown', () => {
    const pedal = createVirtualPedal();

    pedal.send([0xf8]);

    expect(logOf(pedal)).toEqual(['Unknown: F8']);
  });

  it('notifies subscribers when it hears a message', () => {
    const pedal = createVirtualPedal();
    let calls = 0;
    pedal.subscribe(() => calls++);

    pedal.send([0xb0, 16, 1]);

    expect(calls).toBe(1);
  });
});
