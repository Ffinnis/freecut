<script lang="ts">
	import { projectState } from '$lib/stores/project.svelte';
	import { uiState, computePps, computeContentWidth, timeToPixel, pixelToTime } from '$lib/stores/ui.svelte';
	import { buildCollapsedPeaks } from '$lib/utils/editTimeline';
	import TimeRuler from './TimeRuler.svelte';
	import WaveformCanvas from './WaveformCanvas.svelte';

	const RULER_HEIGHT = 24;
	const TRACK_ROW_HEIGHT = 48;
	const EDGE_HIT_ZONE = 6;

	let filename = $derived(
		projectState.project?.sourceFile.split('/').pop() ?? ''
	);

	let duration = $derived(
		uiState.silenceRemoved && projectState.editDuration > 0
			? projectState.editDuration
			: (projectState.totalDuration || 30 * 60)
	);

	let collapsedPeaks = $derived(
		uiState.silenceRemoved && projectState.waveform
			? buildCollapsedPeaks(
					projectState.waveform.peaks,
					projectState.waveform.peaksPerSecond,
					projectState.editTimeline
				)
			: []
	);
	let trackDividers = $derived.by(() => {
		if (uiState.silenceRemoved) {
			return projectState.editTimeline.slice(1).map((clip) => clip.editStart);
		}

		return projectState.project?.segments.slice(1).map((segment) => segment.start) ?? [];
	});

	let pps = $derived(computePps(uiState.zoomFraction, uiState.viewportWidth, duration));
	let contentWidth = $derived(computeContentWidth(pps, duration, uiState.viewportWidth));
	let trackWidth = $derived(timeToPixel(duration, pps));
	let playheadPx = $derived(timeToPixel(uiState.currentTime, pps));

	let scrollContainer: HTMLDivElement;
	let prevPps = 0;
	let isSeeking = $state(false);
	let activePointerId = $state<number | null>(null);
	let draggingEdge = $state<{ segmentId: string; edge: 'start' | 'end' } | null>(null);
	let hoverEdge = $state(false);
	let dragRafPending = false;

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

	function seekFromPointer(event: PointerEvent) {
		if (!scrollContainer) return;

		const rect = scrollContainer.getBoundingClientRect();
		const localX = scrollContainer.scrollLeft + event.clientX - rect.left;
		const clampedX = Math.min(Math.max(localX, 0), trackWidth);
		const nextTime = pixelToTime(clampedX, pps);
		uiState.requestSeek(nextTime, duration);
	}

	function pointerTime(event: PointerEvent) {
		if (!scrollContainer) return 0;

		const rect = scrollContainer.getBoundingClientRect();
		const localX = scrollContainer.scrollLeft + event.clientX - rect.left;
		const clampedX = Math.min(Math.max(localX, 0), trackWidth);
		return pixelToTime(clampedX, pps);
	}

	function isAudioTrackPointer(event: PointerEvent) {
		if (!scrollContainer) return false;

		const rect = scrollContainer.getBoundingClientRect();
		const localY = event.clientY - rect.top;
		const audioTrackTop = RULER_HEIGHT + TRACK_ROW_HEIGHT;
		const audioTrackBottom = audioTrackTop + TRACK_ROW_HEIGHT;
		return localY >= audioTrackTop && localY <= audioTrackBottom;
	}

	function pointerLocalX(event: PointerEvent): number {
		if (!scrollContainer) return 0;
		const rect = scrollContainer.getBoundingClientRect();
		return scrollContainer.scrollLeft + event.clientX - rect.left;
	}

	function findEdgeAtPointer(event: PointerEvent): { segmentId: string; edge: 'start' | 'end' } | null {
		if (uiState.silenceRemoved || !projectState.project || !isAudioTrackPointer(event)) return null;

		const px = pointerLocalX(event);
		const segments = projectState.project.segments;

		for (let i = 0; i < segments.length; i++) {
			const seg = segments[i];
			const startPx = timeToPixel(seg.start, pps);
			const endPx = timeToPixel(seg.end, pps);

			if (startPx < px - EDGE_HIT_ZONE * 3 && endPx > px + EDGE_HIT_ZONE * 3) continue;

			if (Math.abs(px - endPx) <= EDGE_HIT_ZONE && i < segments.length - 1) {
				return { segmentId: seg.id, edge: 'end' };
			}
			if (Math.abs(px - startPx) <= EDGE_HIT_ZONE && i > 0) {
				return { segmentId: seg.id, edge: 'start' };
			}
		}
		return null;
	}

	function handlePointerDown(event: PointerEvent) {
		if (event.button !== 0 || !projectState.hasProject) return;

		const edge = findEdgeAtPointer(event);
		if (edge) {
			draggingEdge = edge;
			activePointerId = event.pointerId;
			projectState.startDrag();
			uiState.selectSegment(edge.segmentId);
			event.preventDefault();
			return;
		}

		if (!uiState.silenceRemoved && isAudioTrackPointer(event)) {
			const clickedSegment = projectState.findSegmentAtTime(pointerTime(event));
			if (clickedSegment) {
				uiState.selectSegment(clickedSegment.id);
				event.preventDefault();
				return;
			}
		}

		uiState.selectSegment(null);
		isSeeking = true;
		activePointerId = event.pointerId;
		seekFromPointer(event);
		event.preventDefault();
	}

	function handlePointerMove(event: PointerEvent) {
		if (activePointerId !== event.pointerId) return;

		if (draggingEdge) {
			if (dragRafPending) return;
			dragRafPending = true;
			const time = pointerTime(event);
			requestAnimationFrame(() => {
				dragRafPending = false;
				if (draggingEdge) {
					projectState.resizeSegmentEdge(draggingEdge.segmentId, draggingEdge.edge, time);
				}
			});
			return;
		}

		if (isSeeking) {
			seekFromPointer(event);
		}
	}

	function handlePointerHover(event: PointerEvent) {
		if (isSeeking || draggingEdge) return;
		hoverEdge = findEdgeAtPointer(event) !== null;
	}

	function stopInteraction(event: PointerEvent) {
		if (activePointerId !== event.pointerId) return;

		if (draggingEdge) {
			projectState.endDrag();
			draggingEdge = null;
			activePointerId = null;
			return;
		}

		if (isSeeking) {
			isSeeking = false;
			activePointerId = null;
		}
	}

	$effect(() => {
		if (typeof window === 'undefined' || (!isSeeking && !draggingEdge)) return;

		const handleMove = (event: PointerEvent) => handlePointerMove(event);
		const handleStop = (event: PointerEvent) => stopInteraction(event);

		window.addEventListener('pointermove', handleMove);
		window.addEventListener('pointerup', handleStop);
		window.addEventListener('pointercancel', handleStop);

		return () => {
			window.removeEventListener('pointermove', handleMove);
			window.removeEventListener('pointerup', handleStop);
			window.removeEventListener('pointercancel', handleStop);
		};
	});
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
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="content-sizer"
			class:seeking={isSeeking}
			class:edge-hover={hoverEdge}
			class:edge-dragging={draggingEdge !== null}
			style="width: {contentWidth}px"
			onpointerdown={handlePointerDown}
			onpointermove={handlePointerHover}
		>
			<div class="ruler-area">
				<TimeRuler {pps} {duration} />
			</div>

			{#if projectState.hasProject}
				<div class="track video-track">
					<div class="track-bar" style="width: {trackWidth}px">
						<span class="track-filename">{filename}</span>
						{#if trackDividers.length > 0}
							<div class="track-dividers">
								{#each trackDividers as divider}
									<div class="track-divider" style="left: {divider * pps}px"></div>
								{/each}
							</div>
						{/if}
					</div>
				</div>
				<div class="track audio-track">
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
							{#if trackDividers.length > 0}
								<div class="waveform-dividers">
									{#each trackDividers as divider}
										<div class="waveform-divider" style="left: {divider * pps}px"></div>
									{/each}
								</div>
							{/if}
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
		cursor: pointer;
	}

	.content-sizer.seeking {
		cursor: ew-resize;
	}

	.content-sizer.edge-hover {
		cursor: col-resize;
	}

	.content-sizer.edge-dragging {
		cursor: col-resize;
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
		height: var(--track-row-height);
		position: relative;
		border-bottom: 1px solid var(--border);
	}

	.video-track {
		background: var(--bg-secondary);
	}

	.track-dividers {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	.track-divider {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 1px;
		background: var(--bg-primary);
	}

	.waveform-dividers {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	.waveform-divider {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 1px;
		background: var(--bg-primary);
	}

	.track-bar {
		height: var(--track-row-height);
		background: var(--track-green);
		opacity: 0.85;
		display: flex;
		align-items: center;
		padding: 0 0.5rem;
		position: relative;
	}

	.track-filename {
		font-size: 0.625rem;
		color: rgba(255, 255, 255, 0.7);
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
		height: var(--track-row-height);
	}

	.empty-gutter {
		height: var(--track-row-height);
	}

	.track-gutter {
		height: var(--track-row-height);
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
