<script lang="ts">
	import { projectState } from '$lib/stores/project.svelte';
	import { uiState } from '$lib/stores/ui.svelte';

	function formatTime(seconds: number): string {
		const m = Math.floor(seconds / 60);
		const s = Math.floor(seconds % 60);
		return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
	}

	function selectSegment(segmentId: string | null, start: number) {
		uiState.selectSegment(segmentId);
		uiState.requestSeek(start, projectState.totalDuration);
	}
</script>

<div class="sections-tab">
	{#if !projectState.hasProject}
		<p class="empty">Load a file to see sections</p>
	{:else if projectState.project!.segments.length === 0}
		<p class="empty">No segments detected yet</p>
	{:else}
		<div class="segment-list">
			{#each projectState.project!.segments as segment}
				<button
					class="segment-row"
					class:selected={uiState.selectedSegmentId === segment.id}
					onclick={() => selectSegment(segment.type === 'silence' ? segment.id : null, segment.start)}
				>
					<span class="type-badge" class:silence={segment.type === 'silence'} class:speech={segment.type === 'speech'}>
						{segment.type === 'silence' ? 'S' : 'V'}
					</span>
					<span class="time">{formatTime(segment.start)} - {formatTime(segment.end)}</span>
					<span class="action" class:remove={segment.action === 'remove'}>
						{segment.action}
					</span>
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.sections-tab {
		padding: 1rem;
	}

	.empty {
		color: var(--text-muted);
		font-size: 0.8125rem;
		text-align: center;
		margin-top: 2rem;
	}

	.segment-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.segment-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.375rem 0.5rem;
		background: none;
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		font-family: var(--font-sans);
		width: 100%;
		text-align: left;
		transition: background 0.1s;
	}

	.segment-row:hover {
		background: var(--bg-surface);
	}

	.segment-row.selected {
		background: rgba(255, 255, 255, 0.08);
		outline: 1px solid rgba(255, 255, 255, 0.24);
	}

	.type-badge {
		width: 20px;
		height: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-sm);
		font-size: 0.625rem;
		font-weight: 600;
	}

	.type-badge.speech {
		background: var(--speech);
		color: var(--success);
	}

	.type-badge.silence {
		background: var(--silence);
		color: var(--accent);
	}

	.time {
		flex: 1;
		font-family: var(--font-mono);
		font-size: 0.6875rem;
		color: var(--text-secondary);
	}

	.action {
		font-size: 0.625rem;
		padding: 0.125rem 0.375rem;
		border-radius: var(--radius-sm);
		color: var(--text-muted);
		background: var(--bg-surface);
	}

	.action.remove {
		color: var(--accent);
		background: var(--accent-muted);
	}
</style>
