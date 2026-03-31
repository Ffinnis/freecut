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

	// Plain variables for collapsed mode — completely outside Svelte reactivity
	let activeIs: 'A' | 'B' = 'A';
	let segIdx = 0;
	let pendingSeek: number | null = null; // edit-time to seek to, set by effect, consumed by clock
	let prevSilenceRemoved = false;

	let filename = $derived(projectState.project?.sourceFile.split('/').pop() ?? '');
	let mediaSrc = $derived(
		projectState.project?.sourceFile
			? `freecut-media://preview?path=${encodeURIComponent(projectState.project.sourceFile)}`
			: ''
	);

	function vid(key: 'A' | 'B') {
		return key === 'A' ? videoA : videoB;
	}

	function setVisible(key: 'A' | 'B') {
		if (videoA) videoA.style.opacity = key === 'A' ? '1' : '0';
		if (videoB) videoB.style.opacity = key === 'B' ? '1' : '0';
	}

	// --- Normal mode handlers (only fire when silenceRemoved is OFF) ---

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
		if (!uiState.silenceRemoved) uiState.setPlaybackState(true);
	}

	function handlePause() {
		if (!uiState.silenceRemoved) uiState.setPlaybackState(false);
	}

	function handleEnded() {
		if (uiState.silenceRemoved) return;
		if (videoA) uiState.setPlaybackTime(videoA.duration || 0, videoA.duration || 0);
		uiState.setPlaybackState(false);
	}

	// --- Normal mode clock ---

	function normalClock() {
		if (!videoA || uiState.silenceRemoved) return;
		uiState.setPlaybackTime(videoA.currentTime, videoA.duration || 0);
		playbackFrame = requestAnimationFrame(normalClock);
	}

	// --- Collapsed mode clock (handles ALL collapsed logic) ---

	function collapsedClock() {
		const tl = projectState.editTimeline;
		const dur = getEditDuration(tl);
		const active = vid(activeIs);
		if (!active || !uiState.silenceRemoved || !uiState.isPlaying) return;

		// Handle pending seek from user click
		if (pendingSeek !== null) {
			const editTime = pendingSeek;
			pendingSeek = null;
			const sourceTime = editToSource(editTime, tl);
			const found = findEditSegmentAtTime(editTime, tl);
			if (found) {
				segIdx = found.index;
				const a = vid(activeIs);
				if (a) {
					a.currentTime = sourceTime;
				}
			}
		}

		const seg = tl[segIdx];
		if (!seg) {
			active.pause();
			uiState.setPlaybackTime(dur, dur);
			uiState.setPlaybackState(false);
			return;
		}

		const sourceTime = active.currentTime;
		const editTime = sourceToEdit(sourceTime, tl);
		uiState.setPlaybackTime(editTime, dur);

		// Pre-seek standby
		const standbyKey: 'A' | 'B' = activeIs === 'A' ? 'B' : 'A';
		const standby = vid(standbyKey);
		const nextSeg = tl[segIdx + 1];
		const timeToEnd = seg.sourceEnd - sourceTime;

		if (nextSeg && standby && timeToEnd < 1.0 && timeToEnd > 0.02) {
			const diff = Math.abs(standby.currentTime - nextSeg.sourceStart);
			if (diff > 0.1) {
				standby.currentTime = nextSeg.sourceStart;
			}
		}

		// Swap at segment boundary
		if (sourceTime >= seg.sourceEnd - 0.02) {
			if (nextSeg && standby) {
				active.pause();
				activeIs = standbyKey;
				setVisible(activeIs);
				segIdx++;
				void standby.play().catch(() => {});
			} else {
				active.pause();
				uiState.setPlaybackTime(dur, dur);
				uiState.setPlaybackState(false);
				return;
			}
		}

		playbackFrame = requestAnimationFrame(collapsedClock);
	}

	// ========================================
	// Effects — completely separated by mode
	// ========================================

	// Reset on source change
	$effect(() => {
		mediaSrc;
		uiState.resetPlayback();
		activeIs = 'A';
		segIdx = 0;
		pendingSeek = null;
		prevSilenceRemoved = false;
	});

	// Load videos
	$effect(() => {
		if (videoA && mediaSrc) videoA.load();
	});
	$effect(() => {
		if (videoB && mediaSrc) videoB.load();
	});

	// Handle silenceRemoved toggle
	$effect(() => {
		const removed = uiState.silenceRemoved;
		if (removed === prevSilenceRemoved) return;
		prevSilenceRemoved = removed;

		videoA?.pause();
		videoB?.pause();
		uiState.setPlaybackState(false);

		activeIs = 'A';
		segIdx = 0;
		pendingSeek = null;
		setVisible('A');

		if (removed) {
			const tl = projectState.editTimeline;
			const sourceTime = videoA?.currentTime ?? 0;
			const editTime = sourceToEdit(sourceTime, tl);
			const found = findEditSegmentAtTime(editTime, tl);
			segIdx = found?.index ?? 0;
			uiState.setPlaybackTime(editTime, getEditDuration(tl));
		} else {
			const sourceTime = videoA?.currentTime ?? 0;
			uiState.setPlaybackTime(sourceTime, videoA?.duration ?? 0);
		}
	});

	// --- NORMAL MODE: seeking ---
	$effect(() => {
		if (!mediaSrc || !videoA || uiState.silenceRemoved) return;
		const _id = uiState.seekRequestId;
		const duration = videoA.duration || projectState.totalDuration || 0;
		const target = Math.min(uiState.requestedSeekTime, duration || uiState.requestedSeekTime);
		if (Math.abs(videoA.currentTime - target) > 0.05) {
			videoA.currentTime = target;
		}
	});

	// --- COLLAPSED MODE: seeking (just sets pendingSeek for the clock to consume) ---
	$effect(() => {
		if (!mediaSrc || !uiState.silenceRemoved) return;
		const _id = uiState.seekRequestId;
		pendingSeek = uiState.requestedSeekTime;
		// If not playing, apply immediately
		if (!uiState.isPlaying) {
			const tl = projectState.editTimeline;
			const sourceTime = editToSource(uiState.requestedSeekTime, tl);
			const found = findEditSegmentAtTime(uiState.requestedSeekTime, tl);
			if (found) {
				segIdx = found.index;
				const a = vid(activeIs);
				if (a && Math.abs(a.currentTime - sourceTime) > 0.05) {
					a.currentTime = sourceTime;
				}
			}
			const editTime = uiState.requestedSeekTime;
			uiState.setPlaybackTime(editTime, getEditDuration(tl));
			pendingSeek = null;
		}
	});

	// --- NORMAL MODE: play/pause ---
	$effect(() => {
		if (!mediaSrc || !videoA || uiState.silenceRemoved) return;
		if (uiState.isPlaying) {
			void videoA.play().catch(() => uiState.setPlaybackState(false));
		} else {
			videoA.pause();
		}
	});

	// --- COLLAPSED MODE: play/pause ---
	$effect(() => {
		if (!mediaSrc || !uiState.silenceRemoved) return;
		if (uiState.isPlaying) {
			// Start playback: ensure active is at the right position, then play
			const tl = projectState.editTimeline;
			const seg = tl[segIdx];
			const active = vid(activeIs);
			if (!seg || !active) {
				uiState.setPlaybackState(false);
				return;
			}
			if (active.currentTime < seg.sourceStart || active.currentTime >= seg.sourceEnd) {
				active.currentTime = seg.sourceStart;
			}
			void active.play().catch(() => uiState.setPlaybackState(false));
		} else {
			videoA?.pause();
			videoB?.pause();
		}
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
				class="video-player video-b"
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

	.video-b {
		opacity: 0;
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
