# Fork the Clean editor rather than extract a shared core

The Chroma Console editor starts as a hand copy of the Clean editor (itself a fork of the Lost+Found editor) with its pedal map, model and panels replaced. Clean's ADR 0001 anticipated extracting a shared core "when a third pedal editor appears"; this is that third editor, and we deliberately defer the extraction anyway. Chroma diverges more than Clean did from Lost+Found — no save-to-Slot CC, Commit with Pedal Steps, preset settings with no CC, a Snapshot for A/B — so it is a poor third example to design the shared abstraction from while it is still being built, and the extraction would stall this editor behind a refactor of two shipped ones.

## Consequences

- Fixes to the generic parts (transport, Library, Slot Map, Sync Status, undo, PWA shell, Knob) must be ported by hand across three repos until the core is extracted.
- `src/model` and `src/midi` stay free of UI dependencies and all pedal knowledge stays behind `src/midi/map.ts`, preserving the seam a later extraction would cut.
- Deliberately not carried over from Clean: Pass-through (live-performance oriented; this editor is for building presets), the bulk CSV import script, and the design-sync export. Don't re-add them without revisiting this ADR.
- Settings with no CC (Module Order, Dual Bypass module set, expression target, possibly Tempo) live in the same `map.ts` table marked as Pedal Step settings, extending Clean's raw-value model rather than adding a second state shape.
