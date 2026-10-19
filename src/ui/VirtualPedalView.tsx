import { useSyncExternalStore } from 'react';
import type { VirtualPedal } from '../midi/transport/virtual';

export function VirtualPedalView({ pedal }: { pedal: VirtualPedal }) {
  const { midiChannel, log } = useSyncExternalStore(pedal.subscribe, pedal.getSnapshot);

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
