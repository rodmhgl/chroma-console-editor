import { describe, expect, it } from 'vitest';
import { defaultWorkingState } from '../model/state';
import { readControl } from './map';

const working = (changes: Partial<ReturnType<typeof defaultWorkingState>> = {}) => ({ ...defaultWorkingState(), ...changes });

describe('readControl', () => {
  it('reads Rate as pitch in octaves under Pitch, 0 at centre', () => {
    const pitch = { movementEffect: 98 };

    expect(readControl('rate', working({ ...pitch, rate: 0 }))).toMatchObject({ meaning: 'pitch', readout: '−1 oct', sides: ['−1 oct', '+1 oct'] });
    expect(readControl('rate', working({ ...pitch, rate: 64 })).readout).toBe('0 oct');
    expect(readControl('rate', working({ ...pitch, rate: 96 })).readout).toBe('+0.51 oct');
    expect(readControl('rate', working({ ...pitch, rate: 127 })).readout).toBe('+1 oct');
  });

  it('reads Rate as doubling time under Doubler, in percent', () => {
    expect(readControl('rate', working({ movementEffect: 10, rate: 127 }))).toMatchObject({ meaning: 'doubling time', readout: '100%' });
    expect(readControl('rate', working({ movementEffect: 10 })).sides).toBeUndefined();
  });

  it('reads Time as speed and pitch in octaves under Reverse', () => {
    expect(readControl('time', working({ diffusionEffect: 98, time: 32 }))).toMatchObject({ meaning: 'speed / pitch', readout: '−0.5 oct' });
  });

  it('follows the selected Effect’s help, and falls back to the control’s own', () => {
    expect(readControl('characterAmount', working({ characterEffect: 98 })).help).toMatch(/attack and decay/);
    expect(readControl('mix', working()).help).toMatch(/dry/);
    expect(readControl('mix', working()).meaning).toBeUndefined();
  });

  it('reads Tilt and the Secondary Controls as neutral at centre, and signed either side', () => {
    expect(readControl('tilt', working())).toMatchObject({ readout: 'neutral', sides: ['Dark', 'Bright'] });
    expect(readControl('outputLevel', working()).readout).toBe('neutral');
    expect(readControl('movementEffectVol', working({ movementEffectVol: 0 })).readout).toBe('−100%');
    expect(readControl('sensitivity', working({ sensitivity: 127 })).readout).toBe('+100%');
    expect(readControl('tilt', working({ tilt: 63 })).readout).toBe('−2%');
  });

  it('reads Mix, Amount and Drift as a percentage', () => {
    expect(readControl('mix', working()).readout).toBe('100%');
    expect(readControl('movementDrift', working()).readout).toBe('0%');
    expect(readControl('textureAmount', working({ textureAmount: 64 })).readout).toBe('50%');
  });
});
