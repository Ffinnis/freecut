<script lang="ts">
	import { untrack } from 'svelte';
	import { projectState } from '$lib/stores/project.svelte';
	import { uiState } from '$lib/stores/ui.svelte';
	import {
		editToSource,
		sourceToEdit,
		findEditSegmentAtTime,
		getEditDuration
	} from '$lib/utils/editTimeline';

	let videoEl = $state<HTMLVideoElement | null>(null);
	let playbackFrame = 0;
	let currentSegIdx = 0;
	let prevSilenceRemoved = false;

	let filename = $derived(projectState.project?.sourceFile.split('/').pop() ?? '');
	let mediaSrc = $derived(
		projectState.project?.sourceFile
			? `freecut-media://preview?path=${encodeURIComponent(projectState.project.sourceFile)}`
			: ''
	);
	let editTimeline = $derived(projectState.editTimeline);
	let editDur = $derived(getEditDuration(editTimeline));

	// --- Normal mode handlers ---

	function handleLoadedMetadata() {
		if (!videoEl) return;
		projectState.setDuration(videoEl.duration || 0);
		if (!uiState.silenceRemoved) {
			uiState.setPlaybackTime(videoEl.currentTime, videoEl.duration || 0);
		}
	}

	function handleLoadedData() {
		if (!videoEl || uiState.silenceRemoved) return;
		uiState.setPlaybackTime(videoEl.currentTime, videoEl.duration || 0);
	}

	function handleTimeUpdate() {
		if (!videoEl || uiState.silenceRemoved) return;
		uiState.setPlaybackTime(videoEl.currentTime, videoEl.duration || 0);
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
		if (videoEl) {
			uiState.setPlaybackTime(videoEl.duration || 0, videoEl.duration || 0);
		}
		uiState.setPlaybackState(false);
	}

	// --- Normal mode playback clock ---

	function normalClock() {
		if (!videoEl || uiState.silenceRemoved) return;
		uiState.setPlaybackTime(videoEl.currentTime, videoEl.duration || 0);
		playbackFrame = requestAnimationFrame(normalClock);
	}

	// --- Collapsed mode playback clock ---
	// Single video: when it reaches the end of a kept segment, seek to the next one.

	function collapsedClock() {
		if (!videoEl || !uiState.silenceRemoved || !uiState.isPlaying) return;

		const seg = editTimeline[currentSegIdx];
		if (!seg) {
			videoEl.pause();
			uiState.setPlaybackTime(editDur, editDur);
			uiState.setPlaybackState(false);
			return;
		}

		const sourceTime = videoEl.currentTime;
		const editTime = sourceToEdit(sourceTime, editTimeline);
		uiState.setPlaybackTime(editTime, editDur);

		if (sourceTime >= seg.sourceEnd - 0.01) {
			const nextSeg = editTimeline[currentSegIdx + 1];
			if (nextSeg) {
				currentSegIdx++;
				videoEl.currentTime = nextSeg.sourceStart;
			} else {
				videoEl.pause();
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
		currentSegIdx = 0;
		prevSilenceRemoved = false;
	});

	// Load video
	$effect(() => {
		if (!videoEl || !mediaSrc) return;
		videoEl.load();
	});

	// Handle silenceRemoved toggle
	$effect(() => {
		const removed = uiState.silenceRemoved;
		if (removed === prevSilenceRemoved) return;
		prevSilenceRemoved = removed;

		if (uiState.isPlaying) {
			videoEl?.pause();
			uiState.setPlaybackState(false);
		}

		if (removed) {
			const sourceTime = videoEl?.currentTime ?? 0;
			const editTime = sourceToEdit(sourceTime, editTimeline);
			const found = findEditSegmentAtTime(editTime, editTimeline);
			currentSegIdx = found?.index ?? 0;
			uiState.setPlaybackTime(editTime, editDur);
		} else {
			const sourceTime = videoEl?.currentTime ?? 0;
			uiState.setPlaybackTime(sourceTime, videoEl?.duration ?? 0);
		}
	});

	// Seeking
	$effect(() => {
		if (!videoEl || !mediaSrc) return;
		const _id = uiState.seekRequestId;

		if (uiState.silenceRemoved) {
			const editTime = uiState.requestedSeekTime;
			const sourceTime = editToSource(editTime, editTimeline);
			const found = findEditSegmentAtTime(editTime, editTimeline);

			if (found) {
				currentSegIdx = found.index;
				if (Math.abs(videoEl.currentTime - sourceTime) > 0.05) {
					videoEl.currentTime = sourceTime;
				}
			}
		} else {
			const duration = videoEl.duration || projectState.totalDuration || 0;
			const target = Math.min(uiState.requestedSeekTime, duration || uiState.requestedSeekTime);
			if (Math.abs(videoEl.currentTime - target) > 0.05) {
				videoEl.currentTime = target;
			}
		}
	});

	// Play/pause
	$effect(() => {
		if (!videoEl || !mediaSrc) return;

		if (uiState.isPlaying) {
			if (uiState.silenceRemoved) {
				const seg = editTimeline[currentSegIdx];
				if (!seg) {
					uiState.setPlaybackState(false);
					return;
				}
				if (videoEl.currentTime < seg.sourceStart || videoEl.currentTime >= seg.sourceEnd) {
					videoEl.currentTime = seg.sourceStart;
				}
			}
			void videoEl.play().catch(() => uiState.setPlaybackState(false));
			return;
		}

		videoEl.pause();
	});

	// Playback clock
	$effect(() => {
		if (!mediaSrc || !uiState.isPlaying) return;
		if (!videoEl) return;

		if (uiState.silenceRemoved) {
			playbackFrame = requestAnimationFrame(collapsedClock);
		} else {
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
				bind:this={videoEl}
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
