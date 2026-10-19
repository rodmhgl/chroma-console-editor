import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createThrottle } from './throttle';

describe('createThrottle', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('sends the first message at once', () => {
    const sent: number[][] = [];
    const throttle = createThrottle(5, (m) => sent.push(m));

    throttle.send('sensitivity', [0xb1, 15, 1]);

    expect(sent).toEqual([[0xb1, 15, 1]]);
  });

  it('sends at most one message per interval per key, and always the final value', () => {
    const sent: number[][] = [];
    const throttle = createThrottle(5, (m) => sent.push(m));

    throttle.send('sensitivity', [0xb1, 15, 1]);
    throttle.send('sensitivity', [0xb1, 15, 2]);
    throttle.send('sensitivity', [0xb1, 15, 3]);
    expect(sent).toEqual([[0xb1, 15, 1]]);

    vi.advanceTimersByTime(4);
    expect(sent).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(sent).toEqual([
      [0xb1, 15, 1],
      [0xb1, 15, 3],
    ]);

    vi.advanceTimersByTime(50);
    expect(sent).toHaveLength(2);
  });

  it('keeps each key to its own budget', () => {
    const sent: number[][] = [];
    const throttle = createThrottle(5, (m) => sent.push(m));

    throttle.send('sensitivity', [0xb1, 15, 1]);
    throttle.send('eq', [0xb1, 18, 1]);

    expect(sent).toEqual([
      [0xb1, 15, 1],
      [0xb1, 18, 1],
    ]);
  });

  it('sends at once again after a quiet interval', () => {
    const sent: number[][] = [];
    const throttle = createThrottle(5, (m) => sent.push(m));

    throttle.send('sensitivity', [0xb1, 15, 1]);
    vi.advanceTimersByTime(5);
    throttle.send('sensitivity', [0xb1, 15, 2]);

    expect(sent).toEqual([
      [0xb1, 15, 1],
      [0xb1, 15, 2],
    ]);
  });

  it('spaces a long drag at the interval', () => {
    const sent: number[][] = [];
    const throttle = createThrottle(5, (m) => sent.push(m));

    for (let v = 0; v < 20; v++) {
      throttle.send('sensitivity', [0xb1, 15, v]);
      vi.advanceTimersByTime(1);
    }
    vi.advanceTimersByTime(5);

    expect(sent.map((m) => m[2])).toEqual([0, 4, 9, 14, 19]);
  });
});
