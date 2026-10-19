import { useId, type CSSProperties } from 'react';
import { PARAMS, readControl, type ControlReading, type LevelParamId, type ParamDef } from '../midi/map';
import { useEditorStore } from '../store/editorStore';
import { useValueDrag } from './useValueDrag';

const SWEEP_DEG = 270;

type Props = {
  param: ParamDef;
  value: number;
  onChange(value: number): void;
  /** The value in the pedal's terms, what the control means under the selected Effect, and its hover help. */
  reading: ControlReading;
};

/**
 * A 0–127 knob, tinted by the Module it drives. The value reads in the pedal's terms, with the raw MIDI value small
 * beside it.
 */
export function Knob({ param, value, onChange, reading }: Props) {
  const meaningId = useId();
  const input = useValueDrag<HTMLDivElement>(param, value, onChange);
  const deg = ((value - param.min) / (param.max - param.min)) * SWEEP_DEG;
  const style = { '--knob-deg': `${deg}deg`, '--knob-angle': `${deg - SWEEP_DEG / 2}deg` } as CSSProperties;
  const { sides } = reading;
  const className = ['knob', param.module && `module-${param.module}`, param.group === 'secondary' && 'knob-small'].filter(Boolean).join(' ');

  return (
    <div className={className} style={style} title={reading.help}>
      <div
        {...input}
        className="knob-dial"
        role="slider"
        tabIndex={0}
        aria-label={param.label}
        aria-valuemin={param.min}
        aria-valuemax={param.max}
        aria-valuenow={value}
        aria-valuetext={reading.readout}
        aria-describedby={reading.meaning ? meaningId : undefined}
      >
        {(sides || param.detent !== undefined) && <span className="knob-noon" aria-hidden="true" />}
        {sides && (
          <>
            <span className="knob-side knob-side-start" aria-hidden="true">
              {sides[0]}
            </span>
            <span className="knob-side knob-side-end" aria-hidden="true">
              {sides[1]}
            </span>
          </>
        )}
        <span className="knob-disc" aria-hidden="true">
          <span className="knob-pointer" />
        </span>
      </div>
      <div className="knob-text">
        <div className="knob-label">{param.label}</div>
        {/* Kept when empty, so knobs side by side line up whichever Effect is selected. */}
        <div id={meaningId} className="knob-meaning">{reading.meaning ?? '\u00a0'}</div>
        <div className="knob-value">
          {reading.readout}
          <span className="knob-raw"> · {value}</span>
        </div>
      </div>
    </div>
  );
}

/** A knob for one Working State control, read and sent through the editor store. */
export function ControlKnob({ id }: { id: LevelParamId }) {
  const working = useEditorStore((s) => s.editor.working);
  const setParam = useEditorStore((s) => s.setParam);
  return <Knob param={PARAMS[id]} value={working[id]} reading={readControl(id, working)} onChange={(v) => setParam(id, v)} />;
}
