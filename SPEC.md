# Chroma Console Editor — v1 spec

## Problem Statement

A Chroma Console owner who wants to build a new preset has to do it through four buttons, eight knobs and two footswitches. Half the parameters (Sensitivity, Drift, Effect Vol, Output Level) hide behind a Secondary Controls menu, the knobs only show one layer at a time, and settings like Module Order, Dual Bypass, filter style, Capture routing and expression mapping each live behind a different button combination with colour-coded light animations. There is no way to see a preset's full state at a glance, no undo, no way to compare "before" and "after", and no record outside the pedal of what is stored in which of the 80 Slots. The pedal accepts MIDI for most parameters, but it never reports its state back, cannot be told to save, and has no MIDI command at all for Module Order, Dual Bypass module selection or expression mapping — so a generic MIDI controller doesn't solve the problem either.

## Solution

A free, open-source browser editor (Chrome/Edge, Web MIDI, no install) that holds the authoritative copy of every Preset and makes the whole sound visible and editable at once. The user connects the pedal by USB-C or any DIN MIDI interface, and every edit is sent to the pedal immediately so they build the sound by ear. All Primary and Secondary Controls, Effects, Engaged/Bypassed states and preset-level settings sit on one faceplate-style screen — no menu modes. Settings MIDI can't reach are still part of the Preset; the editor walks the user through them with illustrated Pedal Steps. A guided Commit puts the finished Working State into a chosen Slot and records it in the Slot Map, so the user always knows what they believe is in D-14. Presets live in a Library of files the user owns, with undo/redo, Duplicate, notes, and Snapshot A/B comparison. Every other command in the MIDI implementation chart (Capture, Gesture, tap, bypass modes, calibration) is available in a secondary Performance Controls area.

## User Stories

### Connecting

1. As a pedal owner, I want the editor to run in my browser without installing anything, so that I can start building presets immediately.
2. As a pedal owner using USB-C, I want the editor to pick the "HOLOGRAM Chroma Console MIDI" port automatically, so that connecting takes no thought.
3. As a pedal owner using a DIN MIDI interface, I want to choose any MIDI output from a list, so that I can use the cable setup I already have.
4. As a pedal owner, I want the output list to refresh when I plug or unplug a device, so that I don't have to reload the page.
5. As a pedal owner, I want to set the MIDI channel the editor sends on (1–16, default 1), so that it matches my pedal's Global Settings.
6. As a pedal owner whose edits aren't being heard, I want a hint explaining how to check the pedal's MIDI channel on the pedal itself, so that I can fix the most likely cause without reading the manual.
7. As a pedal owner, I want a clear warning when my browser doesn't support Web MIDI, so that I know to switch to Chrome or Edge.
8. As a pedal owner without hardware to hand, I want to use the Virtual Pedal as an output, so that I can explore and prepare Presets anywhere.
9. As a pedal owner, I want to see a Sync Status (In Sync, Possibly Stale, Unknown), so that I know whether the pedal is actually sounding what the screen shows.
10. As a pedal owner, I want a Send All button, so that I can force the pedal to match the Working State whenever I'm unsure.

### Editing the sound

11. As a preset builder, I want to see all four Modules side by side in the current Module Order, so that the screen reflects the actual signal chain.
12. As a preset builder, I want each Module to show its Effect, its Amount, and its Secondary Controls together, so that I never enter a Secondary Controls menu.
13. As a preset builder, I want Tilt, Rate, Time and Mix on a shared strip with each one tinted by the Module it drives, so that I understand which Effect each knob affects.
14. As a preset builder, I want to choose a Module's Effect by name from its five options, so that I don't need to know CC value ranges.
15. As a preset builder, I want choosing an Effect to sound immediately on the pedal, so that I can audition Effects quickly.
16. As a preset builder, I want to engage or bypass each Module independently while keeping its chosen Effect, so that I can hear the chain with and without it.
17. As a preset builder, I want every knob edit to reach the pedal as I drag, so that I tune by ear rather than by number.
18. As a preset builder, I want fine adjustment with a modifier key, mouse wheel and arrow keys, so that I can make precise changes.
19. As a preset builder, I want to double-click a control to reset it to its neutral value, so that I can quickly return to a starting point.
20. As a preset builder, I want values labelled in the pedal's own terms (e.g. Pitch and Reverse shown as −1 oct … 0 … +1 oct, Secondary Controls and Tilt shown as "neutral" at centre), so that I understand what a setting will sound like.
21. As a preset builder, I want the raw MIDI value shown small beside each label, so that I can cross-reference the MIDI chart when I need to.
22. As a preset builder, I want each control's label to change meaning with the selected Effect (e.g. Rate is "pitch" under Pitch, "doubling time" under Doubler), so that I know what I'm adjusting.
23. As a preset builder, I want hover help describing what a control does for the current Effect, so that I can learn the pedal while I work.
24. As a preset builder, I want to set the Filter style (Lowpass, Tilt, Highpass), so that the Texture Filter behaves the way I want.
25. As a preset builder, I want to set Capture routing (pre-FX or post-FX), so that Capture sits where I want it in the chain.
26. As a preset builder, I want to set the preset's Tempo as a BPM number, so that time-based Effects and Gestures run at the speed I intend.
27. As a preset builder, I want to set Module Order by dragging Modules into sequence, so that reordering is as easy as it looks.
28. As a preset builder, I want to choose which Modules the BYPASS footswitch toggles under Dual Bypass, so that the Preset behaves correctly on stage later.
29. As a preset builder, I want to choose which Primary Control (or none) the expression pedal drives, so that the mapping is part of the Preset.
30. As a preset builder, I want settings MIDI can't reach to be clearly marked as needing a Pedal Step, so that I'm never surprised that changing them on screen didn't change the sound.
31. As a preset builder, I want to be shown the Pedal Step as soon as I change such a setting, so that I can apply it on the pedal while I'm hearing the result.
32. As a preset builder, I want each Pedal Step illustrated on a diagram of the four buttons and two footswitches, highlighting presses, holds and combinations in order, so that I don't get the button combinations wrong.
33. As a preset builder, I want to tick a Pedal Step as done, so that the editor knows the pedal now matches that setting.

### Tempo

34. As a preset builder, I want the editor to set the pedal's tempo by sending timed taps when I enter a BPM, so that I don't have to tap it by foot.
35. As a preset builder, if the pedal can't take an exact tempo over MIDI, I want a flashing on-screen metronome to tap along with as a Pedal Step, so that I can still land close to the intended BPM.

### Undo, Snapshot, starting points

36. As a preset builder, I want undo and redo for every Working State edit, with a whole drag counted as one step, so that experimenting is safe.
37. As a preset builder, I want undo and redo to re-send the restored values to the pedal, so that what I hear always matches the screen.
38. As a preset builder, I want to take a Snapshot of the Working State, so that I can keep a reference point while I keep tweaking.
39. As a preset builder, I want to flip between the Snapshot and my current edits with one click or key, each flip sent to the pedal, so that I can A/B by ear.
40. As a preset builder, I want to be told when an A/B flip changes a setting that needs a Pedal Step, so that I know the comparison isn't exact for that setting.
41. As a preset builder, I want to make the Snapshot the Working State or discard it, so that I can keep whichever version won.
42. As a preset builder, I want New to start from a neutral Preset (Mix 100%, Secondary Controls and Tilt neutral, Filter style Tilt, Capture post-FX, default Module Order, Dual Bypass covering all Modules, no expression mapping, first Effect in each Module, all Engaged), so that I start from the manual's recommended baseline.
43. As a preset builder, I want to Duplicate a Preset, so that I can build variations without losing the original.

### Library

44. As a preset builder, I want my Presets stored as files in a folder I choose, so that I own them and can back them up however I like.
45. As a preset builder on a browser without folder access, I want my Presets kept in browser storage with Import/Export, so that the editor still works.
46. As a preset builder relying on browser storage, I want a reminder to export a backup, so that I don't lose my Library when browser data is cleared.
47. As a preset builder, I want to name, rename, add notes to and tag Presets, so that I can find and remember them.
48. As a preset builder, I want a Preset's notes to say whether it expects a Gesture recording, so that I remember to record one.
49. As a preset builder, I want to open a Preset from the Library and have it sent to the pedal, so that I hear it immediately.
50. As a preset builder, I want to be warned before opening a Preset discards unsaved Working State edits, so that I don't lose work.
51. As a preset builder, I want to save the Working State back to its Preset or as a new Preset, so that my work survives.
52. As a preset builder, I want to delete a Preset with an armed confirmation, so that I can't delete by accident.
53. As a preset builder, I want to export several Presets as a Bundle file, so that I can share or back up a collection.
54. As a preset builder, I want to import Preset and Bundle files, so that I can use Presets others share with me.
55. As a preset builder, I want files made for other pedal editors (Clean, Lost+Found) refused with the pedal named, so that I understand why a file won't open.
56. As a preset builder, I want files from a newer editor version refused with a clear message, and files from older versions upgraded automatically, so that my files never get silently corrupted.

### Slots and Commit

57. As a preset builder, I want to see all 80 Slots as Banks A–D × 20, so that the layout matches the pedal.
58. As a preset builder, I want each Slot in the Slot Map to show which Preset I committed there and whether that Preset has changed since, so that I know what's on my pedal.
59. As a preset builder, I want Slots I never committed shown as unknown, so that the editor never pretends to know what the pedal holds.
60. As a preset builder, I want to Commit the Working State to a Slot through a guided sequence, so that saving to the pedal can't go wrong.
61. As a preset builder, I want Commit to start with a Send All, so that every MIDI-reachable setting is correct before I save.
62. As a preset builder, I want Commit to list only the Pedal Steps whose settings aren't already confirmed on the pedal, so that I don't redo work.
63. As a preset builder, I want Commit to ask whether to erase any Gesture recordings on the pedal before saving (erase by default), so that a stray experiment isn't saved into the Slot.
64. As a preset builder, I want Commit to show the pedal's own save steps — press B+C, scroll to the Slot, press B+C — on the diagram with the target Slot's bank light and LED bar position, so that I land on the right Slot.
65. As a preset builder, I want to be warned during Commit if the target Slot holds a Preset I committed earlier, so that I don't overwrite it by mistake.
66. As a preset builder, I want the Slot Map updated only when I confirm I completed the save on the pedal, so that the record reflects what I actually did.
67. As a preset builder, I want to recall a Slot on the pedal by Program Change, so that I can hear what's stored there.
68. As a preset builder recalling a Slot in the Slot Map, I want the Working State to become what I committed there, so that I can keep editing it.
69. As a preset builder recalling an unknown Slot, I want the Sync Status to show Unknown and controls to show the Working State no longer matches the pedal, so that I don't mistake the screen for the pedal.

### Performance Controls

70. As a pedal owner, I want Capture record, play and stop/clear buttons, so that I can test a Preset with a looped phrase without using my feet.
71. As a pedal owner, I want Gesture play, record and stop/erase buttons, so that I can manage Gesture recordings from the editor.
72. As a pedal owner, I want a tap button, so that I can nudge the pedal's tempo.
73. As a pedal owner, I want pedal-level Bypass/Engage and Dual Bypass Total Bypass/Dual Bypass/Total Engage controls, so that every bypass command in the MIDI chart is available.
74. As a pedal owner, I want Performance Controls kept visually separate from the editing panel, so that I never mistake them for Preset settings.

### Global Settings

75. As a pedal owner, I want to set the Calibration Level (Low, Medium, High, Very High) from the editor, so that I can match my instrument without the footswitch menu.
76. As a pedal owner, I want to enter and exit the pedal's Calibration menu from the editor, so that I can run automatic calibration when I change instruments.
77. As a pedal owner, I want it made clear that Calibration Level applies to every Preset, so that I don't expect it to be stored in one.

### Diagnostics and help

78. As a pedal owner, I want a Raw MIDI panel to send any CC or Program Change by number, so that I can test behaviour the editor doesn't cover.
79. As a pedal owner, I want a MIDI Monitor listing every message sent, with a readable description (e.g. "CC 16 = 76 → Character → Howl"), so that I can see what the editor is doing.
80. As a contributor, I want the hardware checks written down with the exact messages to send and what to observe, so that anyone with a pedal can confirm the editor's assumptions.
81. As a pedal owner, I want a Help tab with a "Getting connected" guide and an explanation of Commit and Pedal Steps, so that I understand the workflow before I start.
82. As a pedal owner, I want keyboard shortcuts for undo, redo, A/B flip, Send All and Snapshot, so that I keep my hands free for my instrument.
83. As a pedal owner, I want to choose a colour theme and UI scale, so that the editor is comfortable in my room and on my screen.
84. As a pedal owner, I want to install the editor as an app and have it work offline, so that it's available in a studio without internet.
85. As a pedal owner, I want to be told when a new version is available rather than having it reload mid-session, so that I never lose work to an update.
86. As a pedal owner, I want the editor's session (Working State, Snapshot, Slot Map, settings) restored when I reopen it, so that I can pick up where I left off.
87. As a pedal owner, I want a clear notice that the editor is unofficial and not affiliated with Hologram Electronics, so that I know where to seek support.

## Implementation Decisions

- **Fork of the Clean editor** (ADR 0002): the codebase starts as a hand copy of the Clean editor with its pedal map, model and panels replaced. Generic parts (transport, Knob and value-drag input, Library, Slot Map, Sync Status, undo history, schema envelope, PWA shell, themes, help rendering, Raw MIDI, MIDI Monitor) are reused. Pass-through, the bulk CSV import script and design-sync are deliberately not carried over.
- **Stack**: TypeScript, Vite, React, zustand; no component library; one hand-written stylesheet with CSS custom-property themes; self-hosted fonts. Static build with relative base path, deployed to GitHub Pages by CI; PWA with prompt-to-update.
- **Editor is the source of truth; the pedal is write-only** (ADR 0001). The pedal sends no CCs and supports no preset SysEx, so the editor never reads pedal state. Web MIDI is requested without SysEx; the pedal is recognised by port name only.
- **Pedal map module** (the single source of MIDI truth): a typed data table of every parameter with id, label, CC (or none), kind, value list with CC ranges, group, scope (Preset, Global Setting, Performance Control), default, neutral/detent, help text, and transport — `cc` or `pedal-step`. Pedal Step settings (Module Order, Dual Bypass module set, expression target, and Tempo if the tap check fails) live in the same table with no CC, so undo, Snapshot and Sync Status cover them automatically.
- **Working State** is a flat record of raw values keyed by frozen parameter ids, following Clean. Module Order is stored as a permutation index (0–23); the Dual Bypass module set as a 4-bit mask; the expression target as an enum of the 8 Primary Controls plus none; Tempo as BPM.
- **Effect selection** sends the midpoint of the Effect's CC range on CC 16–19 (0–21 → 10, 22–43 → 32, 44–65 → 54, 66–87 → 76, 88–109 → 98) and never the OFF range 110–127. Engaged/Bypassed uses CC 103–106 (0 = Bypassed, 127 = Engaged).
- **Primary Controls**: Tilt 64, Rate 66, Time 68, Mix 70, Amount Character 65 / Movement 67 / Diffusion 69 / Texture 71. **Secondary Controls**: Sensitivity 72, Drift Movement 74 / Diffusion 76, Output Level 78, Effect Vol Character 73 / Movement 75 / Diffusion 77 / Texture 79. All 0–127, sent as-is.
- **Other preset settings over MIDI**: Capture routing CC 83 (post-FX 0, pre-FX 127); Filter style CC 84 (LPF 21, Tilt 65, HPF 107 — range midpoints).
- **Performance Controls**: Standard bypass CC 91 (Bypass 0 / Engage 127); Dual Bypass CC 92 (Total Bypass 15 / Dual Bypass 47 / Total Engage 127); Gesture play/record CC 80 (Play 0 / Record 127); Gesture stop/erase CC 81; Capture CC 82 (Stop/Clear 21 / Play 65 / Record 107); Tap CC 93; Calibration menu CC 95 (Exit 0 / Enter 127). None are stored in a Preset, part of undo, or included in Send All.
- **Global Settings**: MIDI channel (editor-side, must match the pedal); Calibration Level CC 94 (Low 15 / Medium 47 / High 79 / Very High 111). Other pedal globals (MIDI routing, clock source, LED brightness, audition, bypass mode) are out of reach and not modelled.
- **Slots**: Program Change 0–79 maps to Bank A slot 1 … Bank D slot 20 (bank = ⌊pc / 20⌋, number = pc mod 20 + 1).
- **Editor core**: a pure `dispatch(editorState, action) → { editorState, messages }` with no UI dependencies, owning the Working State, Global Settings, Sync Status, Slot Map, undo history and Snapshot. Actions include: set parameter, select Effect, set Engaged, set Pedal Step setting, confirm Pedal Step, undo, redo, take Snapshot, flip A/B, adopt/discard Snapshot, open Preset, Send All, recall Slot, begin/confirm/cancel Commit, Performance Control, set Global Setting, restore session.
- **Send All order**: Effect selection (CC 16–19) → Filter style and Capture routing → Primary Controls → Secondary Controls → Engaged/Bypassed (CC 103–106) → Tempo taps (if applicable). Sent with a configurable inter-message gap; continuous edits throttled per parameter with the latest value always sent last, as in Clean.
- **Sync Status rules**: Unknown when no output is selected (including when the selected output is unplugged) or after recalling a Slot absent from the Slot Map; Possibly Stale on connect, on session restore, after a Pedal Step setting changes and isn't yet confirmed, after the MIDI channel changes, after a Raw MIDI message, or after any failed send (which also abandons a Send All); In Sync after Send All with every Pedal Step setting confirmed, and maintained by live sends.
- **Commit** is a modal sequence driven by core actions: Send All → outstanding Pedal Steps (each confirmed) → Gesture choice (erase via CC 81 by default) → the pedal's save steps for the target Slot → user confirms → Slot Map entry written (committed snapshot + source Preset id). Cancelling at any point leaves the Slot Map untouched.
- **Pedal Step diagrams** are generated from a small step description (sequence of press / hold / combination on buttons A–D and the two footswitches, plus knob moves for FX Setup items) rather than hand-drawn per step. Module Order is applied by entering FX Setup (A+D) and tapping the Module buttons in order; Dual Bypass by holding BYPASS in FX Setup and toggling buttons; expression mapping by moving the expression pedal in FX Setup then the target knob.
- **Tempo**: the BPM field sends timed CC 93 taps if hardware check confirms the pedal derives an exact tempo from them; otherwise Tempo becomes a Pedal Step with an on-screen metronome.
- **Library and files**: File System Access API folder with IndexedDB fallback and Import/Export; Clean's file envelope (format, schemaVersion, appVersion, id, name, notes, tags, created/modified) with a flat params map; extensions `.ccpreset.json` and `.ccbundle.json`; newer schemaVersion refused, older migrated stepwise, values clamped on load; other pedals' formats refused by name.
- **Hardware checks** document lists each unverified assumption with exact messages and expected observations; the Library/Commit milestone is gated on it.
- **Branding**: no Hologram names in the product name or logo beyond nominative use ("for the Chroma Console"), no Hologram artwork, and an unaffiliated notice.

## Testing Decisions

- **Good tests assert external behaviour only**: for the core, "given this Editor State and these actions, these exact MIDI bytes are produced and the Editor State reads like this" — never internal helper calls or intermediate structures. For the UI, what a user can see and do, located by role and accessible name.
- **Seam 1 — the editor core's `dispatch`**: the primary seam. Covers every parameter's exact bytes (every row of the pedal map checked byte-for-byte through dispatch, on a non-default MIDI channel), Effect midpoints and the never-send-OFF rule, Engaged/Bypassed, Send All order, Pedal Step settings producing no bytes and moving Sync Status, Pedal Step confirmation, undo/redo re-sending values, Snapshot A/B flips, Commit sequencing and Slot Map writes, Slot recall for known and unknown Slots, Performance Controls not touching the Working State or history, and Sync Status transitions. Prior art: Clean's core tests, which run action sequences through a small helper and assert the concatenated messages.
- **Seam 2 — the Virtual Pedal transport under Playwright**: end-to-end specs against the production build (and a second server under the Pages sub-path), Chromium only. Cover connection and port selection, main panel editing, Effect selection, Pedal Step prompts and diagrams, Commit wizard, Library and Bundle exchange, Slot Map, Snapshot A/B, undo/redo, Send All, Raw MIDI, MIDI Monitor, help, keyboard shortcuts, PWA update prompt, session restore, and the unaffiliated notice. Prior art: Clean's e2e suite and its simulated-MIDI-input helper.
- **Plain module tests** (as in Clean) for the file schema and migrations, persistence, Library, and the send throttle.
- **Real hardware** is covered by the hardware checks document, not automated tests.

## Out of Scope

- Live performance features: MIDI Pass-through from a DAW, setlists, footswitch-driven workflows.
- Reading anything back from the pedal (it transmits no CCs and has no preset SysEx), including importing existing Slots.
- Storing or editing Gesture recordings, and storing Capture recordings.
- Pedal Global Settings other than MIDI channel and Calibration Level (MIDI routing, clock source, LED brightness, audition, bypass mode), and factory/global reset.
- MIDI clock output or clock sync from the editor.
- Firmware updates (Hologram's own updater handles them).
- Randomise and morphing between Presets (post-v1 candidates).
- Extracting a shared core with the Clean and Lost+Found editors (deferred per ADR 0002).
- Browsers without Web MIDI (Safari, Firefox without the add-on) beyond a clear unsupported notice.
- A Transcribe flow for entering unknown Slots by ear.

## Further Notes

- Vocabulary follows CONTEXT.md exactly; decisions follow ADR 0001 (editor is source of truth) and ADR 0002 (fork Clean).
- **Hardware checks to write up** (gate before the Library/Commit milestone):
  1. How many CC 93 taps set a tempo, whether they're averaged, and whether timed taps give an exact BPM.
  2. Whether the OFF range of CC 16–19 differs from module bypass CC 103–106 (trails, remembered Effect).
  3. Whether rapid CC bursts are dropped, and the minimum safe gap for Send All.
  4. Program Change reliability and the audio gap on recall.
  5. Which Primary Controls the expression pedal can target (four Amounts or one).
  6. Whether a Module's Engaged/Bypassed state is stored in a Slot.
  7. Whether selecting an Effect on a Bypassed Module engages it.
  8. Whether Gesture playback overrides Primary Control CCs sent during Send All.
  9. How CC 92 Dual Bypass mode interacts with the module bypass CCs.
- **Milestones**: M1 pedal map + Virtual Pedal + byte-level core tests; M2 main panel with live sending; M3 hardware checks resolved; M4 Library, Slot Map and Commit with Pedal Steps; M5 Snapshot A/B and undo; M6 polish, help and PWA.
- Firmware 1.04 (May 2025) is current; a firmware adding CC output or preset SysEx would supersede ADR 0001.
