import { useState, type KeyboardEvent } from 'react';
import {
  ENGAGED_PARAMS,
  MODULES,
  PARAMS,
  effectAt,
  fxSetupParams,
  isEngaged,
  moduleOrderAt,
  settingLabel,
  type EffectColour,
  type EffectParamId,
  type LevelParamId,
  type ModuleId,
} from '../../midi/map';
import { shownState } from '../../model/core';
import { useEditorStore } from '../../store/editorStore';
import { ChoicePicker, EffectPicker } from '../EffectPicker';
import { ControlKnob } from '../Knob';
import { PedalStepBadge } from '../PedalStepDiagram';

/** What each Module's column holds: its Effect, its Amount, and the Secondary Controls the pedal hides behind a menu. */
const COLUMNS: Record<ModuleId, { effect: EffectParamId; amount: LevelParamId; secondary: readonly LevelParamId[] }> = {
  character: { effect: 'characterEffect', amount: 'characterAmount', secondary: ['sensitivity', 'characterEffectVol'] },
  movement: { effect: 'movementEffect', amount: 'movementAmount', secondary: ['movementDrift', 'movementEffectVol'] },
  diffusion: { effect: 'diffusionEffect', amount: 'diffusionAmount', secondary: ['diffusionDrift', 'diffusionEffectVol'] },
  texture: { effect: 'textureEffect', amount: 'textureAmount', secondary: ['textureEffectVol'] },
};

const MODULE_ORDER_HELP = `${PARAMS.moduleOrder.help} Drag a Module by its handle, or focus the handle and use the arrow keys.`;

/**
 * The four Modules side by side in the Working State's Module Order, which the user sets by dragging them. Module
 * Order is a Pedal Step setting, so reordering sends nothing.
 */
export function Modules() {
  const index = useEditorStore((s) => shownState(s.editor).moduleOrder);
  const setModuleOrder = useEditorStore((s) => s.setModuleOrder);
  const [dragging, setDragging] = useState<ModuleId | null>(null);
  const order = moduleOrderAt(index);

  /** Moves `module` to position `to`; arrowing past either end does nothing. */
  const move = (module: ModuleId, to: number) => {
    if (to < 0 || to >= order.length) return;
    const next = order.filter((m) => m !== module);
    next.splice(to, 0, module);
    setModuleOrder(next);
  };

  return (
    <div className="modules-area">
      <div className="module-order" role="group" aria-labelledby="module-order-label" title={MODULE_ORDER_HELP}>
        <span id="module-order-label" className="module-order-label">
          Module Order
        </span>
        <output>{settingLabel(PARAMS.moduleOrder, index)}</output>
        <PedalStepBadge />
      </div>
      <div className="modules">
        {order.map((module, position) => (
          <ModuleColumn
            key={module}
            module={module}
            position={position}
            dragging={dragging}
            onDragChange={setDragging}
            onMove={move}
          />
        ))}
      </div>
    </div>
  );
}

type ModuleColumnProps = {
  module: ModuleId;
  /** Where the Module sits in the Module Order, from 0. */
  position: number;
  /** The Module being dragged, if any. */
  dragging: ModuleId | null;
  onDragChange(module: ModuleId | null): void;
  /** Moves a Module to another position in the Module Order. */
  onMove(module: ModuleId, to: number): void;
};

/**
 * One Module: Engaged/Bypassed, its Effect, Amount, FX Setup controls (Texture's Filter style) and Secondary Controls
 * together, each sent as it changes. Dropping a dragged Module on it moves that Module to its position.
 */
function ModuleColumn({ module, position, dragging, onDragChange, onMove }: ModuleColumnProps) {
  const { effect, amount, secondary } = COLUMNS[module];
  const effectValue = useEditorStore((s) => shownState(s.editor)[effect]);
  const colour = effectAt(PARAMS[effect], effectValue)?.colour;
  const bypassed = useEditorStore((s) => !isEngaged(shownState(s.editor), module));
  const selectEffect = useEditorStore((s) => s.selectEffect);
  const headingId = `module-${module}-heading`;

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const step = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
    if (!step) return;
    e.preventDefault();
    onMove(module, position + step);
    // Reordering moves the column in the page, which can drop focus from the handle.
    const handle = e.currentTarget;
    requestAnimationFrame(() => handle.focus());
  };

  return (
    <section
      className={`card module-card module-${module}${bypassed ? ' is-bypassed' : ''}${dragging === module ? ' is-dragging' : ''}`}
      aria-labelledby={headingId}
      onDragOver={(e) => {
        if (dragging) e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (dragging) onMove(dragging, position);
        onDragChange(null);
      }}
    >
      <div className="module-header">
        {/* Not a <button>, and with no element inside: Chromium starts no drag from either. */}
        <span
          role="button"
          tabIndex={0}
          className="module-handle"
          draggable
          aria-label={`Move ${MODULES[module]}`}
          aria-keyshortcuts="ArrowLeft ArrowRight"
          title={MODULE_ORDER_HELP}
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', module);
            onDragChange(module);
          }}
          onDragEnd={() => onDragChange(null)}
          onKeyDown={onKeyDown}
        >
          {position + 1}
        </span>
        <h2 id={headingId} className="card-title module-title">
          {MODULES[module]}
        </h2>
        <EngagedSwitch module={module} colour={colour} />
      </div>
      <EffectPicker id={effect} value={effectValue} onSelect={(e) => selectEffect(effect, e)} />
      <div className="module-knobs">
        <ControlKnob id={amount} />
      </div>
      {fxSetupParams(module).map((id) => (
        <ChoicePicker key={id} id={id} />
      ))}
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

/**
 * Whether a Module is Engaged; Bypassing it keeps its Effect. Shown as a switch named "Engaged", lit in the Effect
 * Colour while Engaged and unlit while Bypassed, like the pedal's Module button.
 */
function EngagedSwitch({ module, colour }: { module: ModuleId; colour: EffectColour | undefined }) {
  const engaged = useEditorStore((s) => isEngaged(shownState(s.editor), module));
  const setEngaged = useEditorStore((s) => s.setEngaged);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={engaged}
      aria-label="Engaged"
      className="engaged-switch"
      title={PARAMS[ENGAGED_PARAMS[module]].help}
      onClick={() => setEngaged(module, !engaged)}
    >
      <span className={colour ? `engaged-switch-light effect-${colour}` : 'engaged-switch-light'} aria-hidden="true" />
      {engaged ? 'Engaged' : 'Bypassed'}
    </button>
  );
}
