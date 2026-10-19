import type { CSSProperties } from 'react';
import type { ParamDef } from '../midi/map';
import { useValueDrag } from './useValueDrag';

const SWEEP_DEG = 270;

type Props = {
  param: ParamDef;
  value: number;
  onChange(value: number): void;
  /** Readout shown and spoken in place of the raw value, e.g. "neutral". */
  readout?: string;
  /** Marks noon, with these labels at the two ends of the sweep. */
  bipolar?: readonly [string, string];
};

/** A 0–127 knob, tinted by the Module it drives. The raw MIDI value shows small beside the label. */
export function Knob({ param, value, onChange, readout, bipolar }: Props) {
  const input = useValueDrag<HTMLDivElement>(param, value, onChange);
  const deg = ((value - param.min) / (param.max - param.min)) * SWEEP_DEG;
  const style = { '--knob-deg': `${deg}deg`, '--knob-angle': `${deg - SWEEP_DEG / 2}deg` } as CSSProperties;

  return (
    <div className={`knob module-${param.module}`} style={style} title={param.help}>
      <div
        {...input}
        className="knob-dial"
        role="slider"
        tabIndex={0}
        aria-label={param.label}
        aria-valuemin={param.min}
        aria-valuemax={param.max}
        aria-valuenow={value}
        aria-valuetext={readout}
      >
        {(bipolar || param.detent !== undefined) && <span className="knob-noon" aria-hidden="true" />}
        {bipolar && (
          <>
            <span className="knob-side knob-side-start" aria-hidden="true">
              {bipolar[0]}
            </span>
            <span className="knob-side knob-side-end" aria-hidden="true">
              {bipolar[1]}
            </span>
          </>
        )}
        <span className="knob-disc" aria-hidden="true">
          <span className="knob-pointer" />
        </span>
      </div>
      <div className="knob-text">
        <div className="knob-label">{param.label}</div>
        <div className="knob-value">
          {readout ?? value}
          {readout && <span className="knob-raw"> · {value}</span>}
        </div>
      </div>
    </div>
  );
}
