# The editor is the source of truth; the pedal is write-only

The Chroma Console (firmware 1.04) transmits no CCs when its controls change, offers no SysEx preset dump or parameter read-back, and exposes no MIDI command to save to a Slot, set Module Order, choose Dual Bypass modules, or map expression. So the editor holds the authoritative Working State, sends every edit to the pedal immediately as a CC, and treats the pedal's actual state as unknowable — the Slot Map records what the user did during a Commit, never what the pedal verifiably holds. Settings MIDI cannot reach are still part of the Preset and are applied by the user via guided Pedal Steps.

## Considered Options

- **Pedal as source of truth (remote control only)** — rejected: nothing survives a session and nothing can be verified, which defeats preset creation.
- **Manual "Send" button instead of live sending** — rejected: presets are built by ear, and a send between every tweak slows that loop. Send All remains for resynchronising.

## Consequences

- A Module is modelled as Effect + Engaged/Bypassed. The editor never sends the OFF range (110–127) of CCs 16–19; it uses the module bypass CCs 103–106 instead, so a Bypassed Module keeps its Effect.
- Effect selection always sends the midpoint of the Effect's CC range, never a boundary value.
- Slots the editor did not Commit are absent from the Slot Map and shown as unknown; they cannot be imported.
- If a future firmware adds CC output or SysEx dumps, revisit this ADR — two-way sync would supersede it.
