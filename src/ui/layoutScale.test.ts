import { describe, expect, it } from 'vitest';
import { LAYOUT_HEIGHT, LAYOUT_WIDTH, MIN_WINDOW, layoutScale } from './layoutScale';

describe('layoutScale', () => {
  it('is 1 at the size the layout is drawn for', () => {
    expect(layoutScale(LAYOUT_WIDTH, LAYOUT_HEIGHT)).toBe(1);
  });

  it('grows and shrinks with the window, keeping proportions', () => {
    expect(layoutScale(LAYOUT_WIDTH * 1.5, LAYOUT_HEIGHT * 1.5)).toBe(1.5);
    expect(layoutScale(LAYOUT_WIDTH * 0.8, LAYOUT_HEIGHT * 0.8)).toBeCloseTo(0.8);
  });

  it('follows the tighter dimension, so a wide but short window doesn’t blow the layout up', () => {
    expect(layoutScale(LAYOUT_WIDTH * 2, LAYOUT_HEIGHT * 1.2)).toBeCloseTo(1.2);
    expect(layoutScale(LAYOUT_WIDTH * 1.2, LAYOUT_HEIGHT * 2)).toBeCloseTo(1.2);
  });

  it('stops shrinking at the minimum window; smaller windows scroll', () => {
    const atMinimum = layoutScale(MIN_WINDOW.width, MIN_WINDOW.height);
    expect(layoutScale(600, 400)).toBe(atMinimum);
    expect(LAYOUT_WIDTH * atMinimum).toBeCloseTo(MIN_WINDOW.width);
  });

  it('stops growing at 200%', () => {
    expect(layoutScale(LAYOUT_WIDTH * 4, LAYOUT_HEIGHT * 4)).toBe(2);
  });

  it('applies the UI scale setting on top of the fit to the window, past its limits', () => {
    expect(layoutScale(LAYOUT_WIDTH, LAYOUT_HEIGHT, 150)).toBe(1.5);
    expect(layoutScale(LAYOUT_WIDTH * 4, LAYOUT_HEIGHT * 4, 200)).toBe(4);
    expect(layoutScale(600, 400, 75)).toBeCloseTo(layoutScale(600, 400) * 0.75);
  });
});
