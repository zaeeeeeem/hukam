# Hukam landing page

Marketing page for Hukam (WhatsApp -> Gemma 4 -> coding agents). Vite + React, no backend.

```bash
npm install
npm run dev -- --port 5180   # http://localhost:5180
npm run build                # static output in dist/
```

- Sections live in `src/components/` (`Hero`, `Why`, `action/` for the WhatsApp flow, `Steps`, `Faq`, `Footer` + `DotWordmark`).
- Generated images are in `public/generated/`. Design notes and references: `DESIGN-NOTES.md`.
- `?story=<0|1>-<0..17>` freezes the "in action" storyboard on one frame (for screenshots).

Built on a handoff from another engineer; see the first commit on this folder.
