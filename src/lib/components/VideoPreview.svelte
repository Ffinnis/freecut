<script lang="ts">
	import { projectState } from '$lib/stores/project.svelte';
	import { uiState } from '$lib/stores/ui.svelte';

	let videoElement = $state<HTMLVideoElement | null>(null);
	let playbackFrame = 0;

	let filename = $derived(
		projectState.project?.sourceFile.split('/').pop() ?? ''
	);
	let mediaSrc = $derived(
		projectState.project?.sourceFile ? toMediaUrl(projectState.project.sourceFile) : ''
	);

	function toMediaUrl(path: string) {
		return `freecut-media://preview?path=${encodeURIComponent(path)}`;
	}

	function handleLoadedMetadata() {
		if (!videoElement) return;
		projectState.setDuration(videoElement.duration || 0);
		uiState.setPlaybackTime(videoElement.currentTime, videoElement.duration || 0);
	}

	function handleLoadedData() {
		if (!videoElement) return;
		uiState.setPlaybackTime(videoElement.currentTime, videoElement.duration || 0);
	}

	function handleTimeUpdate() {
		if (!videoElement) return;
		uiState.setPlaybackTime(videoElement.currentTime, videoElement.duration || 0);
	}

	function handlePlay() {
		uiState.setPlaybackState(true);
	}

	function handlePause() {
		uiState.setPlaybackState(false);
	}

	function handleEnded() {
		if (videoElement) {
			uiState.setPlaybackTime(videoElement.duration || 0, videoElement.duration || 0);
		}
		uiState.setPlaybackState(false);
	}

	function startPlaybackClock() {
		if (!videoElement) return;
		uiState.setPlaybackTime(videoElement.currentTime, videoElement.duration || 0);
		playbackFrame = requestAnimationFrame(startPlaybackClock);
	}

	$effect(() => {
		mediaSrc;
		uiState.resetPlayback();
	});

	$effect(() => {
		if (!videoElement || !mediaSrc) return;

		videoElement.load();
	});

	$effect(() => {
		if (!videoElement || !mediaSrc) return;

		const seekRequestId = uiState.seekRequestId;
		const duration = videoElement.duration || projectState.totalDuration || 0;
		const targetTime = Math.min(uiState.requestedSeekTime, duration || uiState.requestedSeekTime);

		seekRequestId;
		if (Math.abs(videoElement.currentTime - targetTime) > 0.05) {
			videoElement.currentTime = targetTime;
		}
	});

	$effect(() => {
		if (!videoElement || !mediaSrc) return;

		if (uiState.isPlaying) {
			void videoElement.play().catch(() => {
				uiState.setPlaybackState(false);
			});
			return;
		}

		videoElement.pause();
	});

	$effect(() => {
		if (!videoElement || !mediaSrc || !uiState.isPlaying) return;

		playbackFrame = requestAnimationFrame(startPlaybackClock);
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
				bind:this={videoElement}
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
	}

	.video-player {
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
