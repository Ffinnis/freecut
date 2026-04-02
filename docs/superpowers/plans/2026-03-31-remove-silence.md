# Remove Silence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a toggle that collapses the timeline to show only kept segments side-by-side with smooth dual-video gapless playback.

**Architecture:** An EditTimeline utility maps between collapsed "edit time" and original "source time." When toggled on, the timeline renders only kept segments packed together, and a dual `<video>` element swap engine provides gapless playback by pre-seeking a standby element to the next segment while the active element plays.

**Tech Stack:** SvelteKit 5 (runes), TypeScript, Vitest, HTML5 Video, Canvas 2D

---

## File Structure

**Create:**
- `src/lib/utils/editTimeline.ts` — EditTimeline data model: `EditSegment` type, `buildEditTimeline`, `editToSource`, `sourceToEdit`, `findEditSegmentAtTime`, `getEditDuration`, `buildCollapsedPeaks`
- `src/lib/utils/editTimeline.test.ts` — Unit tests for all EditTimeline functions
- `vitest.config.ts` — Vitest configuration with `$lib` alias

**Modify:**
- `package.json` — Add vitest devDependency and test scripts
- `src/lib/stores/ui.svelte.ts` — Add `silenceRemoved` toggle state + `toggleSilenceRemoved()` method
- `src/lib/stores/project.svelte.ts` — Add `editTimeline` and `editDuration` derived getters
- `src/lib/components/TransportBar.svelte` — Add scissors toggle button wired to `silenceRemoved`
- `src/lib/components/VideoPreview.svelte` — Dual video element engine with segment swap logic
- `src/lib/components/Timeline.svelte` — Collapsed rendering: conditional duration, collapsed peaks, clip blocks, segment selection disabled
- `src/lib/components/StatusBar.svelte` — Show edit duration when `silenceRemoved` is on

---

### Task 1: Set up Vitest

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Install vitest**

```bash
pnpm add -D vitest
```

- [ ] **Step 2: Create vitest config**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
	test: {
		include: ['src/**/*.test.ts']
	},
	resolve: {
		alias: {
			$lib: path.resolve(__dirname, './src/lib')
		}
	}
});
```

- [ ] **Step 3: Add test scripts to package.json**

Add to `"scripts"` in `package.json`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Verify vitest runs**

```bash
pnpm test
```

Expected: vitest runs and reports "no test files found" (exit 0 or similar).

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts package.json pnpm-lock.yaml
git commit -m "chore: add vitest test framework"
```

---

### Task 2: EditTimeline utility (TDD)

**Files:**
- Create: `src/lib/utils/editTimeline.test.ts`
- Create: `src/lib/utils/editTimeline.ts`

- [ ] **Step 1: Write all tests**

Create `src/lib/utils/editTimeline.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
	buildEditTimeline,
	getEditDuration,
	findEditSegmentAtTime,
	editToSource,
	sourceToEdit,
	buildCollapsedPeaks
} from './editTimeline';
import type { Segment } from '$lib/types/project';

function seg(
	start: number,
	end: number,
	type: 'speech' | 'silence',
	action: 'keep' | 'remove'
): Segment {
	return { id: `${type}:${start}-${end}`, start, end, type, action };
}

const MIXED: Segment[] = [
	seg(0, 3, 'speech', 'keep'),
	seg(3, 5, 'silence', 'remove'),
	seg(5, 8, 'speech', 'keep'),
	seg(8, 9, 'silence', 'remove'),
	seg(9, 12, 'speech', 'keep')
];

describe('buildEditTimeline', () => {
	it('maps kept segments to packed edit positions', () => {
		expect(buildEditTimeline(MIXED)).toEqual([
			{ editStart: 0, editEnd: 3, sourceStart: 0, sourceEnd: 3 },
			{ editStart: 3, editEnd: 6, sourceStart: 5, sourceEnd: 8 },
			{ editStart: 6, editEnd: 9, sourceStart: 9, sourceEnd: 12 }
		]);
	});

	it('returns empty for no segments', () => {
		expect(buildEditTimeline([])).toEqual([]);
	});

	it('returns empty when all removed', () => {
		expect(buildEditTimeline([seg(0, 5, 'silence', 'remove')])).toEqual([]);
	});

	it('handles single kept segment', () => {
		expect(buildEditTimeline([seg(2, 5, 'speech', 'keep')])).toEqual([
			{ editStart: 0, editEnd: 3, sourceStart: 2, sourceEnd: 5 }
		]);
	});
});

describe('getEditDuration', () => {
	it('returns 0 for empty timeline', () => {
		expect(getEditDuration([])).toBe(0);
	});

	it('returns last editEnd', () => {
		expect(getEditDuration(buildEditTimeline(MIXED))).toBe(9);
	});
});

describe('findEditSegmentAtTime', () => {
	const tl = buildEditTimeline(MIXED);

	it('finds first segment', () => {
		expect(findEditSegmentAtTime(1, tl)?.index).toBe(0);
	});

	it('finds middle segment', () => {
		expect(findEditSegmentAtTime(4, tl)?.index).toBe(1);
	});

	it('finds last segment', () => {
		expect(findEditSegmentAtTime(7, tl)?.index).toBe(2);
	});

	it('finds segment at exact boundary', () => {
		expect(findEditSegmentAtTime(3, tl)?.index).toBe(1);
	});

	it('returns null beyond range', () => {
		expect(findEditSegmentAtTime(100, tl)).toBeNull();
	});

	it('returns null for empty timeline', () => {
		expect(findEditSegmentAtTime(0, [])).toBeNull();
	});
});

describe('editToSource', () => {
	const tl = buildEditTimeline(MIXED);

	it('maps within first segment (identity)', () => {
		expect(editToSource(1.5, tl)).toBe(1.5);
	});

	it('maps within second segment (skips gap)', () => {
		expect(editToSource(4, tl)).toBe(6);
	});

	it('maps within third segment', () => {
		expect(editToSource(7, tl)).toBe(10);
	});

	it('clamps below zero', () => {
		expect(editToSource(-1, tl)).toBe(0);
	});

	it('clamps beyond end', () => {
		expect(editToSource(100, tl)).toBe(12);
	});

	it('returns 0 for empty timeline', () => {
		expect(editToSource(5, [])).toBe(0);
	});
});

describe('sourceToEdit', () => {
	const tl = buildEditTimeline(MIXED);

	it('maps within first segment (identity)', () => {
		expect(sourceToEdit(1.5, tl)).toBe(1.5);
	});

	it('maps within second segment (collapses gap)', () => {
		expect(sourceToEdit(6, tl)).toBe(4);
	});

	it('clamps before first segment', () => {
		expect(sourceToEdit(-1, tl)).toBe(0);
	});

	it('clamps after last segment', () => {
		expect(sourceToEdit(100, tl)).toBe(9);
	});

	it('returns 0 for empty timeline', () => {
		expect(sourceToEdit(5, [])).toBe(0);
	});
});

describe('buildCollapsedPeaks', () => {
	it('concatenates peaks from kept segments only', () => {
		// 10 peaks/sec, segments: keep 0-1s, remove 1-2s, keep 2-3s
		const peaks = [
			0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, // 0-1s
			0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, // 1-2s (silence)
			0.5, 0.4, 0.3, 0.2, 0.1, 0.6, 0.7, 0.8, 0.9, 1.0 // 2-3s
		];
		const segs: Segment[] = [
			seg(0, 1, 'speech', 'keep'),
			seg(1, 2, 'silence', 'remove'),
			seg(2, 3, 'speech', 'keep')
		];
		const tl = buildEditTimeline(segs);
		const result = buildCollapsedPeaks(peaks, 10, tl);

		expect(result).toEqual([
			0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 0.5, 0.4, 0.3, 0.2, 0.1, 0.6,
			0.7, 0.8, 0.9, 1.0
		]);
	});

	it('returns empty for empty timeline', () => {
		expect(buildCollapsedPeaks([0.1, 0.2], 10, [])).toEqual([]);
	});
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pnpm test
```

Expected: All tests FAIL (module not found).

- [ ] **Step 3: Implement editTimeline.ts**

Create `src/lib/utils/editTimeline.ts`:

```typescript
import type { Segment } from '$lib/types/project';

export interface EditSegment {
	editStart: number;
	editEnd: number;
	sourceStart: number;
	sourceEnd: number;
}

export function buildEditTimeline(segments: Segment[]): EditSegment[] {
	const result: EditSegment[] = [];
	let editOffset = 0;

	for (const s of segments) {
		if (s.action !== 'keep') continue;
		const dur = s.end - s.start;
		result.push({
			editStart: editOffset,
			editEnd: editOffset + dur,
			sourceStart: s.start,
			sourceEnd: s.end
		});
		editOffset += dur;
	}

	return result;
}

export function getEditDuration(timeline: EditSegment[]): number {
	if (timeline.length === 0) return 0;
	return timeline[timeline.length - 1].editEnd;
}

export function findEditSegmentAtTime(
	editTime: number,
	timeline: EditSegment[]
): { segment: EditSegment; index: number } | null {
	let left = 0;
	let right = timeline.length - 1;

	while (left <= right) {
		const mid = (left + right) >> 1;
		const seg = timeline[mid];

		if (editTime < seg.editStart) {
			right = mid - 1;
		} else if (editTime > seg.editEnd) {
			left = mid + 1;
		} else {
			return { segment: seg, index: mid };
		}
	}

	return null;
}

export function editToSource(editTime: number, timeline: EditSegment[]): number {
	if (timeline.length === 0) return 0;
	if (editTime <= 0) return timeline[0].sourceStart;

	const found = findEditSegmentAtTime(editTime, timeline);
	if (found) {
		return found.segment.sourceStart + (editTime - found.segment.editStart);
	}

	return timeline[timeline.length - 1].sourceEnd;
}

export function sourceToEdit(sourceTime: number, timeline: EditSegment[]): number {
	if (timeline.length === 0) return 0;

	for (const seg of timeline) {
		if (sourceTime >= seg.sourceStart && sourceTime <= seg.sourceEnd) {
			return seg.editStart + (sourceTime - seg.sourceStart);
		}
	}

	if (sourceTime < timeline[0].sourceStart) return 0;
	return timeline[timeline.length - 1].editEnd;
}

export function buildCollapsedPeaks(
	peaks: number[],
	peaksPerSecond: number,
	timeline: EditSegment[]
): number[] {
	const result: number[] = [];

	for (const seg of timeline) {
		const startIdx = Math.round(seg.sourceStart * peaksPerSecond);
		const endIdx = Math.round(seg.sourceEnd * peaksPerSecond);
		for (let i = startIdx; i < endIdx && i < peaks.length; i++) {
			result.push(peaks[i]);
		}
	}

	return result;
}
```

- [ ] **Step 4: Run tests — verify all pass**

```bash
pnpm test
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/editTimeline.ts src/lib/utils/editTimeline.test.ts
git commit -m "feat: add EditTimeline utility with time mapping"
```

---

### Task 3: Store changes — UIState toggle + ProjectState getters

**Files:**
- Modify: `src/lib/stores/ui.svelte.ts`
- Modify: `src/lib/stores/project.svelte.ts`

- [ ] **Step 1: Add silenceRemoved to UIState**

In `src/lib/stores/ui.svelte.ts`, add to the `UIState` class fields (after `selectedSegmentId`):

```typescript
silenceRemoved = $state(false);
```

Add method to the class:

```typescript
toggleSilenceRemoved() {
	this.silenceRemoved = !this.silenceRemoved;
}
```

Update `resetPlayback()` to also reset silenceRemoved:

```typescript
resetPlayback() {
	this.isPlaying = false;
	this.currentTime = 0;
	this.requestedSeekTime = 0;
	this.seekRequestId = crypto.randomUUID();
	this.silenceRemoved = false;
}
```

- [ ] **Step 2: Add editTimeline and editDuration getters to ProjectState**

In `src/lib/stores/project.svelte.ts`, add import at the top:

```typescript
import { buildEditTimeline, getEditDuration, type EditSegment } from '$lib/utils/editTimeline';
```

Add getters to the `ProjectState` class (after `cutCount`):

```typescript
get editTimeline(): EditSegment[] {
	if (!uiState.silenceRemoved || !this.project) return [];
	return buildEditTimeline(this.project.segments);
}

get editDuration(): number {
	return getEditDuration(this.editTimeline);
}
```

- [ ] **Step 3: Verify build**

```bash
pnpm check
```

Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/stores/ui.svelte.ts src/lib/stores/project.svelte.ts
git commit -m "feat: add silenceRemoved toggle and editTimeline getters"
```

---

### Task 4: TransportBar toggle button

**Files:**
- Modify: `src/lib/components/TransportBar.svelte`

- [ ] **Step 1: Add scissors toggle button**

In `src/lib/components/TransportBar.svelte`, replace the existing "Cut" button (the `<button class="transport-btn" aria-label="Cut">` block in the `<div class="left">` section) with:

```svelte
<button
	class="transport-btn"
	class:active-toggle={uiState.silenceRemoved}
	aria-label={uiState.silenceRemoved ? 'Show original timeline' : 'Remove silence'}
	aria-pressed={uiState.silenceRemoved}
	disabled={projectState.cutCount === 0}
	onclick={() => uiState.toggleSilenceRemoved()}
>
	<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<circle cx="6" cy="6" r="3" />
		<path d="M8.12 8.12L12 12" />
		<path d="M20 4L8.12 15.88" />
		<circle cx="6" cy="18" r="3" />
		<path d="M14.8 14.8L20 20" />
	</svg>
</button>
```

- [ ] **Step 2: Add active-toggle style**

Add to the `<style>` section in TransportBar.svelte:

```css
.active-toggle {
	background: var(--accent-muted);
	color: var(--accent);
}

.active-toggle:hover {
	background: var(--accent);
	color: white;
}
```

- [ ] **Step 3: Verify visually**

Run `pnpm dev`, load a video, run silence detection, and confirm the scissors button is visible, disabled when no cuts exist, and toggles visual state on click.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/TransportBar.svelte
git commit -m "feat: add remove-silence toggle to transport bar"
```

---

### Task 5: Collapsed timeline rendering

**Files:**
- Modify: `src/lib/components/Timeline.svelte`

- [ ] **Step 1: Add imports and collapsed state derivations**

In `src/lib/components/Timeline.svelte`, add to the imports:

```typescript
import { buildCollapsedPeaks } from '$lib/utils/editTimeline';
```

Replace the `duration` derivation:

```typescript
let duration = $derived(
	uiState.silenceRemoved && projectState.editDuration > 0
		? projectState.editDuration
		: (projectState.totalDuration || 30 * 60)
);
```

Add collapsed peaks derivation (after the existing derived variables):

```typescript
let collapsedPeaks = $derived(
	uiState.silenceRemoved && projectState.waveform
		? buildCollapsedPeaks(
				projectState.waveform.peaks,
				projectState.waveform.peaksPerSecond,
				projectState.editTimeline
			)
		: []
);
```

- [ ] **Step 2: Update video track for clip rendering**

Replace the `<div class="track video-track">` block (the one containing `<div class="track-bar">`) with:

```svelte
<div class="track video-track">
	{#if uiState.silenceRemoved && projectState.editTimeline.length > 0}
		<div class="clips-row" style="width: {trackWidth}px">
			{#each projectState.editTimeline as clip, i}
				<div
					class="track-clip"
					style="width: {(clip.editEnd - clip.editStart) * pps}px"
				>
					<span class="track-filename">{filename}</span>
				</div>
				{#if i < projectState.editTimeline.length - 1}
					<div class="clip-divider"></div>
				{/if}
			{/each}
		</div>
	{:else}
		<div class="track-bar" style="width: {trackWidth}px">
			<span class="track-filename">{filename}</span>
		</div>
	{/if}
</div>
```

- [ ] **Step 3: Update waveform rendering for collapsed mode**

Replace the waveform `WaveformCanvas` block (the `{#if projectState.waveform}` inside `<div class="track audio-track">`) with:

```svelte
{#if projectState.waveform}
	<div class="waveform-container" style="width: {trackWidth}px">
		<WaveformCanvas
			peaks={uiState.silenceRemoved ? collapsedPeaks : projectState.waveform.peaks}
			peaksPerSecond={projectState.waveform.peaksPerSecond}
			{pps}
			scrollX={uiState.timelineScrollX}
			viewportWidth={uiState.viewportWidth}
			segments={uiState.silenceRemoved ? [] : (projectState.project?.segments ?? [])}
			selectedSegmentId={uiState.silenceRemoved ? null : uiState.selectedSegmentId}
			thresholdValue={uiState.silenceRemoved ? 0 : projectState.settings.thresholdValue}
			height={TRACK_ROW_HEIGHT}
		/>
		<span class="track-filename waveform-label">{filename}</span>
	</div>
{:else if projectState.waveformLoading}
	<div class="waveform-loading" style="width: {trackWidth}px">
		<span class="track-filename">{filename}</span>
	</div>
{:else}
	<div class="waveform-placeholder" style="width: {trackWidth}px">
		<span class="track-filename">{filename}</span>
	</div>
{/if}
```

- [ ] **Step 4: Disable segment selection in collapsed mode**

In `handlePointerDown`, wrap the segment selection logic with a collapsed-mode check. Replace the `if (isAudioTrackPointer(event))` block:

```typescript
if (!uiState.silenceRemoved && isAudioTrackPointer(event)) {
	const clickedSegment = projectState.findSegmentAtTime(pointerTime(event));
	if (clickedSegment) {
		uiState.selectSegment(clickedSegment.id);
		event.preventDefault();
		return;
	}
}
```

- [ ] **Step 5: Add clip styles**

Add to the `<style>` block in Timeline.svelte:

```css
.clips-row {
	display: flex;
	height: var(--track-row-height);
	align-items: stretch;
}

.track-clip {
	height: 100%;
	background: var(--track-green);
	opacity: 0.85;
	display: flex;
	align-items: center;
	padding: 0 0.5rem;
	min-width: 0;
	overflow: hidden;
}

.clip-divider {
	width: 1px;
	background: var(--bg-primary);
	flex-shrink: 0;
}
```

- [ ] **Step 6: Verify visually**

Run `pnpm dev`, load a video, detect silence, toggle the scissors button. Confirm:
- Timeline collapses to show only kept segments
- Waveform shows only voice peaks packed together
- Video track shows individual clips with dividers
- Playhead stays on screen
- Toggling off restores original view

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/Timeline.svelte
git commit -m "feat: render collapsed timeline when silence removed"
```

---

### Task 6: Dual video playback engine

**Files:**
- Modify: `src/lib/components/VideoPreview.svelte`

This is a rewrite of VideoPreview.svelte. The complete new file:

- [ ] **Step 1: Rewrite VideoPreview.svelte**

Replace the entire contents of `src/lib/components/VideoPreview.svelte` with:

```svelte
<script lang="ts">
	import { projectState } from '$lib/stores/project.svelte';
	import { uiState } from '$lib/stores/ui.svelte';
	import {
		editToSource,
		sourceToEdit,
		findEditSegmentAtTime,
		getEditDuration
	} from '$lib/utils/editTimeline';

	let videoA = $state<HTMLVideoElement | null>(null);
	let videoB = $state<HTMLVideoElement | null>(null);
	let playbackFrame = 0;

	let activeKey = $state<'A' | 'B'>('A');
	let currentSegIdx = $state(0);
	let standbyReady = $state(false);
	let prevSilenceRemoved = false;

	let filename = $derived(projectState.project?.sourceFile.split('/').pop() ?? '');
	let mediaSrc = $derived(
		projectState.project?.sourceFile
			? `freecut-media://preview?path=${encodeURIComponent(projectState.project.sourceFile)}`
			: ''
	);
	let editTimeline = $derived(projectState.editTimeline);
	let editDur = $derived(getEditDuration(editTimeline));

	function getActive() {
		return activeKey === 'A' ? videoA : videoB;
	}

	function getStandby() {
		return activeKey === 'A' ? videoB : videoA;
	}

	// --- Normal mode handlers ---

	function handleLoadedMetadata() {
		if (!videoA) return;
		projectState.setDuration(videoA.duration || 0);
		if (!uiState.silenceRemoved) {
			uiState.setPlaybackTime(videoA.currentTime, videoA.duration || 0);
		}
	}

	function handleLoadedData() {
		if (!videoA || uiState.silenceRemoved) return;
		uiState.setPlaybackTime(videoA.currentTime, videoA.duration || 0);
	}

	function handleTimeUpdate() {
		if (!videoA || uiState.silenceRemoved) return;
		uiState.setPlaybackTime(videoA.currentTime, videoA.duration || 0);
	}

	function handlePlay() {
		uiState.setPlaybackState(true);
	}

	function handlePause() {
		if (uiState.silenceRemoved) return;
		uiState.setPlaybackState(false);
	}

	function handleEnded() {
		if (uiState.silenceRemoved) return;
		if (videoA) {
			uiState.setPlaybackTime(videoA.duration || 0, videoA.duration || 0);
		}
		uiState.setPlaybackState(false);
	}

	// --- Normal mode playback clock ---

	function normalClock() {
		if (!videoA || uiState.silenceRemoved) return;
		uiState.setPlaybackTime(videoA.currentTime, videoA.duration || 0);
		playbackFrame = requestAnimationFrame(normalClock);
	}

	// --- Collapsed mode playback clock ---

	function collapsedClock() {
		const active = getActive();
		const standby = getStandby();
		if (!active || !uiState.silenceRemoved || !uiState.isPlaying) return;

		const seg = editTimeline[currentSegIdx];
		if (!seg) {
			active.pause();
			uiState.setPlaybackState(false);
			return;
		}

		const sourceTime = active.currentTime;
		const editTime = sourceToEdit(sourceTime, editTimeline);
		uiState.setPlaybackTime(editTime, editDur);

		const timeToEnd = seg.sourceEnd - sourceTime;
		const nextSeg = editTimeline[currentSegIdx + 1];

		if (nextSeg && timeToEnd < 0.2 && !standbyReady && standby) {
			standby.currentTime = nextSeg.sourceStart;
			standbyReady = true;
		}

		if (sourceTime >= seg.sourceEnd - 0.016) {
			if (nextSeg && standby) {
				void standby.play().catch(() => {});
				active.pause();
				activeKey = activeKey === 'A' ? 'B' : 'A';
				currentSegIdx++;
				standbyReady = false;
			} else {
				active.pause();
				uiState.setPlaybackTime(editDur, editDur);
				uiState.setPlaybackState(false);
				return;
			}
		}

		playbackFrame = requestAnimationFrame(collapsedClock);
	}

	// --- Effects ---

	// Reset on source change
	$effect(() => {
		mediaSrc;
		uiState.resetPlayback();
		activeKey = 'A';
		currentSegIdx = 0;
		standbyReady = false;
		prevSilenceRemoved = false;
	});

	// Load videos
	$effect(() => {
		if (!videoA || !mediaSrc) return;
		videoA.load();
	});

	$effect(() => {
		if (!videoB || !mediaSrc) return;
		videoB.load();
	});

	// Handle silenceRemoved toggle
	$effect(() => {
		const removed = uiState.silenceRemoved;
		if (removed === prevSilenceRemoved) return;
		prevSilenceRemoved = removed;

		if (uiState.isPlaying) {
			videoA?.pause();
			videoB?.pause();
			uiState.setPlaybackState(false);
		}

		if (removed) {
			activeKey = 'A';
			standbyReady = false;
			const sourceTime = videoA?.currentTime ?? 0;
			const editTime = sourceToEdit(sourceTime, editTimeline);
			const found = findEditSegmentAtTime(editTime, editTimeline);
			currentSegIdx = found?.index ?? 0;
			uiState.setPlaybackTime(editTime, editDur);
		} else {
			videoB?.pause();
			activeKey = 'A';
			standbyReady = false;
			const sourceTime = videoA?.currentTime ?? 0;
			uiState.setPlaybackTime(sourceTime, videoA?.duration ?? 0);
		}
	});

	// Seeking
	$effect(() => {
		if (!mediaSrc) return;
		const _id = uiState.seekRequestId;

		if (uiState.silenceRemoved) {
			const editTime = uiState.requestedSeekTime;
			const sourceTime = editToSource(editTime, editTimeline);
			const found = findEditSegmentAtTime(editTime, editTimeline);
			const active = getActive();

			if (found && active) {
				currentSegIdx = found.index;
				standbyReady = false;
				if (Math.abs(active.currentTime - sourceTime) > 0.05) {
					active.currentTime = sourceTime;
				}
			}
		} else {
			if (!videoA) return;
			const duration = videoA.duration || projectState.totalDuration || 0;
			const target = Math.min(uiState.requestedSeekTime, duration || uiState.requestedSeekTime);
			if (Math.abs(videoA.currentTime - target) > 0.05) {
				videoA.currentTime = target;
			}
		}
	});

	// Play/pause
	$effect(() => {
		if (!mediaSrc) return;

		if (uiState.isPlaying) {
			if (uiState.silenceRemoved) {
				const seg = editTimeline[currentSegIdx];
				const active = getActive();
				if (!seg || !active) {
					uiState.setPlaybackState(false);
					return;
				}
				if (active.currentTime < seg.sourceStart || active.currentTime >= seg.sourceEnd) {
					active.currentTime = seg.sourceStart;
				}
				void active.play().catch(() => uiState.setPlaybackState(false));
			} else {
				if (!videoA) return;
				void videoA.play().catch(() => uiState.setPlaybackState(false));
			}
			return;
		}

		videoA?.pause();
		videoB?.pause();
	});

	// Playback clock
	$effect(() => {
		if (!mediaSrc || !uiState.isPlaying) return;

		if (uiState.silenceRemoved) {
			playbackFrame = requestAnimationFrame(collapsedClock);
		} else {
			if (!videoA) return;
			playbackFrame = requestAnimationFrame(normalClock);
		}

		return () => {
			if (playbackFrame) {
				cancelAnimationFrame(playbackFrame);
				playbackFrame = 0;
			}
		};
	});
</script>

<div class="preview">
	<div class="video-container">
		{#if mediaSrc}
			<!-- svelte-ignore a11y_media_has_caption -->
			<video
				bind:this={videoA}
				class="video-player"
				class:video-hidden={uiState.silenceRemoved && activeKey !== 'A'}
				src={mediaSrc}
				preload="auto"
				playsinline
				aria-label="Video preview"
				onloadedmetadata={handleLoadedMetadata}
				onloadeddata={handleLoadedData}
				ontimeupdate={handleTimeUpdate}
				onplay={handlePlay}
				onpause={handlePause}
				onended={handleEnded}
			></video>
			<!-- svelte-ignore a11y_media_has_caption -->
			<video
				bind:this={videoB}
				class="video-player video-standby"
				class:video-hidden={!uiState.silenceRemoved || activeKey !== 'B'}
				src={mediaSrc}
				preload="auto"
				playsinline
				aria-label="Video preview standby"
			></video>
			<div class="video-overlay">
				<p class="filename">{filename}</p>
			</div>
		{:else}
			<div class="placeholder">
				<p class="filename">{filename}</p>
			</div>
		{/if}
	</div>
</div>

<style>
	.preview {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		-webkit-app-region: no-drag;
	}

	.video-container {
		width: 100%;
		max-width: 100%;
		aspect-ratio: 16 / 9;
		max-height: 100%;
		background: #000;
		border-radius: var(--radius-md);
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
	}

	.video-player {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: contain;
		background: #000;
	}

	.video-standby {
		z-index: 0;
	}

	.video-hidden {
		opacity: 0;
		pointer-events: none;
	}

	.video-overlay {
		position: absolute;
		left: 0.75rem;
		bottom: 0.75rem;
		padding: 0.375rem 0.5rem;
		background: rgba(0, 0, 0, 0.55);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: var(--radius-sm);
		pointer-events: none;
		z-index: 2;
	}

	.placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.filename {
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 0.875rem;
	}
</style>
```

- [ ] **Step 2: Verify normal playback still works**

Run `pnpm dev`, load a video. With scissors toggle OFF, verify:
- Play/pause works as before
- Seeking works
- Time updates properly
- No visual glitches (videoB is hidden)

- [ ] **Step 3: Verify collapsed playback**

Toggle scissors ON, press play. Verify:
- Video plays through kept segments
- At segment boundaries, video jumps to next segment without long pause
- Playhead moves along the collapsed timeline
- Timecode shows edit time
- Reaching end of last segment stops playback

- [ ] **Step 4: Verify mode toggle**

While playing in collapsed mode, toggle scissors OFF. Verify:
- Playback pauses
- Timeline restores
- Position reflects source time

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/VideoPreview.svelte
git commit -m "feat: implement dual-video gapless playback"
```

---

### Task 7: StatusBar edit duration

**Files:**
- Modify: `src/lib/components/StatusBar.svelte`

- [ ] **Step 1: Update duration text for collapsed mode**

In `src/lib/components/StatusBar.svelte`, replace the `durationText` derivation:

```typescript
let durationText = $derived.by(() => {
	if (!projectState.hasProject) return '';
	const total = formatDuration(projectState.totalDuration);
	const withoutSilence = formatDuration(projectState.totalDuration - projectState.silenceDuration);
	const cuts = projectState.cutCount;
	if (uiState.silenceRemoved) {
		return `edited ${withoutSilence} – original ${total} – ${cuts} cuts`;
	}
	return `duration ${total} – ${withoutSilence} without silence – ${cuts} cuts`;
});
```

- [ ] **Step 2: Verify visually**

Toggle silence removal on/off and confirm the status bar text updates to show "edited X — original Y — N cuts" vs the original format.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/StatusBar.svelte
git commit -m "feat: show edit duration in status bar"
```
