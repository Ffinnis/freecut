# Remove Silence Feature Design

## Summary

When the user toggles "remove silence" mode, the timeline collapses to show only kept (voice) segments side by side, and playback uses a dual-video-element swap technique for smooth, gapless transitions between segments. Toggling off restores the original timeline view instantly.

## Data Model: EditTimeline

A reactive mapping between collapsed "edit time" and original "source time."

### EditSegment

```typescript
interface EditSegment {
  editStart: number;    // position in collapsed timeline (seconds)
  editEnd: number;      // end in collapsed timeline (seconds)
  sourceStart: number;  // original position in source file (seconds)
  sourceEnd: number;    // original end in source file (seconds)
}
```

### Construction

Built from `project.segments` by filtering segments where `action === 'keep'`, then accumulating edit offsets:

```
kept segments:   [0-3s] [5-8s] [9-12s]
edit offsets:    [0-3s] [3-6s] [6-9s]
```

Stored as a sorted array for O(log n) binary search.

### Functions

- `buildEditTimeline(segments: Segment[]): EditSegment[]` — constructs the timeline from project segments
- `editToSource(editTime: number, timeline: EditSegment[]): number` — converts edit time to source time
- `sourceToEdit(sourceTime: number, timeline: EditSegment[]): number` — converts source time to edit time
- `findEditSegmentAtTime(editTime: number, timeline: EditSegment[]): { segment: EditSegment; index: number } | null` — binary search for segment containing an edit time
- `editDuration(timeline: EditSegment[]): number` — total duration of all kept segments (last segment's editEnd)

### Location

New file: `src/lib/utils/editTimeline.ts`

## UI State

### New state in UIState (`src/lib/stores/ui.svelte.ts`)

```typescript
silenceRemoved = $state(false);
```

- `false` (default): original timeline, single-video playback
- `true`: collapsed timeline, dual-video playback

### Toggle behavior

- Toggle ON: timeline collapses, playback engine switches to dual-video mode
- Toggle OFF: timeline restores, reverts to single-video mode
- If toggled during playback: pause first, switch modes, seek to equivalent position

## UI: Toggle Button

A toggle button in the **TransportBar** (near play controls). Scissors icon that highlights when active.

- Enabled only when segments exist (silence detection has run)
- Visual indicator (accent color / glow) when `silenceRemoved` is true

## Collapsed Timeline Rendering

When `silenceRemoved` is ON, the following changes apply to `Timeline.svelte`:

### Duration & zoom

- All time calculations use `editDuration` instead of `totalDuration`
- `pps`, `contentWidth`, `trackWidth` derive from edit duration
- Zoom math unchanged except for the duration input

### Waveform

- Build a collapsed peaks array by concatenating peaks from kept segments only
- Pass this collapsed array to `WaveformCanvas` instead of the full peaks array
- No segment overlays drawn (no silence segments visible in collapsed mode)
- Threshold band still drawn if desired

### Video track

- Track bar width = `editDuration * pps`
- Each kept segment rendered as a contiguous clip with the filename label
- Thin vertical lines at segment boundaries (cut markers)

### Time ruler

- Shows edit duration
- Tick marks correspond to collapsed time

### Playhead

- Position = `timeToPixel(editCurrentTime, pps)`
- `editCurrentTime` derived from `sourceToEdit(currentTime)` during playback

### Seeking

- Click position maps to edit time via `pixelToTime`
- Edit time converts to source time via `editToSource`
- Source time sent to video element

## Dual Video Playback Engine

### Architecture

Two `<video>` elements in `VideoPreview.svelte`, same source file, alternating roles:

- **Active**: visible (opacity 1), playing the current segment
- **Standby**: hidden (opacity 0), pre-seeking to the next segment's start

Both elements are absolutely positioned, stacked. Only opacity changes on swap — no layout shift.

### Playback flow

1. Play starts: active video plays from `editSegments[0].sourceStart`
2. `requestAnimationFrame` loop monitors `activeVideo.currentTime`
3. When within ~150ms of current segment's `sourceEnd`: standby video seeks to `nextSegment.sourceStart`
4. When `activeVideo.currentTime >= currentSegment.sourceEnd`:
   - Standby starts playing
   - Swap roles: standby becomes active (opacity 1), old active pauses (opacity 0)
   - Old active becomes new standby
5. Repeat until last segment ends, then playback stops

### State tracking

```typescript
currentEditSegmentIndex: number  // which EditSegment is currently playing
activeVideoKey: 'A' | 'B'       // which video element is active
```

### Seeking

- User clicks timeline → edit time → source time
- Find which EditSegment contains that source time
- Update `currentEditSegmentIndex`
- Seek active video to source time

### Edge cases

- **Last segment ends**: fire `handleEnded`, stop playback
- **Toggle off during playback**: pause, switch to single-video, seek to current source time
- **Toggle on during playback**: pause, switch to dual-video, find current segment, seek
- **Single kept segment**: no swapping needed, plays normally
- **No kept segments**: playback disabled

### When silenceRemoved is OFF

Only `videoA` is used. `videoB` stays hidden and paused. Identical to current single-video behavior — zero overhead.

## Time Display

- `formattedTimecode` shows edit time when `silenceRemoved` is ON
- StatusBar duration summary shows edit duration vs original duration
- TransportBar timecode reflects edit position

## Files to create

- `src/lib/utils/editTimeline.ts` — EditTimeline data model and mapping functions

## Files to modify

- `src/lib/stores/ui.svelte.ts` — add `silenceRemoved` toggle state
- `src/lib/components/VideoPreview.svelte` — dual video element engine
- `src/lib/components/Timeline.svelte` — collapsed rendering, edit-time seeking
- `src/lib/components/WaveformCanvas.svelte` — accept collapsed peaks (no structural change needed, just receives different data)
- `src/lib/components/TransportBar.svelte` — add scissors toggle button
- `src/lib/components/StatusBar.svelte` — show edit duration when active

## Out of scope

- FFmpeg export of the edited video
- Undo/redo system
- Manual segment edge dragging
- Crossfade or transition effects at cut points
