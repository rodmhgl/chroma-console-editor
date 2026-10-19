import type { MidiMessage } from './encode';

export type Throttle = {
  /** Sends at once if `key` is within budget, otherwise holds it as the value to send next. */
  send(key: string, message: MidiMessage): void;
};

/**
 * Limits each key to one message per `intervalMs`. A message held back is replaced by any newer
 * one for the same key and sent when the interval is up, so the final value always goes out.
 */
export function createThrottle(intervalMs: number, out: (message: MidiMessage) => void): Throttle {
  const lastSent = new Map<string, number>();
  const pending = new Map<string, MidiMessage>();

  function flush(key: string) {
    const message = pending.get(key);
    pending.delete(key);
    if (!message) return;
    lastSent.set(key, Date.now());
    out(message);
  }

  return {
    send(key, message) {
      const wait = (lastSent.get(key) ?? -Infinity) + intervalMs - Date.now();
      if (pending.has(key)) {
        pending.set(key, message);
      } else if (wait <= 0) {
        lastSent.set(key, Date.now());
        out(message);
      } else {
        pending.set(key, message);
        setTimeout(() => flush(key), wait);
      }
    },
  };
}
