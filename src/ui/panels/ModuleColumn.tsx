import { ENGAGED_PARAMS, MODULES, PARAMS, fxSetupParams, isEngaged, type EffectParamId, type LevelParamId, type ModuleId } from '../../midi/map';
import { useEditorStore } from '../../store/editorStore';
import { ChoicePicker, EffectPicker } from '../EffectPicker';
import { ControlKnob } from '../Knob';

/** What each Module's column holds: its Effect, its Amount, and the Secondary Controls the pedal hides behind a menu. */
const COLUMNS: Record<ModuleId, { effect: EffectParamId; amount: LevelParamId; secondary: readonly LevelParamId[] }> = {
  character: { effect: 'characterEffect', amount: 'characterAmount', secondary: ['sensitivity', 'characterEffectVol'] },
  movement: { effect: 'movementEffect', amount: 'movementAmount', secondary: ['movementDrift', 'movementEffectVol'] },
  diffusion: { effect: 'diffusionEffect', amount: 'diffusionAmount', secondary: ['diffusionDrift', 'diffusionEffectVol'] },
  texture: { effect: 'textureEffect', amount: 'textureAmount', secondary: ['textureEffectVol'] },
};

export const MODULE_IDS = Object.keys(COLUMNS) as ModuleId[];

/**
 * One Module: Engaged/Bypassed, its Effect, Amount, FX Setup controls (Texture's Filter style) and Secondary Controls
 * together, each sent as it changes.
 */
export function ModuleColumn({ module }: { module: ModuleId }) {
  const { effect, amount, secondary } = COLUMNS[module];
  const effectValue = useEditorStore((s) => s.editor.working[effect]);
  const bypassed = useEditorStore((s) => !isEngaged(s.editor.working, module));
  const selectEffect = useEditorStore((s) => s.selectEffect);
  const headingId = `module-${module}-heading`;

  return (
    <section className={`card module-card module-${module}${bypassed ? ' is-bypassed' : ''}`} aria-labelledby={headingId}>
      <div className="module-header">
        <h2 id={headingId} className="card-title module-title">
          {MODULES[module]}
        </h2>
        <EngagedSwitch module={module} />
      </div>
      <EffectPicker id={effect} value={effectValue} onSelect={(e) => selectEffect(effect, e)} />
      <div className="module-knobs">
        <ControlKnob id={amount} />
      </div>
      {fxSetupParams(module).map((id) => (
        <ChoicePicker key={id} id={id} />
      ))}
      <div className="module-secondary" role="group" aria-labelledby={`${headingId}-secondary`}>
        <h3 id={`${headingId}-secondary`} className="module-secondary-title">
          Secondary Controls
        </h3>
        <div className="module-knobs">
          {secondary.map((id) => (
            <ControlKnob key={id} id={id} />
          ))}
        </div>
      </div>
    </section>
  );
}

/** Whether a Module is Engaged; Bypassing it keeps its Effect. Shown as a switch named "Engaged". */
function EngagedSwitch({ module }: { module: ModuleId }) {
  const engaged = useEditorStore((s) => isEngaged(s.editor.working, module));
  const setEngaged = useEditorStore((s) => s.setEngaged);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={engaged}
      aria-label="Engaged"
      className="engaged-switch"
      title={PARAMS[ENGAGED_PARAMS[module]].help}
      onClick={() => setEngaged(module, !engaged)}
    >
      <span className="engaged-switch-light" aria-hidden="true" />
      {engaged ? 'Engaged' : 'Bypassed'}
    </button>
  );
}
