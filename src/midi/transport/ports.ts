import { PEDAL_PORT_NAME } from '../map';
import type { MidiPort } from './types';
import { VIRTUAL_PEDAL_PORT } from './virtual';

const isPedalPort = (port: MidiPort) => PEDAL_PORT_NAME.test(port.name);

/**
 * The output to switch to as the output list changes from `before` to `now`: the pedal's USB port, when it has just
 * appeared (at launch or on plug-in) and nothing the user chose is in the way, i.e. the Virtual Pedal or an unplugged
 * output is selected. Null keeps the selection.
 */
export function pedalOutputToSelect({ before, now, selectedId }: { before: MidiPort[]; now: MidiPort[]; selectedId: string }): string | null {
  const appeared = now.find((p) => isPedalPort(p) && !before.some((b) => b.id === p.id));
  if (!appeared) return null;
  const selectedInUse = selectedId !== VIRTUAL_PEDAL_PORT.id && now.some((p) => p.id === selectedId);
  return selectedInUse ? null : appeared.id;
}
