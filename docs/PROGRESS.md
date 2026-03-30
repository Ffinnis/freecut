# Progress

MVP target: 2026-04-06 (7-day sprint starting 2026-03-30)

## Day 1 — 2026-03-30: Project Scaffolding

### Completed
- [x] SvelteKit + Electron project scaffolded from scratch
- [x] Dark theme CSS with custom properties
- [x] Electron main process with dev/prod loading
- [x] Typed IPC via contextBridge (preload.ts)
- [x] FFmpeg binary path resolution (ffmpeg.ts)
- [x] Data model: Project, Segment, DetectionSettings interfaces
- [x] Svelte 5 runes-based project store
- [x] Drop zone landing page (drag-and-drop + click to browse)
- [x] File open dialog wired via IPC
- [x] Dev mode working: `pnpm dev` launches Vite + Electron with HMR
- [x] electron-builder config for macOS packaging
- [x] MIT license

- [x] Full app shell: CSS Grid layout matching Recut design
- [x] Neutral dark gray color scheme (replaced blue-tinted palette)
- [x] UI state store (tabs, playhead, zoom)
- [x] Right sidebar with Silence/Sections/Export tabs
- [x] Silence tab: intensity 4-stop slider, threshold controls with Auto mode
- [x] Transport bar: segments button, play/ff/skip, timecode display
- [x] Timeline: time ruler, video/audio track rows, gutter controls
- [x] Status bar: FPS, duration summary, zoom slider
- [x] Drop zone refactored with dashed circle (Recut-style)
- [x] Video preview placeholder
- [x] Sections tab: segment list with type badges
- [x] Export tab: format grid + editor project options

### Not yet started
- [ ] Silence detection engine (FFmpeg silencedetect)
- [ ] Waveform rendering (wavesurfer.js)
- [ ] Segment highlighting on timeline
- [ ] Timeline editing (toggle, drag edges, undo/redo)
- [ ] Video preview with cut playback
- [ ] Export: re-encode (MP4, MOV, WAV, MP3)
- [ ] Export: EDL, FCP XML, AAF generators

## Day 2 — Silence detection + waveform
## Day 3 — Timeline editing
## Day 4 — Video preview with cut playback
## Day 5 — FFmpeg re-encode export
## Day 6 — EDL, FCP XML, AAF export
## Day 7 — Polish, README, release
