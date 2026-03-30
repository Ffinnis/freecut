# Architecture

## Overview

free-cut is a desktop app built with SvelteKit (renderer) + Electron (main process). All media processing happens locally via bundled FFmpeg.

## Stack

- **Frontend**: SvelteKit 5 (Svelte 5 runes) with `@sveltejs/adapter-static` (SPA mode)
- **Desktop shell**: Electron 35
- **Media processing**: FFmpeg (bundled via `ffmpeg-static`) + `fluent-ffmpeg`
- **Waveform**: `wavesurfer.js`
- **State**: Svelte 5 `$state` runes (class-based stores in `.svelte.ts` files)
- **Package manager**: pnpm

## Directory Structure

```
free-cut/
├── electron/              # Electron main process (TypeScript → CommonJS)
│   ├── main.ts            # BrowserWindow, IPC handlers, dev/prod loading
│   ├── preload.ts         # contextBridge API exposed to renderer
│   ├── ffmpeg.ts          # FFmpeg binary path resolution
│   └── tsconfig.json      # Separate tsconfig: CommonJS output to dist/
│
├── src/                   # SvelteKit frontend (renderer)
│   ├── app.html           # HTML shell
│   ├── app.css            # Dark theme CSS custom properties (neutral grays)
│   ├── lib/
│   │   ├── types/
│   │   │   ├── project.ts # Project, Segment, DetectionSettings interfaces
│   │   │   └── ipc.ts     # ElectronAPI type + Window augmentation
│   │   ├── stores/
│   │   │   ├── project.svelte.ts  # Svelte 5 runes project state
│   │   │   └── ui.svelte.ts       # UI state (tabs, playhead, zoom)
│   │   └── components/
│   │       ├── AppShell.svelte       # CSS Grid layout (preview/sidebar/transport/timeline/status)
│   │       ├── DropZone.svelte       # File drag-and-drop empty state
│   │       ├── VideoPreview.svelte   # Video player area (placeholder)
│   │       ├── Sidebar.svelte        # Right sidebar with tab switching
│   │       ├── SilenceTab.svelte     # Silence detection controls (intensity/threshold)
│   │       ├── SectionsTab.svelte    # Segment list panel
│   │       ├── ExportTab.svelte      # Export format selection panel
│   │       ├── TransportBar.svelte   # Playback controls + timecode
│   │       ├── Timeline.svelte       # Timeline with tracks + gutter
│   │       ├── TimeRuler.svelte      # Adaptive time ruler
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

## State Management

Two Svelte 5 runes stores (class-based with `$state`):
- **projectState** (`project.svelte.ts`): project data, segments, detection settings
- **uiState** (`ui.svelte.ts`): active tab, playhead position, zoom fraction, viewport width, playback state

## Timeline Zoom System

The timeline uses pixel-based positioning with horizontal scrolling. Zoom is controlled by a `zoomFraction` (0–1) that maps logarithmically to pixels-per-second (pps):

```
minPps = viewportWidth / (4 × duration)   → min zoom: 4× duration visible
maxPps = viewportWidth / 4                 → max zoom: ~4 seconds visible
pps    = minPps × (maxPps / minPps) ^ zoomFraction
```

Key components:
- **ui.svelte.ts** exports pure zoom math functions (`computePps`, `timeToPixel`, etc.) used by all timeline components
- **Timeline.svelte** has a fixed gutter column + scrollable content area; measures viewport with `ResizeObserver`; stabilizes scroll position on zoom (zoom-to-center)
- **TimeRuler.svelte** picks tick intervals based on pps (targeting ~100px spacing), snaps to nice values (0.1s–1h), and viewport-culls to only render visible ticks

## Data Model

Core types in `src/lib/types/project.ts`:
- **Project**: source file, duration, segments, detection settings
- **Segment**: start/end times, type (speech/silence), action (keep/remove/speed)
- **DetectionSettings**: intensity preset, threshold, padding, min silence duration
- **IntensityPreset**: `no-cuts | natural | fast | super`
