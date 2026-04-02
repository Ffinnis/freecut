<script lang="ts">
	import { projectState } from '$lib/stores/project.svelte';
	import { uiState } from '$lib/stores/ui.svelte';
	import { findEditSegmentAtTime } from '$lib/utils/editTimeline';

	let selectedSegment = $derived(projectState.findSegmentById(uiState.selectedSegmentId));
	let canToggleSelected = $derived(!!selectedSegment);
	let canSplit = $derived.by(() => {
		if (!projectState.hasProject) return false;

		if (uiState.silenceRemoved) {
			return !!findEditSegmentAtTime(uiState.currentTime, projectState.editTimeline);
		}

		return !!projectState.findSegmentAtTime(uiState.currentTime);
	});

	function splitAtPlayhead() {
		if (uiState.silenceRemoved) {
			projectState.splitSegmentAtEditTime(uiState.currentTime);
			return;
		}

		projectState.splitSegmentAtTime(uiState.currentTime);
	}
</script>

<div class="transport">
	<div class="left">
		<button
			class="transport-btn split-btn"
			title="Split at playhead (C)"
			disabled={!canSplit}
			onclick={splitAtPlayhead}
		>
			<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<circle cx="6" cy="6" r="3" />
				<path d="M8.12 8.12L12 12" />
				<path d="M20 4L8.12 15.88" />
				<circle cx="6" cy="18" r="3" />
				<path d="M14.8 14.8L20 20" />
			</svg>
		</button>
		{#if projectState.cutCount > 0}
			<span class="cut-count">{projectState.cutCount} cuts</span>
		{/if}
	</div>

	<div class="center">
		<button
			class="transport-btn nav-btn"
			title="Previous segment (Left arrow)"
			disabled={!projectState.hasProject}
			onclick={() => {
				const prevId = projectState.adjacentSegmentId(uiState.selectedSegmentId, -1);
				const seg = projectState.findSegmentById(prevId);
				if (seg) {
					uiState.selectSegment(seg.id);
					uiState.requestSeek(seg.start, projectState.totalDuration);
				}
			}}
		>
			<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
				<polygon points="23 20 13 12 23 4 23 20" />
				<polygon points="11 20 1 12 11 4 11 20" />
			</svg>
		</button>
		<button
			class="transport-btn play-btn"
			title={uiState.isPlaying ? 'Pause (Space)' : 'Play (Space)'}
			disabled={!projectState.hasProject}
			onclick={() => uiState.togglePlayback()}
		>
			{#if uiState.isPlaying}
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
					<rect x="6" y="4" width="4" height="16" />
					<rect x="14" y="4" width="4" height="16" />
				</svg>
			{:else}
				<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
					<polygon points="6 3 20 12 6 21 6 3" />
				</svg>
			{/if}
		</button>
		<button
			class="transport-btn nav-btn"
			title="Next segment (Right arrow)"
			disabled={!projectState.hasProject}
			onclick={() => {
				const nextId = projectState.adjacentSegmentId(uiState.selectedSegmentId, 1);
				const seg = projectState.findSegmentById(nextId);
				if (seg) {
					uiState.selectSegment(seg.id);
					uiState.requestSeek(seg.start, projectState.totalDuration);
				}
			}}
		>
			<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
				<polygon points="1 4 11 12 1 20 1 4" />
				<polygon points="13 4 23 12 13 20 13 4" />
			</svg>
		</button>
	</div>

	<div class="right">
		<button
			class="transport-btn toggle-btn"
			title="Toggle keep/remove (Delete)"
			disabled={!canToggleSelected}
			onclick={() => projectState.toggleSegmentAction(uiState.selectedSegmentId)}
		>
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<polyline points="3 6 5 6 21 6" />
				<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
			</svg>
		</button>
		<div class="timecode">{uiState.formattedTimecode}</div>
	</div>
</div>

<style>
	.transport {
		grid-area: transport;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 0.75rem;
		background: var(--bg-transport);
		border-top: 1px solid var(--border);
		box-shadow: 0 -1px 4px rgba(0, 0, 0, 0.15);
		position: relative;
		z-index: 2;
	}

	.left, .center, .right {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}

	.left {
		min-width: 100px;
	}

	.right {
		min-width: 100px;
		justify-content: flex-end;
	}

	.transport-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.375rem;
		background: none;
		border: none;
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
		cursor: pointer;
		transition: background 0.1s, color 0.1s;
	}

	.transport-btn:hover {
		background: var(--bg-elevated);
		color: var(--text-primary);
	}

	.transport-btn:disabled {
		cursor: default;
		opacity: 0.35;
	}

	.transport-btn:disabled:hover {
		background: none;
		color: var(--text-secondary);
	}

	.cut-count {
		font-size: 0.6875rem;
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
	}

	.play-btn {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: var(--bg-elevated);
	}

	.play-btn:hover {
		background: var(--bg-surface);
		color: var(--text-primary);
	}

	.nav-btn {
		padding: 0.375rem 0.25rem;
	}

	.toggle-btn:not(:disabled):hover {
		color: var(--accent);
	}

	.timecode {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--text-secondary);
		background: var(--bg-input);
		padding: 0.3rem 0.625rem;
		border-radius: var(--radius-sm);
		letter-spacing: 0.04em;
		font-variant-numeric: tabular-nums;
		border: 1px solid var(--border-subtle);
	}
</style>
