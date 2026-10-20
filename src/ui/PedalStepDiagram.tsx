import type { ReactNode } from 'react';
import { PARAMS, PEDAL_CONTROLS, type PedalControlId, type PedalMove, type PedalStep, type PedalStepParamId } from '../midi/map';

/** Marks a setting MIDI can't reach, so changing it on screen doesn't change the sound until its Pedal Step is done. */
function PedalStepBadge() {
  return (
    <span className="pedal-step-badge" title="MIDI can’t reach this setting. Changing it here sends nothing: the editor shows the Pedal Step to do it on the pedal.">
      Pedal Step
    </span>
  );
}

/**
 * A Pedal Step setting's control, named by its label and marked with the Pedal Step badge. `children` is labelled by
 * the setting's name through `labelId`.
 */
export function PedalStepSetting({ id, help, children }: { id: PedalStepParamId; help?: string; children(labelId: string): ReactNode }) {
  const labelId = `pedal-step-setting-${id}-label`;
  return (
    <div className="pedal-step-setting" role="group" aria-labelledby={labelId} title={help ?? PARAMS[id].help}>
      <span id={labelId} className="pedal-step-setting-label">
        {PARAMS[id].label}
      </span>
      {children(labelId)}
      <PedalStepBadge />
    </div>
  );
}

type Shape = { x: number; y: number; r: number; kind: 'button' | 'footswitch' | 'knob' | 'expression'; label: string };

const knob = (x: number, y: number, label: string): Shape => ({ x, y, r: 5, kind: 'knob', label });

/**
 * Where each control sits on the pedal's face: the top row of knobs (Tilt, Rate, Time, Mix) above the Amounts, each
 * column one Module's, then the four buttons, then the two footswitches. The expression pedal stands beside it.
 */
const LAYOUT: Record<PedalControlId, Shape> = {
  tilt: knob(22, 12, 'TILT'),
  rate: knob(46, 12, 'RATE'),
  time: knob(70, 12, 'TIME'),
  mix: knob(94, 12, 'MIX'),
  characterAmount: knob(22, 32, 'AMT'),
  movementAmount: knob(46, 32, 'AMT'),
  diffusionAmount: knob(70, 32, 'AMT'),
  textureAmount: knob(94, 32, 'AMT'),
  a: { x: 22, y: 56, r: 8, kind: 'button', label: 'A' },
  b: { x: 46, y: 56, r: 8, kind: 'button', label: 'B' },
  c: { x: 70, y: 56, r: 8, kind: 'button', label: 'C' },
  d: { x: 94, y: 56, r: 8, kind: 'button', label: 'D' },
  tap: { x: 34, y: 86, r: 11, kind: 'footswitch', label: 'TAP' },
  bypass: { x: 82, y: 86, r: 11, kind: 'footswitch', label: 'BYPASS' },
  expression: { x: 133, y: 76, r: 11, kind: 'expression', label: 'EXP' },
};

const CONTROL_IDS = Object.keys(LAYOUT) as PedalControlId[];

/** A Pedal Step as a numbered sequence of moves, each drawn on the pedal's face. */
export function PedalStepDiagram({ step }: { step: PedalStep }) {
  return (
    <ol className="pedal-step-moves" aria-label={`${step.title}: moves`}>
      {step.moves.map((move, i) => (
        <li key={i} className="pedal-step-move">
          <PedalFace move={move} />
          <p className="pedal-step-text">
            <span className="pedal-step-number" aria-hidden="true">
              {i + 1}
            </span>
            {move.text}
          </p>
        </li>
      ))}
    </ol>
  );
}

const names = (controls: readonly PedalControlId[]) => controls.map((c) => PEDAL_CONTROLS[c]).join(' + ');

/** What a move asks for, in a few words: a tap, a hold or a move, on several controls together, with others held. */
function moveSummary(move: PedalMove) {
  const together = move.controls.length > 1 ? ' together' : '';
  const verb = move.action === 'hold' ? 'Hold' : move.action === 'move' ? 'Move' : together ? 'Press' : 'Tap';
  const holding = move.holding?.length ? names(move.holding) : undefined;
  return {
    label: `${verb} ${names(move.controls)}${together}${holding ? ` while holding ${holding}` : ''}`,
    caption: `${verb}${together}${holding ? `, ${holding} held` : ''}`,
  };
}

/**
 * The pedal's knobs, buttons and footswitches, and the expression pedal, with this move's controls lit: filled for a
 * tap, press or move, ringed as well for a hold, as is any control held from an earlier move. Generated from the move,
 * never drawn by hand.
 */
function PedalFace({ move }: { move: PedalMove }) {
  const { label, caption } = moveSummary(move);
  return (
    <svg className="pedal-face" viewBox="0 0 148 114" role="img" aria-label={label}>
      <rect className="pedal-face-body" x="1" y="1" width="114" height="102" rx="8" />
      {CONTROL_IDS.map((id) => {
        const shape = LAYOUT[id];
        const held = move.holding?.includes(id) ?? false;
        const state = move.controls.includes(id) ? move.action : held ? 'hold' : undefined;
        return (
          <g key={id} className={`pedal-face-control is-${shape.kind}${state ? ` is-${state}` : ''}`}>
            <ControlShape shape={shape} ringed={state === 'hold'} />
          </g>
        );
      })}
      <text className="pedal-face-action" x="74" y="111" textAnchor="middle">
        {caption}
      </text>
    </svg>
  );
}

/** One control drawn in its place. Only a button or footswitch is ever held, so only they take the hold ring. */
function ControlShape({ shape: { x, y, r, kind, label }, ringed }: { shape: Shape; ringed: boolean }) {
  if (kind === 'expression') {
    // A treadle, drawn as a tall rounded rectangle.
    return (
      <>
        <rect x={x - r} y={y - r * 2} width={r * 2} height={r * 4} rx="4" />
        <text x={x} y={y} dy="0.35em" textAnchor="middle">
          {label}
        </text>
      </>
    );
  }
  if (kind === 'knob') {
    return (
      <>
        <circle cx={x} cy={y} r={r} />
        <text x={x} y={y + r + 4.5} textAnchor="middle">
          {label}
        </text>
      </>
    );
  }
  return (
    <>
      {ringed && <circle className="pedal-face-hold-ring" cx={x} cy={y} r={r + 3.5} />}
      <circle cx={x} cy={y} r={r} />
      <text x={x} y={y} dy="0.35em" textAnchor="middle">
        {label}
      </text>
    </>
  );
}
