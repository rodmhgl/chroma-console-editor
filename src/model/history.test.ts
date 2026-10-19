import { describe, expect, it } from 'vitest';
import { EMPTY_HISTORY, HISTORY_LIMIT, beginDrag, canRedo, canUndo, endDrag, record, redo, undo } from './history';

describe('history', () => {
  it('starts with nothing to undo or redo', () => {
    expect(canUndo(EMPTY_HISTORY)).toBe(false);
    expect(canRedo(EMPTY_HISTORY)).toBe(false);
    expect(undo(EMPTY_HISTORY)).toBeNull();
    expect(redo(EMPTY_HISTORY)).toBeNull();
  });

  it('undoes to the value before an edit, then redoes to the value after it', () => {
    let h = record(EMPTY_HISTORY, 'characterAmount', 64, 90);
    h = record(h, 'tilt', 0, 30);

    const first = undo(h)!;
    expect(first.values).toEqual({ tilt: 0 });
    const second = undo(first.history)!;
    expect(second.values).toEqual({ characterAmount: 64 });
    expect(canUndo(second.history)).toBe(false);

    const again = redo(second.history)!;
    expect(again.values).toEqual({ characterAmount: 90 });
    expect(redo(again.history)!.values).toEqual({ tilt: 30 });
  });

  it('ignores an edit that changes nothing', () => {
    expect(record(EMPTY_HISTORY, 'characterAmount', 64, 64)).toBe(EMPTY_HISTORY);
  });

  it('drops the redo steps once a new edit is made', () => {
    const h = undo(record(EMPTY_HISTORY, 'characterAmount', 64, 90))!.history;
    expect(canRedo(h)).toBe(true);
    expect(canRedo(record(h, 'tilt', 0, 30))).toBe(false);
  });

  it('coalesces every edit in a drag into one step', () => {
    let h = beginDrag(record(EMPTY_HISTORY, 'tilt', 0, 30));
    h = record(h, 'characterAmount', 64, 70);
    h = record(h, 'characterAmount', 70, 80);
    h = record(h, 'characterAmount', 80, 90);
    h = endDrag(h);
    h = record(h, 'characterAmount', 90, 100);

    const last = undo(h)!;
    expect(last.values).toEqual({ characterAmount: 90 });
    const drag = undo(last.history)!;
    expect(drag.values).toEqual({ characterAmount: 64 });
    expect(redo(drag.history)!.values).toEqual({ characterAmount: 90 });
    expect(undo(drag.history)!.values).toEqual({ tilt: 0 });
  });

  it('starts a new step for the next drag', () => {
    let h = endDrag(record(beginDrag(EMPTY_HISTORY), 'characterAmount', 64, 70));
    h = endDrag(record(beginDrag(h), 'characterAmount', 70, 80));
    expect(undo(h)!.values).toEqual({ characterAmount: 70 });
  });

  it('records nothing for a drag that ends where it began', () => {
    let h = beginDrag(EMPTY_HISTORY);
    h = record(h, 'characterAmount', 64, 70);
    h = record(h, 'characterAmount', 70, 64);
    expect(canUndo(endDrag(h))).toBe(false);
  });

  it('records nothing for a drag with no edits', () => {
    expect(canUndo(endDrag(beginDrag(EMPTY_HISTORY)))).toBe(false);
  });

  it('makes the rest of a drag one new step after an undo mid-drag', () => {
    let h = record(beginDrag(record(EMPTY_HISTORY, 'tilt', 0, 30)), 'characterAmount', 64, 70);
    h = undo(h)!.history;
    h = record(h, 'characterAmount', 64, 80);
    h = endDrag(record(h, 'characterAmount', 80, 90));
    expect(undo(h)!.values).toEqual({ characterAmount: 64 });
    expect(undo(undo(h)!.history)!.values).toEqual({ tilt: 0 });
  });

  it(`keeps only the last ${HISTORY_LIMIT} steps`, () => {
    let h = EMPTY_HISTORY;
    for (let i = 0; i <= HISTORY_LIMIT; i++) h = record(h, 'characterAmount', i, i + 1);
    let undos = 0;
    for (let step = undo(h); step; step = undo(step.history)) undos++;
    expect(undos).toBe(HISTORY_LIMIT);
  });
});
