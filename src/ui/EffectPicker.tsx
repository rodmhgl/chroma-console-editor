import { PARAMS, type ChoiceDef, type ChoiceId, type ChoiceParamId, type EffectId, type EffectParamId } from '../midi/map';
import { useEditorStore } from '../store/editorStore';

type PickerProps<Id extends string> = {
  name: string;
  label: string;
  help: string;
  options: readonly (ChoiceDef & { id: Id })[];
  value: number;
  onSelect(id: Id): void;
  /** Lays the options out side by side rather than stacked. */
  row?: boolean;
};

/** One of a few named settings, chosen by name; the CC range stays out of sight. */
function Picker<Id extends string>({ name, label, help, options, value, onSelect, row }: PickerProps<Id>) {
  const selected = options.find((o) => value >= o.min && value <= o.max);
  return (
    <fieldset className={row ? 'effect-picker effect-picker-row' : 'effect-picker'} title={help}>
      <legend className={row ? 'effect-picker-legend' : 'sr-only'}>{label}</legend>
      <div className="effect-picker-options">
        {options.map((option) => (
          <label key={option.id} className={option.id === selected?.id ? 'is-active' : undefined} title={option.help}>
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

type Props<P extends EffectParamId> = {
  id: P;
  value: number;
  onSelect(effect: EffectId<P>): void;
};

/** A Module's Effect, chosen by name from its five. */
export function EffectPicker<P extends EffectParamId>({ id, value, onSelect }: Props<P>) {
  const param = PARAMS[id];
  return (
    <Picker
      name={id}
      label={param.label}
      help={param.help}
      options={param.effects as readonly (ChoiceDef & { id: EffectId<P> })[]}
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
