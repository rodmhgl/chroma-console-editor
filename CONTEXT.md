# Chroma Console Editor

A free browser editor for building presets for the Hologram Chroma Console. The pedal only receives MIDI and cannot report its state or be told to save, so the editor holds its own belief about what the pedal is doing.

## Pedal structure

**MIDI channel**:
The MIDI channel (1–16) the pedal listens on; default 1.
_Avoid_: channel (unqualified)

**Module**:
One of the four fixed processing stages — Character, Movement, Diffusion, Texture — each hosting one Effect at a time.
_Avoid_: Block, stage, slot

**Effect**:
One of the five selectable algorithms inside a Module (e.g. Howl in Character, Reels in Diffusion).
_Avoid_: Algorithm, mode, type

**Effect Colour**:
The colour — red, yellow, green, blue or purple — the pedal lights a Module button to show its selected Effect; fixed by the Effect's place in its Module (e.g. Drive, Doubler, Cascade and Filter are all red).
_Avoid_: Effect LED

**Module Colour**:
The fixed colour of a Module's knobs: Character red, Movement yellow, Diffusion green, Texture blue. Distinct from Effect Colour, which changes with the selected Effect.

**Engaged / Bypassed**:
Whether a Module is processing; a Bypassed Module keeps its selected Effect.
_Avoid_: Off, on, enabled, active

**Module Order**:
The sequence in which the four Modules process the signal; default Character → Movement → Diffusion → Texture.
_Avoid_: Routing (ambiguous with MIDI Routing and Capture Routing)

**Primary Control**:
A parameter reached directly by a knob: Tilt, Rate, Time, Mix, and each Module's Amount.

**Secondary Control**:
A parameter reached via the pedal's Secondary Controls menu: Sensitivity, Drift (Movement, Diffusion), Effect Vol (each Module), Output Level.

**Tempo**:
The tapped tempo stored in a Preset, expressed in the editor as BPM.

**Calibration Level**:
The pedal-wide input headroom — Low, Medium, High or Very High — applied to every Preset.

## Presets and pedal memory

**Preset**:
A named description of one sound kept in the editor's Library: every setting the pedal stores in a Slot except Gesture recordings. Keeps its identity when renamed; Duplicate creates a new Preset.
_Avoid_: Patch, program; never use for a pedal memory location

**Library**:
The user's collection of Presets, stored as Preset files in a folder the user chooses, or in the browser's storage.

**Bundle**:
A single file carrying full copies of several Presets, for sharing or backup. Holds no Slot numbers.
_Avoid_: Bank, set list

**Slot**:
One of the pedal's 80 memory locations, addressed as Bank + number (e.g. **D-14**).
_Avoid_: Preset (for pedal memory)

**Bank**:
One of four groups (A–D) of 20 Slots.

**Slot Map**:
The editor's belief about what each Slot contains: a snapshot of the committed state plus a link to its source Preset. Never confirmed by the pedal; a Slot absent from it is unknown.

**Commit**:
The guided sequence that puts the Working State into a Slot: Send All, then Pedal Steps, then the pedal's own save steps, after which the Slot Map is updated on the user's word.
_Avoid_: Save (that is the pedal's own B+C action), store, upload

**Working State**:
The single pedal state the editor is currently editing and sending; may be modified relative to the Preset it was opened from.
_Avoid_: Current preset, patch

**Snapshot**:
A frozen copy of the Working State used for A/B comparison against ongoing edits.

**Editor State**:
Everything the editor believes about and controls on the pedal: the Working State, Global Settings, Sync Status and Slot Map (plus undo history and the Snapshot).
_Avoid_: App state, store

**Global Settings**:
Pedal settings that are not part of a Preset. Only the MIDI channel and Calibration Level are reachable by the editor.

**Settings**:
The editor's own preferences. Never sent to the pedal; kept between sessions.
_Avoid_: Preferences, options; don't confuse with **Global Settings**, which the pedal holds

**Performance Controls**:
Momentary MIDI actions never stored in a Preset: Capture, Gesture play/record/erase, tap, Dual Bypass toggling and the Calibration menu.

## Sync

**Sync Status**:
How far the editor trusts that the pedal is sounding the Working State: In Sync, Possibly Stale or Unknown. Settings reached only by Pedal Steps are trusted on the user's word.

**Send All**:
Transmitting every MIDI-reachable setting of the Working State to the pedal.

**Pedal Step**:
An instruction the user performs by hand on the pedal for something MIDI cannot reach: Module Order, Dual Bypass module selection, expression mapping, saving to a Slot.
_Avoid_: Manual step, instruction

**Virtual Pedal**:
A simulated pedal inside the editor that decodes sent MIDI into pedal state, used in place of real hardware.
_Avoid_: Mock pedal, emulator
