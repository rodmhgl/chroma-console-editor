import { useState } from 'react';
import { controlChange, programChange } from '../midi/encode';
import { SLOT_COUNT, slotAddress } from '../midi/map';
import { useEditorStore } from '../store/editorStore';

function byteInput(value: string, onChange: (v: string) => void, label: string) {
  return (
    <label>
      {label}
      <input type="number" min={0} max={127} required value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

/** Sends any CC or Program Change as typed, for hardware checks (docs/hardware-checks.md). Sends show in the MIDI Monitor. */
export function RawMidiPanel() {
  const sendRaw = useEditorStore((s) => s.sendRaw);
  const midiChannel = useEditorStore((s) => s.editor.global.midiChannel);
  const [cc, setCc] = useState('93');
  const [value, setValue] = useState('127');
  const [program, setProgram] = useState('0');

  return (
    <details className="raw-midi">
      <summary>Raw MIDI (hardware checks)</summary>
      <form
        aria-label="Send CC"
        onSubmit={(e) => {
          e.preventDefault();
          sendRaw(controlChange(midiChannel, Number(cc), Number(value)));
        }}
      >
        {byteInput(cc, setCc, 'CC')}
        {byteInput(value, setValue, 'Value')}
        <button type="submit">Send CC</button>
      </form>
      <form
        aria-label="Send Program Change"
        onSubmit={(e) => {
          e.preventDefault();
          sendRaw(programChange(midiChannel, Number(program)));
        }}
      >
        {byteInput(program, setProgram, 'Program')}
        <button type="submit">Send PC</button>
        <span className="raw-midi-hint">
          PC 0–{SLOT_COUNT - 1} recalls Slot {slotAddress(0)} … {slotAddress(SLOT_COUNT - 1)}
        </span>
      </form>
    </details>
  );
}
