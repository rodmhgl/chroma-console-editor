import { PARAMS, type ChoiceDef, type ChoiceId, type ChoiceParamId, type EffectColour, type EffectDef, type EffectId, type EffectParamId } from '../midi/map';
import { useEditorStore } from '../store/editorStore';

type PickerProps<Id extends string> = {
  name: string;
  label: string;
  help: string;
  /** An option with a `colour`, as an Effect has, is filled with it when selected and shows a swatch of it when not. */
  options: readonly (ChoiceDef & { id: Id; colour?: EffectColour })[];
  /** The value set; undefined when it isn't known, which leaves every option unchecked. */
  value: number | undefined;
  onSelect(id: Id): void;
  /** Lays the options out side by side rather than stacked. */
  row?: boolean;
};

/** One of a few named settings, chosen by name; the CC range stays out of sight. */
export function Picker<Id extends string>({ name, label, help, options, value, onSelect, row }: PickerProps<Id>) {
  const selected = value === undefined ? undefined : options.find((o) => value >= o.min && value <= o.max);
  const className = ['effect-picker', row && 'effect-picker-row', options.some((o) => o.colour) && 'effect-picker-colours'].filter(Boolean).join(' ');
  return (
    <fieldset className={className} title={help}>
      <legend className={row ? 'effect-picker-legend' : 'sr-only'}>{label}</legend>
      <div className="effect-picker-options">
        {options.map((option) => (
          <label key={option.id} className={optionClass(option.id === selected?.id, option.colour)} title={option.help}>
            {option.colour && <span className="effect-swatch" aria-hidden="true" />}
            <input
              type="radio"
              className="effect-picker-input"
              name={name}
              checked={option.id === selected?.id}
              onChange={() => onSelect(option.id)}
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function optionClass(active: boolean, colour: EffectColour | undefined): string | undefined {
  return [active && 'is-active', colour && `effect-${colour}`].filter(Boolean).join(' ') || undefined;
}

type Props<P extends EffectParamId> = {
  id: P;
  value: number;
  onSelect(effect: EffectId<P>): void;
};

/** A Module's Effect, chosen by name from its five, each in its Effect Colour. */
export function EffectPicker<P extends EffectParamId>({ id, value, onSelect }: Props<P>) {
  const param = PARAMS[id];
  return (
    <Picker
      name={id}
      label={param.label}
      help={param.help}
      options={param.effects as readonly (EffectDef & { id: EffectId<P> })[]}
      value={value}
      onSelect={onSelect}
    />
  );
}

/** An FX Setup control such as Filter style, read and sent through the editor store. */
export function ChoicePicker<P extends ChoiceParamId>({ id }: { id: P }) {
  const param = PARAMS[id];
  const value = useEditorStore((s) => s.editor.working[id]);
  const selectChoice = useEditorStore((s) => s.selectChoice);
  return (
    <Picker
      name={id}
      label={param.label}
      help={param.help}
      options={param.choices as readonly (ChoiceDef & { id: ChoiceId<P> })[]}
      value={value}
      onSelect={(choice) => selectChoice(id, choice)}
      row
    />
  );
}
