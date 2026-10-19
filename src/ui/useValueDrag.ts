import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { clampToParam, type ParamDef } from '../midi/map';

/** Value units per pixel dragged; ⇧ for fine adjustment. */
const DRAG_UNITS_PER_PX = 0.55;
const FINE_UNITS_PER_PX = 0.12;
const PAGE_STEP = 10;

/**
 * Pointer, wheel and keyboard input for a 0–127 control: drag right or up to raise, ⇧ for fine,
 * double-click to reset to the detent or default, arrows/Page/Home/End when focused.
 */
export function useValueDrag<T extends HTMLElement>(param: ParamDef, value: number, onChange: (value: number) => void) {
  const drag = useRef<{ x: number; y: number; value: number } | null>(null);
  const ref = useRef<T>(null);
  // The wheel listener is attached once, so it reads the latest props through this.
  const latest = useRef({ param, value, onChange });
  latest.current = { param, value, onChange };

  const change = (next: number) => {
    const { param, value, onChange } = latest.current;
    const clamped = clampToParam(param, next);
    if (clamped !== value) onChange(clamped);
  };

  // React's wheel handler is passive, so it can't stop the page scrolling; attach one that can.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY === 0) return;
      e.preventDefault();
      change(latest.current.value + (e.deltaY < 0 ? 1 : -1));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const endDrag = () => {
    drag.current = null;
  };

  return {
    ref,
    onPointerDown(e: PointerEvent<T>) {
      if (e.button !== 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { x: e.clientX, y: e.clientY, value };
    },
    onPointerMove(e: PointerEvent<T>) {
      if (!drag.current) return;
      const delta = e.clientX - drag.current.x - (e.clientY - drag.current.y);
      change(drag.current.value + delta * (e.shiftKey ? FINE_UNITS_PER_PX : DRAG_UNITS_PER_PX));
    },
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    onDoubleClick() {
      change(param.detent ?? param.default);
    },
    onKeyDown(e: KeyboardEvent<T>) {
      const steps: Record<string, number> = {
        ArrowUp: 1,
        ArrowRight: 1,
        ArrowDown: -1,
        ArrowLeft: -1,
        PageUp: PAGE_STEP,
        PageDown: -PAGE_STEP,
        Home: -Infinity,
        End: Infinity,
      };
      const step = steps[e.key];
      if (step === undefined) return;
      e.preventDefault();
      change(Number.isFinite(step) ? value + step : step > 0 ? param.max : param.min);
    },
  };
}
