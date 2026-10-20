import { PARAMS, fxSetupParams, type ChoiceId } from '../../midi/map';
import { shownState } from '../../model/core';
import { useEditorStore } from '../../store/editorStore';
import { ChoicePicker } from '../EffectPicker';
import { ControlKnob } from '../Knob';
import { PedalStepSetting } from '../PedalStepDiagram';

/**
 * The pedal's top row of knobs: Tilt, Rate, Time and Mix, each tinted by the Module it drives, then Output Level, the
 * Secondary Control under Mix, which drives the whole pedal. Below them, the FX Setup controls of no one Module:
 * Capture Routing, and the expression target.
 */
export function SharedControls() {
  return (
    <section className="card shared-controls" aria-labelledby="shared-controls-heading">
      <h2 id="shared-controls-heading" className="card-title">
        Shared controls
      </h2>
      <div className="shared-controls-knobs">
        <ControlKnob id="tilt" />
        <ControlKnob id="rate" />
        <ControlKnob id="time" />
        <ControlKnob id="mix" />
        <ControlKnob id="outputLevel" />
      </div>
      {fxSetupParams().map((id) => (
        <ChoicePicker key={id} id={id} />
      ))}
      <ExpressionTarget />
    </section>
  );
}

/** The Primary Control the expression pedal drives, or none. A Pedal Step setting: sends nothing. */
function ExpressionTarget() {
  const param = PARAMS.expressionTarget;
  const value = useEditorStore((s) => shownState(s.editor).expressionTarget);
  const selectChoice = useEditorStore((s) => s.selectChoice);
  return (
    <PedalStepSetting id="expressionTarget">
      {(labelId) => (
        <select
          className="pedal-step-select"
          aria-labelledby={labelId}
          value={param.choices.find((c) => c.value === value)?.id}
          onChange={(e) => selectChoice('expressionTarget', e.target.value as ChoiceId<'expressionTarget'>)}
        >
          {param.choices.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      )}
    </PedalStepSetting>
  );
}
