# PRD: free-cut

**Version**: 0.1 MVP
**Author**: Roman
**Date**: 2026-03-30
**Target MVP Completion**: 2026-04-06

---

## 1. Executive Summary

### Problem Statement

YouTubers waste significant time manually cutting silence and dead air from recordings. Existing tools (Timebolt ~$250/yr, Recut ~$80) are overpriced for what is fundamentally a simple audio-threshold operation. There is no credible open-source alternative.

### Proposed Solution

**free-cut** — a free, open-source desktop app (SvelteKit + Electron) that detects silence in video/audio files via amplitude thresholding, lets users visually review and adjust cuts, then export as re-encoded video or as edit decision files (XML/EDL/AAF) for Final Cut Pro, DaVinci Resolve, Premiere Pro, and Sony Vegas.

### Success Criteria

| Metric | Target |
|---|---|
| GitHub stars (6 months) | >= 500 |
| Silence detection accuracy (amplitude-based) | >= 95% of silent segments correctly identified at default threshold |
| End-to-end processing time | <= 2x realtime for 1080p H.264 files |
| Export format support | MP4, MOV, WAV, MP3 + FCP XML, EDL, AAF |
| Crash-free session rate | >= 98% |

---

## 2. User Experience & Functionality

### User Personas

| Persona | Description |
|---|---|
| **Solo YouTuber** | Records talking-head or tutorial videos. Wants to remove silence/pauses before editing in Final Cut or DaVinci. Values speed over precision. |
| **Podcaster** | Edits audio-only files. Needs WAV/MP3 export with silence stripped. |

### User Stories

#### MVP (this week)

**US-1: Import media**
> As a YouTuber, I want to drag-and-drop a video/audio file so I can start editing immediately.

Acceptance Criteria:
- Supports MP4, MOV, MKV, WebM, WAV, MP3, AAC
- Files of any size load without crashing
- Waveform renders within 3 seconds for files up to 1 hour
- Shows file metadata (duration, resolution, codec, file size)

**US-2: Detect silence**
> As a user, I want the app to automatically detect silent segments so I don't have to find them manually.

Acceptance Criteria:
- Amplitude-based detection with configurable threshold (dB slider, default -35dB)
- Configurable minimum silence duration (ms slider, default 500ms)
- Silent segments highlighted visually on the waveform/timeline
- Detection completes within 5 seconds for a 1-hour file
- Re-detection triggers instantly when threshold/duration sliders change

**US-3: Preview cuts**
> As a user, I want to preview my video with silence removed so I can verify the result before exporting.

Acceptance Criteria:
- Playback skips silent segments in real-time
- Play/pause, seek via timeline click
- Visual indicator of current playback position on waveform
- Audio and video stay in sync during preview

**US-4: Adjust cuts manually**
> As a user, I want to fine-tune which segments are kept or removed so I have full control.

Acceptance Criteria:
- Click a silent segment to toggle keep/remove
- Drag segment edges to adjust cut points
- "Select all" / "Deselect all" for batch operations
- Undo/redo (Cmd+Z / Cmd+Shift+Z)

**US-5: Configure cut speed/padding**
> As a user, I want to control padding around cuts and playback speed of silent parts so cuts feel natural.

Acceptance Criteria:
- Padding before/after cuts (ms slider, default 100ms)
- Option to speed up silence instead of removing it (2x, 3x, 4x, 6x, custom)
- Real-time preview reflects padding and speed changes

**US-6: Export re-encoded video/audio**
> As a user, I want to export the final result as a standard video/audio file.

Acceptance Criteria:
- Export formats: MP4 (H.264), MOV (ProRes), WAV, MP3
- Progress bar with ETA during export
- Output file plays correctly in QuickTime, VLC
- No audio drift or sync issues in exported file

**US-7: Export to video editors**
> As a user, I want to export an edit decision list so I can open my project in my preferred editor with cuts pre-applied.

Acceptance Criteria:
- Export as FCP XML (Final Cut Pro 7/X)
- Export as EDL (DaVinci Resolve, Premiere, Vegas)
- Export as AAF (Avid, Premiere)
- Exported project references the original media file
- Cuts import correctly with no off-by-one frame errors

### Non-Goals (not in MVP)

- AI/ML-based silence detection (filler word removal, noise classification)
- Multi-track editing or multi-file batch processing
- Built-in screen/audio recording
- Cloud sync or collaboration features
- Windows/Linux support (post-MVP)
- Plugin/extension system
- Auto-update mechanism (manual download for MVP)

---

## 3. Technical Specifications

### Architecture Overview

```
┌─────────────────────────────────────────────┐
│              Electron Shell                  │
│  ┌───────────────────────────────────────┐  │
│  │          SvelteKit Frontend           │  │
│  │  ┌──────────┐  ┌──────────────────┐   │  │
│  │  │ Waveform │  │  Timeline/Editor │   │  │
│  │  │ Renderer │  │    Component     │   │  │
│  │  └──────────┘  └──────────────────┘   │  │
│  │  ┌──────────┐  ┌──────────────────┐   │  │
│  │  │  Video   │  │  Export Settings │   │  │
│  │  │  Player  │  │     Panel        │   │  │
│  │  └──────────┘  └──────────────────┘   │  │
│  └───────────────┬───────────────────────┘  │
│                  │ IPC                       │
│  ┌───────────────┴───────────────────────┐  │
│  │          Electron Main Process        │  │
│  │  ┌──────────┐  ┌──────────────────┐   │  │
│  │  │  FFmpeg  │  │  Silence Detect  │   │  │
│  │  │  Bridge  │  │    Engine        │   │  │
│  │  └──────────┘  └──────────────────┘   │  │
│  │  ┌──────────┐  ┌──────────────────┐   │  │
│  │  │  Export  │  │  EDL/XML/AAF     │   │  │
│  │  │  Engine  │  │   Generator      │   │  │
│  │  └──────────┘  └──────────────────┘   │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### Core Components

| Component | Responsibility | Tech |
|---|---|---|
| **Waveform Renderer** | Visualize audio amplitude, highlight silent segments | Canvas API or `wavesurfer.js` |
| **Silence Detection Engine** | Analyze audio amplitude, identify segments below threshold | FFmpeg `silencedetect` filter or raw PCM analysis in Node |
| **Video Player** | Synchronized playback with cut preview | HTML5 `<video>` element with custom controls |
| **Timeline Editor** | Visual cut editing, drag edges, toggle segments | Custom Svelte component |
| **FFmpeg Bridge** | Waveform extraction, re-encoding, format conversion | `fluent-ffmpeg` wrapping bundled FFmpeg binary |
| **Export Generators** | Produce EDL, FCP XML, AAF from segment data | Custom TypeScript serializers |

### Data Model

```typescript
interface Project {
  id: string;
  sourceFile: string;          // absolute path to original media
  duration: number;            // total duration in seconds
  sampleRate: number;
  segments: Segment[];
  settings: DetectionSettings;
}

interface Segment {
  id: string;
  start: number;              // seconds
  end: number;                // seconds
  type: 'speech' | 'silence';
  action: 'keep' | 'remove' | 'speed';
  speedMultiplier?: number;   // 2x, 3x, etc. when action is 'speed'
}

type IntensityPreset = 'no-cuts' | 'natural' | 'fast' | 'super';

interface DetectionSettings {
  intensity: IntensityPreset;  // default: 'fast'
  thresholdAuto: boolean;      // default: true (auto-detect from noise floor)
  thresholdValue: number;      // 0.0–1.0 linear scale (auto-calculated or manual)
  minSilenceDuration: number;  // ms (derived from intensity preset, or manual via Customize)
  paddingBefore: number;       // ms, default: 100
  paddingAfter: number;        // ms, default: 100
}

// Intensity preset mappings (approximate)
// No cuts:  minSilence=99999ms (effectively disabled)
// Natural:  minSilence=800ms, padding=200ms
// Fast:     minSilence=400ms, padding=100ms
// Super:    minSilence=200ms, padding=50ms
```

### Key Technical Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Silence detection method | FFmpeg `silencedetect` filter | Battle-tested, fast, no native addon needed |
| Waveform rendering | `wavesurfer.js` | Proven library, supports regions/segments natively |
| Video playback | HTML5 `<video>` | Native Chromium support in Electron, zero dependencies |
| FFmpeg distribution | Bundled static binary via `ffmpeg-static` | No user installation required |
| State management | Svelte stores | Native to SvelteKit, minimal boilerplate |
| IPC pattern | Electron `ipcMain`/`ipcRenderer` with typed channels | Type-safe communication between processes |

### Integration Points

| System | Method | Purpose |
|---|---|---|
| FFmpeg | Child process (bundled binary) | Audio analysis, re-encoding, waveform data extraction |
| File system | Node.js `fs` via Electron main process | Read source files, write exports |
| OS | Electron `dialog`, `shell` | File open/save dialogs, reveal in Finder |

### Security & Privacy

- All processing is local — no network calls, no telemetry, no analytics
- No user accounts or authentication
- Source files are never modified (read-only access)
- Exported files are written only to user-selected locations via OS save dialog

---

## 4. Export Format Specifications

### EDL (Edit Decision List)

```
TITLE: free-cut export
FCM: NON-DROP FRAME

001  001      V     C        00:00:00:00 00:00:05:12 00:00:00:00 00:00:05:12
002  001      V     C        00:00:08:00 00:00:15:20 00:00:05:12 00:00:12:22
```

- CMX 3600 format (industry standard)
- 30fps timecode (configurable)
- One entry per kept segment

### FCP XML

- Final Cut Pro 7 XML format (broadly compatible with FCP X via import)
- References original media file path
- Each kept segment as a `<clipitem>` in a `<sequence>`

### AAF

- Minimal AAF with edit decisions only
- Compatible with Premiere Pro and Avid Media Composer import

---

## 5. UI/UX Design

_Reference: Recut app screenshots (see `/docs/reference/` if saved)_

### Layout (single window, three zones)

```
┌──────────────────────────────────────────┬──────────────────┐
│                                          │ [Silence][Section]│
│          Video Preview Area              │    [Export]       │
│          (16:9, responsive)              │                  │
│                                          │ [Remove Silence] │
│   ┌──────────────────────────────┐       │  ⚙ Customize >   │
│   │  Drop a File to Edit         │       │                  │
│   │  audio or video              │       │ Intensity        │
│   │       ↓                      │       │ How tight/loose  │
│   │  Or click to Browse.         │       │ ○───────●──○     │
│   └──────────────────────────────┘       │ NoCuts Natural   │
│                                          │       Fast Super │
│                                          │                  │
│                                          │ Threshold        │
│                                          │ Below=silent     │
│                                          │ ☑ Auto  [0.032]  │
│                                          │ ○────●─────────  │
├──────────────────────────────────────────┴──────────────────┤
│ [⚡Segments] [✂]    ▶  ▶▶  skip   🗑    00:00:00:00       │
├─────────────────────────────────────────────────────────────┤
│  ▼  10s       20s       30s       40s       🔍━━━○━━━       │
├─────────────────────────────────────────────────────────────┤
│ 🔊👁🎨 filename.mp4                                         │
│ ████████████████████████████  (video track - green bar)     │
├─────────────────────────────────────────────────────────────┤
│ 🔊👁🎨 filename.mp4                                         │
│ ▁▃█▅▁░░▁▃▆█▅▃▁░░░▁▃▅█▆▃▁  (waveform + pink silence)     │
├─────────────────────────────────────────────────────────────┤
│ 60fps  duration 00:44 – 00:42 without silence – 5 cuts     │
└─────────────────────────────────────────────────────────────┘
```

### Right Sidebar — Three Tabs

#### Silence Tab (primary)
- **"Remove Silence" button** — one-click action, gear icon for settings
- **"Customize >"** — expands advanced settings (padding, min duration)
- **Intensity presets** — labeled slider with 4 stops: `No cuts | Natural | Fast | Super`
  - Controls how aggressively cuts are made (maps to min silence duration + padding combo)
  - Default: `Fast`
- **Threshold** — amplitude level below which audio is considered silent
  - **Auto mode** (checkbox, default on): auto-calculates optimal threshold from file's noise floor
  - **Manual mode**: slider + numeric input field for precise control (0.0–1.0 linear scale)
  - Changing threshold instantly re-highlights segments on timeline

#### Sections Tab
- Lists all detected segments (speech/silence) with timestamps
- Click to navigate to segment on timeline
- Toggle individual segments keep/remove

#### Export Tab
- Format selection (MP4, MOV, WAV, MP3)
- Editor export (FCP XML, EDL, AAF)
- Output path selector
- Export button with progress

### Transport Bar (between preview and timeline)

- **Segments button** — toggle segment list visibility, shows count badge
- **Scissors icon** — manual cut tool (split segment at playhead)
- **Play / Fast-forward / Skip** — skip jumps to next segment boundary
- **Trash icon** — delete selected segment(s)
- **Timecode display** — frame-accurate `HH:MM:SS:FF` format

### Timeline

- **Time ruler** — adaptive scale (seconds for short files, minutes for long)
- **Zoom controls** — magnifying glass + slider in bottom-right of timeline
- **Playhead** — red vertical marker, draggable for seeking
- **Two tracks per file**:
  1. **Video track** — solid green bar showing kept regions, filename label
  2. **Audio/waveform track** — waveform visualization with pink/red overlay on silent segments
- **Per-track controls** (left gutter):
  - Audio mute toggle (speaker icon)
  - Visibility toggle (eye icon)
  - Effects toggle
- **Segment interaction**: click to select, drag edges to resize, right-click for context menu

### Empty State

- Large centered drop zone: "Drop a File to Edit — audio or video"
- Dashed circle with down-arrow icon
- "Or click to Browse." text link below
- Sidebar and timeline visible but inactive (greyed out)

### Status Bar (bottom)

- **Left**: FPS of loaded file
- **Center**: `duration {total} – {without silence} without silence – {n} cuts`
- **Right**: Zoom controls (magnifying glass + slider)

### Autosave

- Project state auto-saves on every change
- "Autosaved" indicator flashes briefly in top-left after save
- Project file format: `.freecut` (JSON)

### Design Principles

- **Recut-like layout**: Sidebar for controls, main area for preview, bottom for timeline — proven UX for this task
- **Dark theme**: Default dark UI (video editors convention, matches Recut)
- **Keyboard-first**: Space = play/pause, J/K/L = shuttle, Cmd+E = export, Left/Right = skip segments
- **Instant feedback**: Slider changes re-trigger detection and re-highlight immediately
- **Progressive disclosure**: Basic controls visible by default, advanced behind "Customize >"

---

## 6. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| FFmpeg processing slow on large files | Poor UX | Medium | Stream-based processing, show progress, allow cancel |
| Waveform rendering OOM on 2hr+ files | Crash | Medium | Downsample waveform data, render visible viewport only |
| EDL/XML frame accuracy issues | Broken exports | High | Test against actual FCP/DaVinci imports, use frame-accurate timecodes |
| Electron bundle size too large | Slow download | Low | FFmpeg binary adds ~70MB; acceptable for desktop app |
| wavesurfer.js doesn't meet custom timeline needs | Rewrite required | Medium | Evaluate early in day 1-2, fall back to custom Canvas if needed |

---

## 7. MVP Phased Rollout

### Week 1 — MVP (2026-03-30 → 2026-04-06)

| Day | Deliverable |
|---|---|
| Day 1 (Mon) | Project scaffolding: SvelteKit + Electron + FFmpeg integration. File open dialog. |
| Day 2 (Tue) | Silence detection engine + waveform rendering with segment highlighting |
| Day 3 (Wed) | Timeline editing: toggle segments, drag edges, undo/redo |
| Day 4 (Thu) | Video preview with cut playback, speed-up silence mode |
| Day 5 (Fri) | FFmpeg re-encode export (MP4, MOV, WAV, MP3) |
| Day 6 (Sat) | EDL, FCP XML, AAF export generators |
| Day 7 (Sun) | Polish, README, GitHub release, demo video |

### v1.1 (post-MVP)

- Windows + Linux builds
- Batch processing (multiple files)
- AI-based filler word detection ("um", "uh", "like")
- Custom keyboard shortcuts
- Auto-update via Electron updater

### v2.0 (future)

- Multi-track support
- Noise gate / noise reduction
- Smart scene detection (visual cuts)
- Plugin system for custom export formats
- Community presets (share detection settings)

---

## 8. Open-Source & Growth Strategy

### Repository Setup

- License: MIT
- README with GIF demo, one-click install, clear value prop
- GitHub Actions: build macOS `.dmg` on every tag
- CONTRIBUTING.md with setup instructions

### Growth to 500 Stars

- Post launch on: r/VideoEditing, r/YouTubers, r/opensource, Hacker News, Product Hunt
- Demo video showing Timebolt comparison (free vs $250/yr)
- SEO: "free timebolt alternative", "open source silence remover"
- Encourage first-time contributors with `good-first-issue` labels
