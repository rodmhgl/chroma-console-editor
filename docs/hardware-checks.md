# Hardware checks

Pedal behaviour the manual (firmware 1.04) leaves unclear, to confirm on a real Chroma Console. The Library/Commit milestone waits on these (SPEC.md, Further Notes). Results are recorded here; #9 tracks running them.

## How to run them

- Connect the pedal by USB-C, open the editor in Chrome or Edge, and check the output is "HOLOGRAM Chroma Console MIDI". Leave the pedal and the editor on MIDI channel 1.
- Send single messages from **Data → MIDI Monitor → Raw MIDI (hardware checks)**. The MIDI Monitor lists the newest messages sent, so you can confirm what went out. (It folds a fast run of one CC, such as a knob drag, into a single row.)
- Messages are written `CC 93 = 127` (decimal), and `PC 79` for a Program Change. On MIDI channel 1 those are the bytes `B0 5D 7F` and `C0 4F`.
- Raw MIDI sends one message per click, so it can't time messages. Where a check needs timed or back-to-back messages, use a DAW clip or a tool such as [`sendmidi`](https://github.com/gbevin/SendMIDI), e.g. `sendmidi dev "Chroma Console" ch 1 cc 93 127`.
- Play a sustained note or chord through the pedal while you listen, and record the firmware version with your results.

A neutral starting point, used below as **Reset**: `CC 16 = 10`, `CC 17 = 10`, `CC 18 = 10`, `CC 19 = 10` (first Effect in each Module), `CC 103 = 127`, `CC 104 = 127`, `CC 105 = 127`, `CC 106 = 127` (all Engaged), `CC 91 = 127` (pedal Engaged).

## 1. Tap tempo over MIDI (CC 93)

How many CC 93 taps set a tempo? Are they averaged? Do timed taps give an exact BPM?

- **Setup:** Reset, then `CC 17 = 76` (Movement → Tremolo), `CC 67 = 127` (deep), `CC 66 = 64`. Tremolo follows tap tempo, so its pulse shows the tempo.
- **Steps:**
  1. Send 2 taps (`CC 93 = 127`) exactly 500 ms apart. Does the tremolo change speed? If not, try 3 taps, then 4.
  2. Send 4 taps at 500, 500 and 600 ms intervals. Does the result sound like 120 BPM (averaged), 100 BPM (last interval only), or something else?
  3. Send 4 taps exactly 500 ms apart, then play a 120 BPM click alongside for 30 s. Does the tremolo drift from the click?
  4. Repeat step 3 with `CC 93 = 0`. Does the value matter?
- **Editor assumes:** timed taps set an exact tempo, so Tempo is sent as taps. If not, Tempo becomes a Pedal Step with an on-screen metronome.
- **Result:** _not yet run_

## 2. Effect OFF (CC 16–19 = 110–127) versus module bypass (CC 103–106)

Does the OFF range of an Effect selection behave differently from bypassing the Module: trails, and whether the Effect is remembered?

- **Setup:** Reset, then `CC 18 = 32` (Diffusion → Reels), `CC 69 = 100` (long repeats).
- **Steps:**
  1. Play a note and, while the repeats ring, send `CC 18 = 120` (OFF). Do the repeats stop dead or trail off? What do the Diffusion button lights show?
  2. Send `CC 105 = 127` (Engage). Does Reels come back, or does Diffusion stay silent?
  3. Send `CC 18 = 32`, play a note, and while the repeats ring send `CC 105 = 0` (Bypass). Trails or a dead stop? Then `CC 105 = 127`: is Reels still selected?
  4. Repeat steps 1 and 3 with each Bypass Mode set in the pedal's Global Settings (buffered, buffered with trails, true bypass), if trails differ.
- **Editor assumes:** Engaged/Bypassed is CC 103–106 and a Bypassed Module keeps its Effect. The editor never sends OFF.
- **Result:** _not yet run_

## 3. Rapid CC bursts and the minimum safe gap

Does the pedal drop messages sent back to back? What gap between messages does Send All need?

- **Setup:** Reset. The four Module buttons show each Module's Effect by colour, which makes a dropped Effect selection visible.
- **Steps:**
  1. With a DAW or `sendmidi`, send a burst of 26 messages with no gap: the same messages as a Send All, but with the Effect selections last so a dropped one shows. That is `CC 64` to `CC 79` each `= 64` (16 messages), `CC 83 = 0`, `CC 84 = 65`, `CC 103` to `CC 106` each `= 127`, then `CC 16 = 98`, `CC 17 = 98`, `CC 18 = 98`, `CC 19 = 98`. Did all four buttons change to the fifth Effect's colour (Swell, Pitch, Reverse, Interference)?
  2. Reset and repeat 5 times at each gap: 0, 1, 2, 5 and 10 ms. Note the smallest gap at which all four always land.
  3. Repeat step 2 over a DIN MIDI interface, if you have one.
  4. Drag-rate check: Reset, send `CC 16 = 54` (Character → Fuzz), then `CC 65` from 0 up to 127 and back down to 10, one message per ms. Does the fuzz settle at the final, low Amount?
- **Editor assumes:** a configurable inter-message gap for Send All; continuous edits throttled per parameter with the latest value always sent last.
- **Result:** _not yet run_

## 4. Program Change reliability and the audio gap on recall

Does every Program Change recall its Slot? How long is the audio gap?

- **Setup:** Save two clearly different sounds into Slots A-1 and A-2 by hand on the pedal (B+C, scroll, B+C), e.g. A-1 with every Module on its first Effect and A-2 with every Module on its fifth.
- **Steps:**
  1. Alternate `PC 0` (A-1) and `PC 1` (A-2) 20 times, about once a second. Does every recall land (button colours)?
  2. Repeat with no wait between messages (DAW or `sendmidi`). Do any recalls get lost?
  3. Hold a chord and recall the other Slot. Is there a dropout or click? Roughly how long (none, under 50 ms, longer)?
  4. Send `PC 80` and `PC 127`, beyond the 80 Slots. Does anything happen?
- **Editor assumes:** PC 0–79 recalls Bank A slot 1 … Bank D slot 20 every time.
- **Result:** _not yet run_

## 5. Which Primary Controls the expression pedal can target

The manual says the expression pedal can drive "any single primary control (TILT, RATE, TIME, MIX, or AMOUNT)". Is each Module's Amount a separate target, or do the four Amounts move together?

- **Setup:** An expression pedal in the EXP jack. Reset, then `CC 65 = 0`, `CC 67 = 0`, `CC 69 = 0`, `CC 71 = 0` (every Amount down).
- **Steps:**
  1. Enter FX Setup (press A and D together), move the expression pedal, then turn the Movement Amount knob. Wait 3 seconds, then exit FX Setup (A and D).
  2. Sweep the expression pedal. Which Amounts change: only Movement's, or all four? (Listen, and watch the LED bars.)
  3. Repeat step 1 with Tilt. Does Tilt alone follow?
  4. With the expression pedal mapped to Movement Amount, send `CC 67 = 127`. Does the CC move the Amount, and what happens on the next expression sweep?
- **Editor assumes:** the expression target is one of 8 Primary Controls (Tilt, Rate, Time, Mix and the four Amounts) or none.
- **Result:** _not yet run_

## 6. Is a Module's Engaged/Bypassed state saved in a Slot?

- **Setup:** Reset, then `CC 104 = 0` (Movement Bypassed). Save to a scratch Slot, e.g. D-20, by hand (B+C, scroll, B+C).
- **Steps:**
  1. Send `CC 104 = 127` (Movement Engaged).
  2. Send `PC 79` (D-20). Is Movement Bypassed again after the recall?
- **Editor assumes:** yes; Engaged/Bypassed is part of a Preset and of Send All.
- **Result:** _not yet run_

## 7. Does selecting an Effect on a Bypassed Module engage it?

- **Setup:** Reset, then `CC 104 = 0` (Movement Bypassed).
- **Steps:**
  1. Send `CC 17 = 54` (Movement → Phaser). Is Movement now Engaged (lit and heard), or still Bypassed with Phaser selected?
  2. Send `CC 17 = 120` (OFF), then `CC 17 = 54`. Is Movement Engaged now?
- **Editor assumes:** unknown. Send All sends Effect selections before Engaged/Bypassed, so it re-asserts each Module's state either way. A live Effect change on a Bypassed Module re-sends Bypassed (e.g. `CC 17 = 54` then `CC 104 = 0`); if the pedal turns out not to engage the Module, that second message can go.
- **Result:** _not yet run_

## 8. Does Gesture playback override Primary Control CCs sent during Send All?

- **Setup:** Reset, then `CC 17 = 22` (Movement → Vibrato), `CC 67 = 100`. Record a Gesture on the Rate knob: press C and D together, sweep Rate slowly a few times, press C and D again. Check it plays back.
- **Steps:**
  1. While it plays back, send `CC 66 = 0`. Does Rate jump to 0 and stay there, jump and then carry on following the Gesture, or ignore the CC?
  2. Does the CC erase the Rate recording, as moving the Rate knob does? Check whether the Movement button still flashes white.
  3. Send `CC 81 = 0` (Gesture → Stop/Erase), then `CC 80 = 0` (Gesture → Play). Is the recording gone?
- **Editor assumes:** Send All's Primary Control values take effect; Commit offers to erase Gestures (CC 81) before saving.
- **Result:** _not yet run_

## 9. How CC 92 Dual Bypass interacts with the module bypass CCs

- **Setup:** Reset. In FX Setup (A and D), hold BYPASS and set only Movement and Diffusion blinking (toggled by the footswitch), then exit FX Setup.
- **Steps:**
  1. Send `CC 92 = 47` (Dual Bypass). Which Modules are Bypassed? Expected: Movement and Diffusion only.
  2. Send `CC 104 = 127` (Movement Engage). Does Movement come back while Dual Bypass is on?
  3. Send `CC 92 = 15` (Total Bypass), then `CC 105 = 127` (Diffusion Engage). Does Diffusion sound while the pedal is totally bypassed?
  4. Send `CC 92 = 127` (Total Engage). Which Modules are Engaged: all four, or whatever CC 103–106 last set?
  5. Send `CC 91 = 0` then `CC 91 = 127` (pedal Bypass/Engage). Does CC 91 respect the Dual Bypass module set, or bypass the whole pedal?
- **Editor assumes:** CC 92 and CC 91 are Performance Controls, never stored in a Preset; CC 103–106 set each Module's Engaged/Bypassed state.
- **Result:** _not yet run_

## 10. Where Reset Secondary leaves Drift and the other Secondary Controls

The manual shows Sensitivity, Output Level and Effect Vol as neutral at centre, but Drift only as 0–100%. What does the pedal's own Reset Secondary set each one to?

- **Setup:** Reset, then `CC 17 = 32` (Movement → Vibrato), `CC 67 = 100` (deep), and on the pedal turn every Secondary Control well away from where it started (press A+B to reach them).
- **Steps:**
  1. On the pedal, hold A+B until the lights pulse teal (Reset Secondary). Leave the menu with A+B.
  2. Now send `CC 74 = 0` (Movement → Drift). Does the vibrato change? Then `CC 74 = 64`: does that sound like where Reset left it?
  3. Do the same for Diffusion's Drift with `CC 18 = 32` (Reels) and `CC 76 = 0`, then `CC 76 = 64`.
  4. Send `CC 72 = 64`, `CC 78 = 64` and `CC 73 = 64`. Does any of them change the sound after Reset?
- **Editor assumes:** a new Preset starts with Drift at 0 (none) and Sensitivity, Output Level and every Effect Vol at 64 (neutral).
- **Result:** _not yet run_

## 11. The Module Order Pedal Step

The manual says to enter FX Setup (A and D) and "tap the buttons in your desired routing sequence", after which the pedal leaves FX Setup. Which button is which Module, and how many taps does it take?

- **Setup:** Reset, then `CC 16 = 54` (Character → Fuzz, loud and obvious) and `CC 18 = 32` (Diffusion → Reels), `CC 69 = 100` (long repeats). Fuzz into Reels and Reels into Fuzz sound very different.
- **Steps:**
  1. Press A and D together. Watch the button animation: does it light A, B, C, D in turn for the default order?
  2. Tap D, C, B, A. Does the pedal leave FX Setup after the fourth tap, or after the third? Do the repeats now sound fuzzed (Reels before Fuzz)?
  3. Enter FX Setup again. Does the animation now run D, C, B, A?
  4. Enter FX Setup, tap A, then press BYPASS. Is the order left as it was (D, C, B, A)?
  5. Save to a scratch Slot (B+C, scroll, B+C), recall another Slot then the scratch one with `PC`. Is the order saved with the Slot?
- **Editor assumes:** buttons A, B, C and D are Character, Movement, Diffusion and Texture; the Pedal Step taps all four in the new order and the pedal then leaves FX Setup; Module Order is saved in a Slot.
- **Result:** _not yet run_

## 12. Clearing the expression mapping

The manual says how to map the expression pedal to a knob in FX Setup, but not how to unmap it. The editor's Pedal Step for "no expression target" opens the expression mapping menu and lets it time out without moving a knob.

- **Setup:** An expression pedal in the EXP jack. Reset, then `CC 67 = 0` (Movement Amount down) and `CC 17 = 32` (Movement → Vibrato), so the expression pedal is easy to hear on Movement Amount.
- **Steps:**
  1. Map the expression pedal to Movement Amount: press A and D, move the expression pedal, turn the Movement Amount knob, wait 3 seconds, press A and D. Sweep the expression pedal: does the vibrato deepen?
  2. Press A and D, move the expression pedal, then wait 3 seconds without touching a knob, and press A and D. Sweep the expression pedal: does it still drive Movement Amount?
  3. If it does, try resetting FX Setup (hold A and D until the blue pulse). Does that clear the mapping, and what else does it reset (Module Order, Dual Bypass, Filter style, Capture Routing)?
- **Editor assumes:** step 2 leaves the expression pedal mapped to nothing; the mapping is saved in a Slot (manual §12).
- **Result:** _not yet run_

## 13. The Dual Bypass Pedal Step

The manual says that in FX Setup, holding BYPASS lights the buttons yellow, blinking for a Module BYPASS bypasses and solid for one it leaves alone, and each tap toggles one. Can the set be empty, and does leaving FX Setup keep it?

- **Setup:** Reset, then `CC 17 = 76` (Movement → Tremolo, easy to hear) and `CC 67 = 127`.
- **Steps:**
  1. Press A and D, then hold BYPASS. Are all four buttons blinking (the default)?
  2. Still holding BYPASS, tap A, C and D so only B blinks. Release BYPASS, then press A and D. Press BYPASS once: does only the tremolo stop, the other Modules still sounding?
  3. Repeat with all four solid. What does a single BYPASS press do: nothing, or bypass the whole pedal?
  4. Save to a scratch Slot (B+C, scroll, B+C), recall another Slot then the scratch one with `PC`. Is the Dual Bypass set saved with the Slot?
- **Editor assumes:** blinking is in the set and solid is not; buttons A to D are Character to Texture (hardware check 11); any set from none to all four can be saved; releasing BYPASS and pressing A and D leaves FX Setup with the set kept.
- **Result:** _not yet run_
