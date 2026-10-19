import { ControlKnob } from '../Knob';

/**
 * The pedal's top row of knobs: Tilt, Rate, Time and Mix, each tinted by the Module it drives, then Output Level, the
 * Secondary Control under Mix, which drives the whole pedal.
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
    </section>
  );
}
