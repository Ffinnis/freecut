<script lang="ts">
	import { projectState } from '$lib/stores/project.svelte';
	import { uiState } from '$lib/stores/ui.svelte';

	let selectedSegment = $derived(projectState.findSegmentById(uiState.selectedSegmentId));
	let canToggleSelected = $derived(!!selectedSegment);
</script>

<div class="transport">
	<div class="left">
		<button class="transport-btn segments-btn">
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
			</svg>
			<span>Segments</span>
			{#if projectState.cutCount > 0}
				<span class="badge">{projectState.cutCount}</span>
			{/if}
		</button>
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
	</div>

	<div class="center">
		<button
			class="transport-btn play-btn"
			aria-label={uiState.isPlaying ? 'Pause' : 'Play'}
			disabled={!projectState.hasProject}
			onclick={() => uiState.togglePlayback()}
		>
			{#if uiState.isPlaying}
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<rect x="6" y="4" width="4" height="16" />
					<rect x="14" y="4" width="4" height="16" />
				</svg>
			{:else}
				<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
					<polygon points="5 3 19 12 5 21 5 3" />
				</svg>
			{/if}
		</button>
		<button class="transport-btn" aria-label="Fast forward">
			<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
				<polygon points="1 4 11 12 1 20 1 4" />
				<polygon points="13 4 23 12 13 20 13 4" />
			</svg>
		</button>
		<button class="transport-btn skip-btn">skip</button>
	</div>

	<div class="right">
		<button
			class="transport-btn"
			aria-label="Delete"
			disabled={!canToggleSelected}
			onclick={() => projectState.toggleSegmentAction(uiState.selectedSegmentId)}
		>
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
		border-bottom: 1px solid var(--border);
	}

	.left, .center, .right {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.transport-btn {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.5rem;
		background: none;
		border: none;
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
		font-size: 0.75rem;
		font-family: var(--font-sans);
		cursor: pointer;
		transition: background 0.1s, color 0.1s;
	}

	.transport-btn:hover {
		background: var(--bg-elevated);
		color: var(--text-primary);
	}

	.transport-btn:disabled {
		cursor: default;
		opacity: 0.45;
	}

	.transport-btn:disabled:hover {
		background: none;
		color: var(--text-secondary);
	}

	.active-toggle {
		background: var(--accent-muted);
		color: var(--accent);
	}

	.active-toggle:hover {
		background: var(--accent);
		color: white;
	}

	.segments-btn {
		background: var(--accent-muted);
		color: var(--accent);
	}

	.segments-btn:hover {
		background: var(--accent);
		color: white;
	}

	.badge {
		padding: 0 0.375rem;
		background: var(--accent);
		color: white;
		border-radius: 9999px;
		font-size: 0.625rem;
		font-weight: 600;
		line-height: 1.4;
	}

	.play-btn {
		width: 36px;
		height: 36px;
		justify-content: center;
		padding: 0;
	}

	.skip-btn {
		font-size: 0.6875rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		padding: 0.25rem 0.5rem;
	}

	.timecode {
		font-family: var(--font-mono);
		font-size: 0.8125rem;
		color: var(--text-primary);
		background: var(--bg-input);
		padding: 0.375rem 0.75rem;
		border-radius: var(--radius-sm);
		letter-spacing: 0.05em;
	}
</style>
