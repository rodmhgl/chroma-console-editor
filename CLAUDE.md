# Chroma Console Editor

## Purpose

A full-featured software editor for the Hologram Chroma Console multi-effects pedal, free and open source, covering every command in the MIDI implementation chart (manual §16). Its goal is to make building new presets easy; live performance is out of scope. It is a fork of the Clean editor (ADR 0002), and the pedal is write-only, so the editor is the source of truth (ADR 0001).

## References

- CC_manual_WEB.pdf - The Chroma Console manual (firmware 1.04), including the MIDI implementation chart on pp. 46–49
- SPEC.md - The v1 spec (also filed as a GitHub issue)
- CONTEXT.md - Domain glossary; use these terms exactly in code, UI and docs
- docs/adr/ - Architecture decision records
- docs/hardware-checks.md - Unverified pedal behaviour to confirm on real hardware (not yet written; must be resolved before the Library/Commit milestone)
- /home/rodst/Repos/clean - The Clean editor this repo is forked from (commit 5f5a381); port generic fixes between the editors by hand
- /home/rodst/Repos/lost+found - The Lost+Found editor Clean was forked from
- /home/rodst/Repos/papercuts.md - Global log of things that slowed down development

## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues on rodmhgl/chroma-console-editor (via `gh`). See `docs/agents/issue-tracker.md`.

When finishing work on an issue, comment on it before closing it: decisions made, decisions still pending, problems hit and how they were resolved, and any follow-up issues filed. Never close an issue without that comment.

### Triage labels

Default labels: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
