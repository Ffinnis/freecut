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

- [x] Timeline zoom: pixel-based positioning with horizontal scroll (matches Recut zoom behavior)
- [x] Logarithmic zoom slider (min: 4× duration visible, max: ~4s visible on 16" screen)
- [x] Viewport-culled tick rendering for performance at high zoom
- [x] Zoom-to-center scroll stabilization

- [x] FFmpeg waveform peak extraction (8 kHz mono, 200 peaks/sec, streamed via stdout pipe)
- [x] Duration extracted from FFmpeg stderr (no ffprobe dependency)
- [x] Progressive waveform streaming (chunked IPC delivery at 10% intervals)
- [x] Waveform load lifecycle in project store (begin/chunk/finish/fail with requestId correlation)
- [x] Canvas-based waveform renderer with mipmap peak levels for LOD
- [x] Viewport-culled rendering (only draws visible peaks)
- [x] Retina/DPI-aware canvas scaling
- [x] requestAnimationFrame throttling for smooth redraws
- [x] Waveform synced with timeline zoom/scroll system
- [x] Loading animation (pulse) during extraction
- [x] Graceful fallback for files with no audio

### Not yet started
- [ ] Silence detection engine (FFmpeg silencedetect)
- [ ] Segment highlighting on timeline
- [ ] Timeline editing (toggle, drag edges, undo/redo)
- [ ] Video preview with cut playback
- [ ] Export: re-encode (MP4, MOV, WAV, MP3)
- [ ] Export: EDL, FCP XML, AAF generators

## Day 2 — Silence detection + waveform (partial)

### Completed
- [x] Real audio waveform visualization (replaced wavesurfer.js placeholder with custom canvas renderer)
- [x] FFmpeg-based peak extraction pipeline (electron → IPC → renderer)
- [x] Progressive streaming for large files
- [x] Mipmap-based level-of-detail for zoom performance

## Day 3 — Timeline editing
## Day 4 — Video preview with cut playback
## Day 5 — FFmpeg re-encode export
## Day 6 — EDL, FCP XML, AAF export
## Day 7 — Polish, README, release
