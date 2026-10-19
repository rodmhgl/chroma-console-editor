import { MODULES, PARAMS } from '../../midi/map';
import { useEditorStore } from '../../store/editorStore';
import { EffectPicker } from '../EffectPicker';
import { Knob } from '../Knob';

/** Turning Tilt left darkens the Effect, right brightens it; centre is neutral. */
const TILT_SIDES = ['Dark', 'Bright'] as const;

/** The Character Module: its Effect, Amount and Tilt, each sent as it changes. */
export function CharacterModule() {
  const working = useEditorStore((s) => s.editor.working);
  const setParam = useEditorStore((s) => s.setParam);
  const selectEffect = useEditorStore((s) => s.selectEffect);
  const { characterAmount, tilt } = PARAMS;

  return (
    <section className="card module-card module-character" aria-labelledby="module-character-heading">
      <h2 id="module-character-heading" className="card-title module-title">
        {MODULES.character}
      </h2>
      <EffectPicker id="characterEffect" value={working.characterEffect} onSelect={(e) => selectEffect('characterEffect', e)} />
      <div className="module-knobs">
        <Knob param={characterAmount} value={working.characterAmount} onChange={(v) => setParam('characterAmount', v)} />
        <Knob
          param={tilt}
          value={working.tilt}
          bipolar={TILT_SIDES}
          readout={working.tilt === tilt.detent ? 'neutral' : undefined}
          onChange={(v) => setParam('tilt', v)}
        />
      </div>
    </section>
  );
}
