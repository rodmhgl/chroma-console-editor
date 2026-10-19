import { describe, expect, it } from 'vitest';
import { VIRTUAL_PEDAL_PORT, createVirtualPedal } from './virtual';

const logOf = (pedal: ReturnType<typeof createVirtualPedal>) => pedal.getSnapshot().log.map((e) => e.text);

describe('Virtual Pedal transport', () => {
  it('lists itself as an output', () => {
    expect(createVirtualPedal().listOutputs()).toEqual([VIRTUAL_PEDAL_PORT]);
  });

  it('listens on MIDI channel 1 by default and logs what it hears', () => {
    const pedal = createVirtualPedal();

    pedal.send([0xb0, 20, 76]);
    pedal.send([0xc0, 3]);

    expect(logOf(pedal)).toEqual(['CC 20 = 76 → (not in MIDI map)', 'PC 3 → (not in MIDI map)']);
  });

  it('decodes a Character Effect selection by its CC range, and OFF', () => {
    const pedal = createVirtualPedal();

    pedal.send([0xb0, 16, 76]);
    expect(pedal.getSnapshot().state.characterEffect).toBe(76);
    pedal.send([0xb0, 16, 0]);
    pedal.send([0xb0, 16, 109]);
    pedal.send([0xb0, 16, 110]);

    expect(logOf(pedal)).toEqual([
      'CC 16 = 76 → Character → Howl',
      'CC 16 = 0 → Character → Drive',
      'CC 16 = 109 → Character → Swell',
      'CC 16 = 110 → Character → OFF',
    ]);
  });

  it('decodes Amount and Tilt into its state', () => {
    const pedal = createVirtualPedal();

    pedal.send([0xb0, 65, 100]);
    pedal.send([0xb0, 64, 20]);

    expect(logOf(pedal)).toEqual(['CC 65 = 100 → Character → Amount', 'CC 64 = 20 → Character → Tilt']);
    expect(pedal.getSnapshot().state).toMatchObject({ characterAmount: 100, tilt: 20 });
  });

  it('logs Performance Controls and Calibration Level by name, leaving its Preset state alone', () => {
    const pedal = createVirtualPedal();

    pedal.send([0xb0, 82, 107]);
    pedal.send([0xb0, 93, 127]);
    pedal.send([0xb0, 94, 79]);

    expect(logOf(pedal)).toEqual(['CC 82 = 107 → Capture → Record', 'CC 93 = 127 → Tap', 'CC 94 = 79 → Calibration Level → High']);
    expect(pedal.getSnapshot().state).toEqual(createVirtualPedal().getSnapshot().state);
  });

  it('ignores messages on another MIDI channel', () => {
    const pedal = createVirtualPedal(1);

    pedal.send([0xb4, 16, 76]);

    expect(logOf(pedal)).toEqual(['CC 16 = 76 on MIDI channel 5 → ignored (pedal listens on MIDI channel 1)']);
    expect(pedal.getSnapshot().state.characterEffect).toBe(10);
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
