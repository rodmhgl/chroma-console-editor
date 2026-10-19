import { PARAMS, effectAt, type EffectId, type EffectParamId } from '../midi/map';

type Props<P extends EffectParamId> = {
  id: P;
  value: number;
  onSelect(effect: EffectId<P>): void;
};

/** A Module's Effect, chosen by name from its five; the CC range stays out of sight. */
export function EffectPicker<P extends EffectParamId>({ id, value, onSelect }: Props<P>) {
  const param = PARAMS[id];
  const selected = effectAt(param, value);
  return (
    <fieldset className="effect-picker" title={param.help}>
      <legend className="sr-only">{param.label}</legend>
      <div className="effect-picker-options">
        {param.effects.map((effect) => (
          <label key={effect.id} className={effect.id === selected?.id ? 'is-active' : undefined}>
            <input
              type="radio"
              className="effect-picker-input"
              name={id}
              checked={effect.id === selected?.id}
              onChange={() => onSelect(effect.id)}
            />
            {effect.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
