# Export Feature Design Spec

## Overview

Export functionality for free-cut: re-encoded media files (MP4, MOV, WAV, MP3) with silence removed, and editor interchange formats (FCP XML, EDL, AAF) that reference the original source file.

## Decisions

- **Cut only** — segments marked `remove` are deleted, kept segments concatenated. No speed manipulation.
- **Frame-accurate** — all video exports re-encode at source quality (no stream copy) for clean cuts.
- **Filter-complex concat** — single FFmpeg pass using `trim`/`setpts`/`concat` filter graph.
- **Inline sidebar UX** — format grid → settings → progress → done, all within ExportTab.
- **Auto-detect framerate** — FFprobe reads source FPS, user can override for editor formats.
- **Target editors** — DaVinci Resolve, Final Cut Pro, Premiere Pro.

## Architecture

Three layers:

### 1. UI Layer — ExportTab.svelte

Local component state machine with four states:

```
FORMAT_GRID → (click format) → SETTINGS → (Export btn) → SAVE_DIALOG → EXPORTING → DONE
                  ↑ (back)        ↑                                        ↓
                  └────────────────┘                                    (cancel) → FORMAT_GRID
                                                                       DONE → FORMAT_GRID
```

**Format grid:** Current 2-column button layout (MP4, MOV, WAV, MP3 | FCP XML, EDL, AAF). Clicking a format transitions to settings.

**Settings view:**
- Back arrow + "Export {FORMAT}" title
- Video formats (MP4/MOV): quality preset buttons (Low / Medium / High / Original), estimated output size
- MP3: quality preset buttons (Low=128 / Medium=192 / High=256 / Original=320 kbps)
- WAV: no quality options (lossless), just the Export button
- Editor formats: framerate dropdown, auto-detected value pre-selected
- Export button triggers OS save dialog, then starts export

**Exporting view:**
- "Exporting {FORMAT}..." title
- Progress bar + percentage + estimated time remaining
- Cancel button

**Done view:**
- Checkmark + "Export complete"
- "Open file" / "Open folder" links
- "Export another" button → back to format grid

All state is local to ExportTab — no global store changes.

### 2. IPC Layer

#### Types (`src/lib/types/ipc.ts`)

```typescript
interface ExportRequest {
  sourceFile: string;
  segments: { start: number; end: number }[];  // kept segments only
  format: 'mp4' | 'mov' | 'wav' | 'mp3' | 'fcpxml' | 'edl' | 'aaf';
  outputPath: string;
  quality?: 'low' | 'medium' | 'high' | 'original';  // media formats only
  framerate?: number;  // editor formats only
}

interface ExportProgress {
  percent: number;
  timeRemaining: number | null;  // seconds, null if unknown
}

interface ProbeResult {
  fps: number;
  width: number;
  height: number;
  videoBitrate: number;
  audioBitrate: number;
  duration: number;
  videoCodec: string;
  audioCodec: string;
}
```

#### Channels

| Channel | Direction | Payload |
|---------|-----------|---------|
| `media:probe` | renderer → main | `sourceFile` → `ProbeResult` |
| `media:export` | renderer → main | `ExportRequest` → `{ success, outputPath?, error? }` |
| `media:exportProgress` | main → renderer | `ExportProgress` (streamed) |
| `media:exportCancel` | renderer → main | void |
| `shell:openPath` | renderer → main | `filePath` → void |
| `shell:showInFolder` | renderer → main | `filePath` → void |

### 3. Export Engine

#### Video Export — `electron/export.ts`

FFmpeg filter-complex concat approach:

1. FFprobe source file → resolution, fps, bitrate, codec
2. Build filter-complex from kept segments:
   - Video: `[0:v]trim=start:end,setpts=PTS-STARTPTS[vN]` per segment
   - Audio: `[0:a]atrim=start:end,asetpts=PTS-STARTPTS[aN]` per segment
   - Concat: `[v0][a0][v1][a1]...concat=n=N:v=1:a=1[v][a]`
3. Quality presets (video):
   - **Low** — CRF 28, scaled to 720p
   - **Medium** — CRF 23, original resolution
   - **High** — CRF 18, original resolution
   - **Original** — match source bitrate via `-b:v`
4. Containers: MP4 → H.264/AAC, MOV → H.264/AAC
5. Progress: parse `time=` from FFmpeg stderr, compare to total edit duration

#### Audio Export

Same filter-complex but audio-only (`atrim`/`asetpts`/`concat`):

- **WAV** — PCM 16-bit, original sample rate
- **MP3** — quality maps to bitrate: Low=128, Medium=192, High=256, Original=320 kbps

#### Editor Interchange — `electron/exportEditors.ts`

Pure TypeScript generators, no FFmpeg. All take the same input: kept segments, source path, framerate, duration.

**EDL (CMX 3600):**
- Standard text format, universal editor support
- Each kept segment → one edit event with source in/out timecodes (HH:MM:SS:FF)
- Requires framerate for timecode math

**FCP XML (v1.11):**
- XML project referencing original source file
- Each kept segment → one `<clip>` element with start/duration
- Includes framerate, resolution metadata

**AAF (Advanced Authoring Format):**
- Binary format for Avid/Premiere/Resolve
- Minimal structure: edit decisions + source reference
- Most complex format — if too brittle across editors, defer to post-MVP

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `electron/export.ts` | Create | FFmpeg export engine (video/audio) |
| `electron/exportEditors.ts` | Create | EDL, FCP XML, AAF generators |
| `electron/main.ts` | Modify | Add IPC handlers for probe/export/cancel |
| `electron/preload.ts` | Modify | Expose export IPC to renderer |
| `src/lib/types/ipc.ts` | Modify | Add ExportRequest, ExportProgress, ProbeResult types |
| `src/lib/components/ExportTab.svelte` | Rewrite | State machine UI (grid → settings → progress → done) |
