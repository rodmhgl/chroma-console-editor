import { useEffect, useRef, useState } from 'react';

/** An armed button waits this long for its confirming click. */
const CONFIRM_MS = 5000;

/**
 * Two-click confirmation for actions that can't be undone: the first click arms, a second within a few
 * seconds runs `action`. Pass `resetKey` to disarm whenever what the action targets changes. With `enabled` false
 * the first click runs it.
 */
export function useArmedConfirm(action: () => void, resetKey?: unknown, enabled = true) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => setArmed(false), [resetKey]);

  const click = () => {
    clearTimeout(timer.current);
    if (!armed && enabled) {
      setArmed(true);
      timer.current = setTimeout(() => setArmed(false), CONFIRM_MS);
      return;
    }
    setArmed(false);
    action();
  };
  return { armed, click };
}
