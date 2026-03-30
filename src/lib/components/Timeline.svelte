<script lang="ts">
	import { projectState } from '$lib/stores/project.svelte';
	import { uiState } from '$lib/stores/ui.svelte';
	import TimeRuler from './TimeRuler.svelte';

	let filename = $derived(
		projectState.project?.sourceFile.split('/').pop() ?? ''
	);

	let playheadPct = $derived.by(() => {
		const dur = projectState.totalDuration;
		if (dur === 0) return 0;
		return (uiState.currentTime / dur) * 100;
	});
</script>

<div class="timeline">
	<div class="gutter ruler-gutter">
		<span class="gutter-label">sections</span>
	</div>
	<div class="ruler-area">
		<TimeRuler />
	</div>

	{#if projectState.hasProject}
		<!-- Video track -->
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
		<div class="track video-track">
			<div class="track-bar">
				<span class="track-filename">{filename}</span>
			</div>
		</div>

		<!-- Audio track -->
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
		<div class="track audio-track">
			<div class="waveform-placeholder">
				<span class="track-filename">{filename}</span>
			</div>
		</div>
	{:else}
		<div class="gutter empty-gutter"></div>
		<div class="track empty-track"></div>
	{/if}

	<!-- Playhead -->
	{#if projectState.hasProject && playheadPct > 0}
		<div class="playhead" style="left: calc(var(--track-gutter-width) + {playheadPct}% * (100% - var(--track-gutter-width)) / 100)"></div>
	{/if}
</div>

<style>
	.timeline {
		grid-area: timeline;
		display: grid;
		grid-template-columns: var(--track-gutter-width) 1fr;
		grid-auto-rows: auto;
		background: var(--bg-primary);
		overflow-y: auto;
		overflow-x: hidden;
		position: relative;
	}

	.gutter {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		background: var(--bg-primary);
		border-right: 1px solid var(--border);
		padding: 0.25rem;
	}

	.ruler-gutter {
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

	.waveform-placeholder .track-filename {
		color: var(--text-muted);
	}

	.empty-track {
		background: var(--bg-secondary);
	}

	.empty-gutter {
		min-height: 48px;
	}

	.track-gutter {
		gap: 0.125rem;
		padding: 0.125rem;
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
