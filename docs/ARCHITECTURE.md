# Architecture

## Overview

free-cut is a desktop app built with SvelteKit (renderer) + Electron (main process). All media processing happens locally via bundled FFmpeg.

## Stack

- **Frontend**: SvelteKit 5 (Svelte 5 runes) with `@sveltejs/adapter-static` (SPA mode)
- **Desktop shell**: Electron 35
- **Media processing**: FFmpeg (bundled via `ffmpeg-static`) + `fluent-ffmpeg`
- **Waveform**: Custom canvas renderer with mipmap peak levels
- **State**: Svelte 5 `$state` runes (class-based stores in `.svelte.ts` files)
- **Package manager**: pnpm

## Directory Structure

```
free-cut/
├── electron/              # Electron main process (TypeScript → CommonJS)
│   ├── main.ts            # BrowserWindow, IPC handlers, dev/prod loading, local media protocol
│   ├── preload.ts         # contextBridge API exposed to renderer
│   ├── ffmpeg.ts          # FFmpeg binary path resolution
│   ├── waveform.ts        # FFmpeg audio peak extraction + streaming chunks
│   └── tsconfig.json      # Separate tsconfig: CommonJS output to dist/
│
├── src/                   # SvelteKit frontend (renderer)
│   ├── app.html           # HTML shell
│   ├── app.css            # Dark theme CSS custom properties (neutral grays)
│   ├── lib/
│   │   ├── types/
│   │   │   ├── project.ts # Project, Segment, DetectionSettings interfaces
│   │   │   └── ipc.ts     # ElectronAPI, WaveformData, WaveformChunk types
│   │   ├── stores/
│   │   │   ├── project.svelte.ts  # Project state, waveform lifecycle, silence detection, segment edits
│   │   │   └── ui.svelte.ts       # UI state (tabs, playback, playhead, zoom, seek requests, selected segment)
│   │   ├── utils/
│   │   │   └── silenceDetection.ts # Waveform-envelope silence detection + segment rebuilding
│   │   └── components/
│   │       ├── AppShell.svelte       # CSS Grid layout (preview/sidebar/transport/timeline/status)
│   │       ├── DropZone.svelte       # File drag-and-drop + triggers waveform extraction
│   │       ├── VideoPreview.svelte   # HTML5 video preview + clock sync
│   │       ├── Sidebar.svelte        # Right sidebar with tab switching
│   │       ├── SilenceTab.svelte     # Silence detection controls (intensity/threshold)
│   │       ├── SectionsTab.svelte    # Segment list panel
│   │       ├── ExportTab.svelte      # Export format selection panel
│   │       ├── TransportBar.svelte   # Playback controls + timecode
│   │       ├── Timeline.svelte       # Timeline with tracks + gutter + waveform + seek interaction
│   │       ├── TimeRuler.svelte      # Adaptive time ruler
│   │       ├── WaveformCanvas.svelte # Canvas waveform renderer with mipmap LOD
│   │       └── StatusBar.svelte      # FPS, duration summary, zoom
│   └── routes/
│       ├── +layout.ts     # ssr=false, prerender=true
│       ├── +layout.svelte # Root layout, imports app.css
│       └── +page.svelte   # Renders AppShell
│
├── static/                # Static assets (favicon, etc.)
├── dist/                  # Compiled Electron JS (gitignored except package.json)
├── build/                 # SvelteKit static output (gitignored)
└── release/               # electron-builder output (gitignored)
```

## ESM/CJS Split

- Root `package.json` has `"type": "module"` for SvelteKit/Vite
- `dist/package.json` has `{"type": "commonjs"}` so Electron loads compiled `.js` as CJS
- Electron's `tsconfig.json` compiles to `module: "CommonJS"` targeting `../dist`

## Dev Mode

`pnpm dev` runs two processes via `concurrently`:
1. **Vite dev server** on `localhost:5173` with HMR
2. **Electron** compiles TS, waits for Vite, then loads the dev URL

## Production Build

`pnpm build` → `vite build` (static HTML to `build/`) + `tsc` (Electron to `dist/`)
`pnpm package` → build + `electron-builder` (macOS `.dmg`)

## IPC Security

- `contextIsolation: true`, `nodeIntegration: false`
- Preload script uses `contextBridge.exposeInMainWorld` to expose typed `window.electronAPI`
- Renderer never touches Node.js directly
- Local preview playback is exposed through a custom Electron protocol instead of direct `file://` renderer access

## IPC Channels

| Channel | Direction | Purpose |
|---|---|---|
| `dialog:openFile` | renderer → main | File picker dialog |
| `dialog:saveFile` | renderer → main | Save dialog |
| `media:extractWaveform` | renderer → main | Extract audio peaks from media file |
| `media:waveformChunk` | main → renderer | Progressive waveform data chunks |
| `file:opened` | main → renderer | Notify renderer of externally opened file |

## Local Media Playback

Preview playback uses a custom Electron protocol, `freecut-media://`, registered in `electron/main.ts`.

- The renderer never loads project files via raw `file://` URLs.
- The protocol resolves the requested source file on the main-process side and streams it back to Chromium.
- Byte-range requests are handled explicitly (`206 Partial Content`, `Content-Range`, `Accept-Ranges`) so the HTML5 `<video>` element can seek immediately to arbitrary frames.
- Waveform extraction is a separate FFmpeg job and no longer blocks the preview from loading its first frame or metadata.

## UI Layout

The app uses a CSS Grid shell (`AppShell.svelte`) dividing the window into 5 zones:

```
┌─────────────────────────┬──────────┐
│      Preview Area       │ Sidebar  │
│  (DropZone or Video)    │ (3 tabs) │
├─────────────────────────┴──────────┤
│           Transport Bar            │
├────────────────────────────────────┤
│    Timeline (ruler + tracks)       │
├────────────────────────────────────┤
│           Status Bar               │
└────────────────────────────────────┘
```

- Grid columns: `1fr var(--sidebar-width)` (280px sidebar)
- Grid rows: `1fr 44px 180px 28px`
- macOS `hiddenInset` title bar with 38px drag region at top
- Sidebar tabs: Silence (controls), Sections (segment list), Export (format selection)

## Waveform Pipeline

Audio waveform extraction and rendering is the first real data pipeline in the app. It spans the full Electron → IPC → renderer stack.

### Extraction (`electron/waveform.ts`)

FFmpeg decodes audio to 8 kHz mono signed 16-bit PCM, piped to stdout. The stream is processed in 64 KB chunks without buffering the full PCM in memory:

```
FFmpeg → s16le PCM pipe → 40-sample windows → max absolute amplitude → normalized 0.0–1.0 peaks
```

- **Decode rate**: 8 kHz (sufficient for amplitude envelope, 5.5x cheaper than 44.1 kHz)
- **Peak resolution**: 200 peaks/second (window of 40 samples)
- **3-hour file**: ~2.16M peaks, ~8.6 MB — fits comfortably in memory
- **Duration**: Parsed from FFmpeg stderr (`Duration: HH:MM:SS.xx` line), avoiding the need for ffprobe

### Progressive Streaming

Extraction supports chunked delivery for large files. The main process emits `WaveformChunk` events at ~10% progress intervals via `event.sender.send('media:waveformChunk', chunk)`. Each chunk contains:

- `requestId` — correlates chunks to the originating request (prevents stale data from overwriting)
- `startIndex` — offset into the peaks array
- `progress` — 0.0–1.0 completion fraction
- `peaks[]` — the new peak data for this chunk

The store (`projectState.applyWaveformChunk()`) appends chunks incrementally, so the waveform renders progressively as FFmpeg decodes.

### Rendering (`WaveformCanvas.svelte`)

A custom canvas component draws the visible waveform slice, synced with the timeline zoom/scroll system:

1. **Mipmap peak levels**: On first render (or when peaks change), builds a binary tree of max-pooled levels. Level 0 is the raw peaks array; each subsequent level halves the resolution by taking `max(left, right)` pairs. This allows O(1) lookup of the best level for any zoom.

2. **Level-of-detail selection**: Based on `peaksPerPixel` (derived from `peaksPerSecond / pps`), picks the coarsest mipmap level where `groupSize <= peaksPerPixel`. At deep zoom (many pixels per peak), uses level 0 directly.

3. **Viewport culling**: Only processes peaks visible in the current scroll window. Converts `scrollX` and `viewportWidth` to time range, then to peak indices.

4. **Rendering modes**:
   - **Zoomed in** (`pixelsPerPeak >= 1`): Each peak draws a vertical bar at its time position. Bar width = `pixelsPerPeak`.
   - **Zoomed out** (`pixelsPerPeak < 1`): Iterates by pixel column, queries the mipmap level for max value in that column's time range, draws 1px-wide bars.

5. **Performance**: Draws via `requestAnimationFrame` to avoid redundant repaints. Canvas dimensions account for `devicePixelRatio` (Retina). Uses `transform: translateX(scrollX)` positioning within the scrollable track container.

Visual style: mirrored green bars (`rgba(74, 222, 128, 0.65)`) centered vertically, minimum 1px height for near-silence.

## Silence Detection

Silence detection currently runs in the renderer on top of the extracted waveform envelope rather than using a second FFmpeg `silencedetect` pass. This keeps threshold and intensity changes interactive and avoids duplicating analysis work already done for waveform extraction.

Pipeline in `src/lib/utils/silenceDetection.ts`:

1. Resolve the effective threshold:
   - **manual mode** uses `manualThresholdValue`
   - **auto mode** estimates a noise floor from the 20th percentile of non-zero peaks, scaled and clamped
2. Mark peaks below threshold as silent.
3. Close tiny speech gaps (`75ms`) so brief spikes do not split one pause into multiple regions.
4. Keep only silent runs above the current intensity preset's `minSilenceDuration`.
5. Trim silence runs by `paddingBefore` and `paddingAfter`, then merge overlaps.
6. Rebuild the full alternating `speech` / `silence` segment list used by the timeline, sections panel, and status bar.

Detection is triggered:
- automatically when waveform extraction completes
- manually from the `Remove Silence` button
- when intensity changes
- when threshold mode/value changes

Manual threshold dragging is coalesced to `requestAnimationFrame` so visual updates stay live without making the slider feel blocked.

## State Management

Two Svelte 5 runes stores (class-based with `$state`):
- **projectState** (`project.svelte.ts`): project data, detection settings, waveform data, silence detection scheduling, segment edits, and waveform lifecycle
- **uiState** (`ui.svelte.ts`): active tab, playback state, current playhead time, zoom fraction, viewport width, explicit seek requests, and the selected segment id

Playback flow:

1. `VideoPreview.svelte` owns the actual HTML5 media element.
2. The media element publishes playback time into `uiState` for the transport timecode and timeline playhead.
3. `TransportBar.svelte` toggles `uiState.isPlaying`; `AppShell.svelte` adds the global `Space` shortcut plus `Delete`/`Backspace` toggle for the selected silence segment outside text-entry controls.
4. `Timeline.svelte` converts pointer positions into time values and issues explicit seek requests back to the preview player.

## Timeline Zoom System

The timeline uses pixel-based positioning with horizontal scrolling. Zoom is controlled by a `zoomFraction` (0–1) that maps logarithmically to pixels-per-second (pps):

```
minPps = viewportWidth / (4 × duration)   → min zoom: 4× duration visible
maxPps = viewportWidth / 4                 → max zoom: ~4 seconds visible
pps    = minPps × (maxPps / minPps) ^ zoomFraction
```

Key components:
- **ui.svelte.ts** exports pure zoom math functions (`computePps`, `timeToPixel`, etc.) used by all timeline components
- **Timeline.svelte** has a fixed gutter column + scrollable content area; measures viewport with `ResizeObserver`; stabilizes scroll position on zoom (zoom-to-center); maps pointer input to seek positions using the scrolled viewport coordinate space; hit-tests silence regions on the audio track for selection
- **TimeRuler.svelte** picks tick intervals based on pps (targeting ~100px spacing), snaps to nice values (0.1s–1h), and viewport-culls to only render visible ticks
- **WaveformCanvas.svelte** renders the threshold band, silence overlays, waveform bars, and selected-segment border in a single canvas pass

## Data Model

Core types in `src/lib/types/project.ts`:
- **Project**: source file, duration, segments, detection settings
- **Segment**: start/end times, type (speech/silence), action (keep/remove/speed)
- **DetectionSettings**: intensity preset, effective threshold, manual threshold, padding, min silence duration
- **IntensityPreset**: `no-cuts | natural | fast | super`

Waveform types in `src/lib/types/ipc.ts`:
- **WaveformData**: `{ duration, peaksPerSecond, peaks[] }` — the complete peak array
- **WaveformChunk**: extends WaveformData with `requestId`, `startIndex`, `progress` — for progressive delivery
- **WaveformExtractRequest**: `{ filePath, requestId }` — sent to main process

Waveform data is stored on `projectState` (not inside `Project`) because it is large, easily regenerated from the source file, and should not be serialized to save files. The store manages a full load lifecycle: `beginWaveformLoad()` → `applyWaveformChunk()` (progressive) → `finishWaveformLoad()` / `failWaveformLoad()`, with `requestId` correlation to prevent stale data races.
