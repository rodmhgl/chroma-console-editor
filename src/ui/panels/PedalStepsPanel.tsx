import { pedalStep, type PedalStepParamId } from '../../midi/map';
import { unconfirmedPedalSteps } from '../../model/core';
import { useEditorStore } from '../../store/editorStore';
import { PedalStepDiagram } from '../PedalStepDiagram';

/**
 * The Pedal Steps for every setting changed on screen but not yet applied on the pedal, shown as soon as one changes.
 * Marking one done tells the editor the pedal now matches.
 */
export function PedalStepsPanel() {
  const working = useEditorStore((s) => s.editor.working);
  const confirmed = useEditorStore((s) => s.editor.confirmed);
  const ids = unconfirmedPedalSteps({ working, confirmed });
  if (ids.length === 0) return null;
  return (
    <section className="card pedal-steps" aria-labelledby="pedal-steps-heading">
      <h2 id="pedal-steps-heading" className="card-title">
        Pedal Steps
      </h2>
      <p className="pedal-steps-note">MIDI can’t reach these settings. Do each one by hand on the pedal, then mark it done.</p>
      {ids.map((id) => (
        <PedalStepCard key={id} id={id} />
      ))}
    </section>
  );
}

function PedalStepCard({ id }: { id: PedalStepParamId }) {
  const working = useEditorStore((s) => s.editor.working);
  const confirmPedalStep = useEditorStore((s) => s.confirmPedalStep);
  const step = pedalStep(id, working);
  const headingId = `pedal-step-${id}-heading`;
  return (
    <div className="pedal-step" role="group" aria-labelledby={headingId}>
      <h3 id={headingId} className="pedal-step-title">
        {step.title}
      </h3>
      <PedalStepDiagram step={step} />
      <button type="button" className="bar-button is-primary" onClick={() => confirmPedalStep(id)}>
        Done on the pedal
      </button>
    </div>
  );
}
