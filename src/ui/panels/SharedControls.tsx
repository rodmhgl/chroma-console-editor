import { fxSetupParams } from '../../midi/map';
import { ChoicePicker } from '../EffectPicker';
import { ControlKnob } from '../Knob';

/**
 * The pedal's top row of knobs: Tilt, Rate, Time and Mix, each tinted by the Module it drives, then Output Level, the
 * Secondary Control under Mix, which drives the whole pedal. Below them, the FX Setup controls of no one Module:
 * Capture Routing.
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
    </section>
  );
}
