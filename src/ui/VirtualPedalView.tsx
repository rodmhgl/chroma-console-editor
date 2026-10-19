import { useSyncExternalStore } from 'react';
import { MODULES, PARAMS, settingLabel, type ParamDef, type PresetParamId } from '../midi/map';
import type { VirtualPedal } from '../midi/transport/virtual';

export function VirtualPedalView({ pedal }: { pedal: VirtualPedal }) {
  const { state, midiChannel, log } = useSyncExternalStore(pedal.subscribe, pedal.getSnapshot);

  return (
    <section className="card virtual-pedal" aria-labelledby="virtual-pedal-heading">
      <h2 id="virtual-pedal-heading" className="card-title">
        Virtual Pedal
      </h2>
      <dl className="pedal-state">
        <dt>MIDI channel</dt>
        <dd>
          <output aria-label="MIDI channel">{midiChannel}</output>
        </dd>
        {/* MIDI can't reach a Pedal Step setting, so the Virtual Pedal never learns it. */}
        {(Object.values(PARAMS) as ParamDef[]).filter((p) => p.transport === 'cc').map((param) => {
          const name = param.module ? `${MODULES[param.module]} ${param.label}` : param.label;
          const value = state[param.id as PresetParamId];
          return [
            <dt key={`${param.id}-name`}>{name}</dt>,
            <dd key={param.id}>
              <output aria-label={name}>{settingLabel(param, value) ?? value}</output>
            </dd>,
          ];
        })}
      </dl>
      <h3 className="card-title">Message log</h3>
      <ol className="message-log" role="log" aria-label="Message log">
        {log.map((entry) => (
          <li key={entry.id}>{entry.text}</li>
        ))}
      </ol>
    </section>
  );
}
