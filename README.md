# Chroma Console Editor

A free, open-source browser editor for building presets for the Hologram Chroma Console multi-effects pedal. Unofficial: not affiliated with or endorsed by Hologram Electronics.

It runs in Chrome or Edge (Web MIDI) and connects to the pedal over USB-C, any DIN MIDI interface, or the built-in Virtual Pedal. See [SPEC.md](SPEC.md) for what v1 covers and [CONTEXT.md](CONTEXT.md) for the vocabulary.

## Development

```sh
npm ci
npm run dev        # Vite dev server (no service worker)
npm run typecheck
npm test           # unit tests (Vitest)
npm run e2e        # Playwright, against the production build and a second server under the Pages sub-path
```

CI runs all three on every push and deploys `main` to GitHub Pages.

## Licence

MIT
