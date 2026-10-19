import { CALIBRATION_LEVEL, PERFORMANCE_CONTROLS, type PerformanceActionId, type PerformanceControlDef, type PerformanceControlId } from '../../midi/map';
import { useEditorStore } from '../../store/editorStore';
import { Picker } from '../EffectPicker';

/** The Performance Controls in this panel, in footswitch order; the Calibration menu sits with Calibration Level. */
const PERFORMANCE_ORDER = ['capture', 'gesture', 'tap', 'pedal', 'dualBypass'] as const satisfies readonly PerformanceControlId[];

/**
 * Everything the editor sends that is not part of a Preset, kept apart from the editing panel: the momentary
 * Performance Controls, and the Global Settings the editor can reach.
 */
export function PerformancePanel() {
  return (
    <div className="pedal-wide">
      <section className="card pedal-wide-card" aria-labelledby="performance-heading">
        <h2 id="performance-heading" className="card-title">
          Performance Controls
        </h2>
        <p className="pedal-wide-note">Sent as you press them, like a footswitch. Never stored in a Preset.</p>
        <div className="performance-controls">
          {PERFORMANCE_ORDER.map((id) => (
            <PerformanceControl key={id} id={id} />
          ))}
        </div>
      </section>
      <GlobalSettingsPanel />
    </div>
  );
}

/** One Performance Control: a button for each of its actions. */
function PerformanceControl({ id }: { id: PerformanceControlId }) {
  const perform = useEditorStore((s) => s.perform);
  const control: PerformanceControlDef = PERFORMANCE_CONTROLS[id];
  const headingId = `performance-${id}-heading`;
  return (
    <div className="performance-control" role="group" aria-labelledby={headingId} title={control.help}>
      <h3 id={headingId} className="performance-control-title">
        {control.label}
      </h3>
      <div className="performance-actions">
        {control.actions.map((action) => (
          <button
            key={action.id}
            type="button"
            className="performance-button"
            title={action.help}
            onClick={() => perform(id, action.id as PerformanceActionId)}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Calibration Level, which the pedal applies to every Preset, and the Calibration menu that sets it automatically. */
function GlobalSettingsPanel() {
  const level = useEditorStore((s) => s.editor.global.calibrationLevel);
  const setCalibrationLevel = useEditorStore((s) => s.setCalibrationLevel);
  const value = CALIBRATION_LEVEL.choices.find((c) => c.id === level)?.value;
  return (
    <section className="card pedal-wide-card" aria-labelledby="global-settings-heading">
      <h2 id="global-settings-heading" className="card-title">
        Global Settings
      </h2>
      <p className="pedal-wide-note">
        The pedal keeps these through power cycles: Calibration Level applies to every Preset and is never saved in one.
        {level === null && ' The pedal can’t report its level, so none is shown until you choose one here.'}
      </p>
      <Picker
        name={CALIBRATION_LEVEL.id}
        label={CALIBRATION_LEVEL.label}
        help={CALIBRATION_LEVEL.help}
        options={CALIBRATION_LEVEL.choices}
        value={value}
        onSelect={setCalibrationLevel}
        row
      />
      <PerformanceControl id="calibrationMenu" />
    </section>
  );
}
