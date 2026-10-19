import { PEDAL_CONTROLS, type PedalControlId, type PedalMove, type PedalStep } from '../midi/map';

/** Marks a setting MIDI can't reach, so changing it on screen doesn't change the sound until its Pedal Step is done. */
export function PedalStepBadge() {
  return (
    <span className="pedal-step-badge" title="MIDI can’t reach this setting. Changing it here sends nothing: the editor shows the Pedal Step to do it on the pedal.">
      Pedal Step
    </span>
  );
}

/** Where each control sits on the pedal's face: the four buttons in a row above the two footswitches. */
const LAYOUT: Record<PedalControlId, { x: number; y: number; r: number }> = {
  a: { x: 22, y: 20, r: 8 },
  b: { x: 46, y: 20, r: 8 },
  c: { x: 70, y: 20, r: 8 },
  d: { x: 94, y: 20, r: 8 },
  tap: { x: 34, y: 52, r: 11 },
  bypass: { x: 82, y: 52, r: 11 },
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

/** What a move asks for, in a few words: a tap, a hold, or either of them on several controls together. */
function moveSummary(move: PedalMove) {
  const together = move.controls.length > 1;
  const verb = move.action === 'hold' ? 'Hold' : together ? 'Press' : 'Tap';
  return { verb, together, names: move.controls.map((c) => PEDAL_CONTROLS[c]).join(' + ') };
}

/**
 * The pedal's buttons and footswitches with this move's controls lit: filled for a tap or press, ringed as well for
 * a hold. Generated from the move, never drawn by hand.
 */
function PedalFace({ move }: { move: PedalMove }) {
  const { verb, together, names } = moveSummary(move);
  const label = `${verb} ${names}${together ? ' together' : ''}`;
  return (
    <svg className="pedal-face" viewBox="0 0 116 86" role="img" aria-label={label}>
      <rect className="pedal-face-body" x="1" y="1" width="114" height="68" rx="8" />
      {CONTROL_IDS.map((id) => {
        const { x, y, r } = LAYOUT[id];
        const lit = move.controls.includes(id);
        const footswitch = id === 'tap' || id === 'bypass';
        return (
          <g key={id} className={`pedal-face-control${lit ? ` is-${move.action}` : ''}`}>
            {lit && move.action === 'hold' && <circle className="pedal-face-hold-ring" cx={x} cy={y} r={r + 3.5} />}
            <circle cx={x} cy={y} r={r} />
            <text x={x} y={y} dy="0.35em" textAnchor="middle" className={footswitch ? 'is-footswitch' : undefined}>
              {PEDAL_CONTROLS[id]}
            </text>
          </g>
        );
      })}
      <text className="pedal-face-action" x="58" y="80" textAnchor="middle">
        {verb}
        {together ? ' together' : ''}
      </text>
    </svg>
  );
}
