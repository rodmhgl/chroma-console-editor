import { MODULES, type EffectParamId, type LevelParamId, type ModuleId } from '../../midi/map';
import { useEditorStore } from '../../store/editorStore';
import { EffectPicker } from '../EffectPicker';
import { ControlKnob } from '../Knob';

/** What each Module's column holds: its Effect, its Amount, and the Secondary Controls the pedal hides behind a menu. */
const COLUMNS: Record<ModuleId, { effect: EffectParamId; amount: LevelParamId; secondary: readonly LevelParamId[] }> = {
  character: { effect: 'characterEffect', amount: 'characterAmount', secondary: ['sensitivity', 'characterEffectVol'] },
  movement: { effect: 'movementEffect', amount: 'movementAmount', secondary: ['movementDrift', 'movementEffectVol'] },
  diffusion: { effect: 'diffusionEffect', amount: 'diffusionAmount', secondary: ['diffusionDrift', 'diffusionEffectVol'] },
  texture: { effect: 'textureEffect', amount: 'textureAmount', secondary: ['textureEffectVol'] },
};

export const MODULE_IDS = Object.keys(COLUMNS) as ModuleId[];

/** One Module: its Effect, Amount and Secondary Controls together, each sent as it changes. */
export function ModuleColumn({ module }: { module: ModuleId }) {
  const { effect, amount, secondary } = COLUMNS[module];
  const effectValue = useEditorStore((s) => s.editor.working[effect]);
  const selectEffect = useEditorStore((s) => s.selectEffect);
  const headingId = `module-${module}-heading`;

  return (
    <section className={`card module-card module-${module}`} aria-labelledby={headingId}>
      <h2 id={headingId} className="card-title module-title">
        {MODULES[module]}
      </h2>
      <EffectPicker id={effect} value={effectValue} onSelect={(e) => selectEffect(effect, e)} />
      <div className="module-knobs">
        <ControlKnob id={amount} />
      </div>
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
