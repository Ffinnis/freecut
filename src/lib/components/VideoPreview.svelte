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

	// Plain variables — NOT $state — so Svelte effects don't re-trigger on swap
	let activeKey: 'A' | 'B' = 'A';
	let currentSegIdx = 0;
	let standbySeekDone = false;
	let prevSilenceRemoved = false;

	let filename = $derived(projectState.project?.sourceFile.split('/').pop() ?? '');
	let mediaSrc = $derived(
		projectState.project?.sourceFile
			? `freecut-media://preview?path=${encodeURIComponent(projectState.project.sourceFile)}`
			: ''
	);
	let editTimeline = $derived(projectState.editTimeline);
	let editDur = $derived(getEditDuration(editTimeline));

	function getActive(): HTMLVideoElement | null {
		return activeKey === 'A' ? videoA : videoB;
	}

	function getStandby(): HTMLVideoElement | null {
		return activeKey === 'A' ? videoB : videoA;
	}

	function showVideo(key: 'A' | 'B') {
		if (videoA) videoA.style.opacity = key === 'A' ? '1' : '0';
		if (videoB) videoB.style.opacity = key === 'B' ? '1' : '0';
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

	function handleStandbySeeked() {
		standbySeekDone = true;
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
		if (!active || !uiState.silenceRemoved || !uiState.isPlaying) return;

		const seg = editTimeline[currentSegIdx];
		if (!seg) {
			active.pause();
			uiState.setPlaybackTime(editDur, editDur);
			uiState.setPlaybackState(false);
			return;
		}

		const sourceTime = active.currentTime;
		const editTime = sourceToEdit(sourceTime, editTimeline);
		uiState.setPlaybackTime(editTime, editDur);

		const nextSeg = editTimeline[currentSegIdx + 1];
		const standby = getStandby();
		const timeToEnd = seg.sourceEnd - sourceTime;

		// Pre-seek standby 1s before segment end
		if (nextSeg && standby && !standbySeekDone && timeToEnd < 1.0) {
			standby.currentTime = nextSeg.sourceStart;
			// seeked event will set standbySeekDone = true
		}

		// Swap at segment boundary
		if (sourceTime >= seg.sourceEnd - 0.02) {
			if (nextSeg && standby) {
				// Swap: show standby frame immediately, then play
				active.pause();
				activeKey = activeKey === 'A' ? 'B' : 'A';
				showVideo(activeKey);
				currentSegIdx++;
				standbySeekDone = false;
				void standby.play().catch(() => {});
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
		standbySeekDone = false;
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
			standbySeekDone = false;
			showVideo('A');
			const sourceTime = videoA?.currentTime ?? 0;
			const editTime = sourceToEdit(sourceTime, editTimeline);
			const found = findEditSegmentAtTime(editTime, editTimeline);
			currentSegIdx = found?.index ?? 0;
			uiState.setPlaybackTime(editTime, editDur);
		} else {
			videoB?.pause();
			activeKey = 'A';
			standbySeekDone = false;
			showVideo('A');
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
				standbySeekDone = false;
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
			const active = getActive();
			if (uiState.silenceRemoved) {
				const seg = editTimeline[currentSegIdx];
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
				onseeked={handleStandbySeeked}
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
		transition: opacity 0s;
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
