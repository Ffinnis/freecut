<script lang="ts">
	import { projectState } from '$lib/stores/project.svelte';
	import { uiState, computePps, computeContentWidth, timeToPixel, pixelToTime } from '$lib/stores/ui.svelte';
	import TimeRuler from './TimeRuler.svelte';
	import WaveformCanvas from './WaveformCanvas.svelte';

	let filename = $derived(
		projectState.project?.sourceFile.split('/').pop() ?? ''
	);

	let duration = $derived(projectState.totalDuration || 30 * 60);

	let pps = $derived(computePps(uiState.zoomFraction, uiState.viewportWidth, duration));
	let contentWidth = $derived(computeContentWidth(pps, duration, uiState.viewportWidth));
	let trackWidth = $derived(timeToPixel(duration, pps));
	let playheadPx = $derived(timeToPixel(uiState.currentTime, pps));

	let scrollContainer: HTMLDivElement;
	let prevPps = 0;

	$effect(() => {
		if (!scrollContainer) return;
		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				uiState.viewportWidth = entry.contentRect.width;
			}
		});
		observer.observe(scrollContainer);
		return () => observer.disconnect();
	});

	// Zoom-to-center: keep center time stable when zoom changes
	$effect(() => {
		const currentPps = pps;
		if (!scrollContainer || prevPps === 0 || prevPps === currentPps) {
			prevPps = currentPps;
			return;
		}
		const centerTime = pixelToTime(
			scrollContainer.scrollLeft + uiState.viewportWidth / 2,
			prevPps
		);
		scrollContainer.scrollLeft = timeToPixel(centerTime, currentPps) - uiState.viewportWidth / 2;
		prevPps = currentPps;
	});

	function onScroll() {
		if (scrollContainer) {
			uiState.timelineScrollX = scrollContainer.scrollLeft;
		}
	}
</script>

<div class="timeline">
	<!-- Fixed gutter column -->
	<div class="gutter-column">
		<div class="gutter ruler-gutter">
			<span class="gutter-label">sections</span>
		</div>
		{#if projectState.hasProject}
			<div class="gutter track-gutter">
				<button class="gutter-icon" aria-label="Mute">
					<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
						<path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
					</svg>
				</button>
				<button class="gutter-icon" aria-label="Visibility">
					<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
						<circle cx="12" cy="12" r="3" />
					</svg>
				</button>
			</div>
			<div class="gutter track-gutter">
				<button class="gutter-icon" aria-label="Mute">
					<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
						<path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
					</svg>
				</button>
				<button class="gutter-icon" aria-label="Visibility">
					<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
						<circle cx="12" cy="12" r="3" />
					</svg>
				</button>
			</div>
		{:else}
			<div class="gutter empty-gutter"></div>
		{/if}
	</div>

	<!-- Scrollable content area -->
	<div class="scroll-container" bind:this={scrollContainer} onscroll={onScroll}>
		<div class="content-sizer" style="width: {contentWidth}px">
			<div class="ruler-area">
				<TimeRuler {pps} {duration} />
			</div>

			{#if projectState.hasProject}
				<div class="track video-track">
					<div class="track-bar" style="width: {trackWidth}px">
						<span class="track-filename">{filename}</span>
					</div>
				</div>
				<div class="track audio-track">
					{#if projectState.waveform}
						<div class="waveform-container" style="width: {trackWidth}px">
							<WaveformCanvas
								peaks={projectState.waveform.peaks}
								peaksPerSecond={projectState.waveform.peaksPerSecond}
								{pps}
								scrollX={uiState.timelineScrollX}
								viewportWidth={uiState.viewportWidth}
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
				</div>
			{:else}
				<div class="track empty-track"></div>
			{/if}

			<!-- Playhead -->
			{#if projectState.hasProject && playheadPx > 0}
				<div class="playhead" style="left: {playheadPx}px"></div>
			{/if}
		</div>
	</div>
</div>

<style>
	.timeline {
		grid-area: timeline;
		display: grid;
		grid-template-columns: var(--track-gutter-width) 1fr;
		background: var(--bg-primary);
		overflow: hidden;
		position: relative;
	}

	.gutter-column {
		display: flex;
		flex-direction: column;
		border-right: 1px solid var(--border);
		z-index: 2;
	}

	.scroll-container {
		overflow-x: auto;
		overflow-y: hidden;
	}

	.content-sizer {
		min-width: 100%;
		position: relative;
	}

	.gutter {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		background: var(--bg-primary);
		padding: 0.25rem;
	}

	.ruler-gutter {
		height: 24px;
		border-bottom: 1px solid var(--border);
	}

	.gutter-label {
		font-size: 0.5rem;
		color: var(--text-muted);
		writing-mode: vertical-lr;
		text-orientation: mixed;
		transform: rotate(180deg);
		letter-spacing: 0.05em;
	}

	.gutter-icon {
		background: none;
		border: none;
		color: var(--text-muted);
		padding: 0.125rem;
		cursor: pointer;
		border-radius: 2px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.gutter-icon:hover {
		color: var(--text-secondary);
		background: var(--bg-surface);
	}

	.ruler-area {
		border-bottom: 1px solid var(--border);
	}

	.track {
		min-height: 48px;
		position: relative;
		border-bottom: 1px solid var(--border);
	}

	.video-track {
		background: var(--bg-secondary);
	}

	.track-bar {
		height: 100%;
		background: var(--track-green);
		opacity: 0.7;
		display: flex;
		align-items: center;
		padding: 0 0.5rem;
	}

	.track-filename {
		font-size: 0.625rem;
		color: var(--bg-primary);
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.audio-track {
		background: var(--bg-secondary);
	}

	.waveform-placeholder {
		height: 100%;
		background: linear-gradient(
			to right,
			var(--bg-secondary) 0%,
			var(--bg-surface) 20%,
			var(--bg-secondary) 40%,
			var(--bg-surface) 60%,
			var(--bg-secondary) 80%,
			var(--bg-surface) 100%
		);
		display: flex;
		align-items: center;
		padding: 0 0.5rem;
	}

	.waveform-container {
		height: 100%;
		position: relative;
		background: var(--bg-secondary);
		overflow: hidden;
	}

	.waveform-label {
		position: absolute;
		top: 2px;
		left: 8px;
		color: var(--text-muted);
		text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
		pointer-events: none;
	}

	.waveform-loading {
		height: 100%;
		background: var(--bg-secondary);
		display: flex;
		align-items: center;
		padding: 0 0.5rem;
		animation: pulse 1.5s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 0.4; }
		50% { opacity: 0.8; }
	}

	.waveform-loading .track-filename {
		color: var(--text-muted);
	}

	.waveform-placeholder .track-filename {
		color: var(--text-muted);
	}

	.empty-track {
		background: var(--bg-secondary);
		min-height: 48px;
	}

	.empty-gutter {
		min-height: 48px;
	}

	.track-gutter {
		min-height: 48px;
		gap: 0.125rem;
		padding: 0.125rem;
		border-bottom: 1px solid var(--border);
	}

	.playhead {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 2px;
		background: var(--accent);
		pointer-events: none;
		z-index: 10;
	}
</style>
