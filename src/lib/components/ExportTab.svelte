<script lang="ts">
	import { projectState } from '$lib/stores/project.svelte';
</script>

<div class="export-tab">
	{#if !projectState.hasProject}
		<p class="empty">Load a file to export</p>
	{:else}
		<div class="section">
			<h3>Video / Audio</h3>
			<div class="format-grid">
				<button class="format-btn">MP4</button>
				<button class="format-btn">MOV</button>
				<button class="format-btn">WAV</button>
				<button class="format-btn">MP3</button>
			</div>
		</div>

		<div class="section">
			<h3>Editor Project</h3>
			<div class="format-grid">
				<button class="format-btn">FCP XML</button>
				<button class="format-btn">EDL</button>
				<button class="format-btn">AAF</button>
			</div>
		</div>

		<button class="export-btn" disabled>
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
				<polyline points="7 10 12 15 17 10" />
				<line x1="12" y1="15" x2="12" y2="3" />
			</svg>
			Export
		</button>
	{/if}
</div>

<style>
	.export-tab {
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.empty {
		color: var(--text-muted);
		font-size: 0.8125rem;
		text-align: center;
		margin-top: 2rem;
	}

	.section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	h3 {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.format-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.375rem;
	}

	.format-btn {
		padding: 0.5rem;
		background: var(--bg-surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
		font-size: 0.75rem;
		font-family: var(--font-sans);
		cursor: pointer;
		transition: background 0.15s, border-color 0.15s;
	}

	.format-btn:hover {
		background: var(--bg-elevated);
		border-color: var(--border-hover);
		color: var(--text-primary);
	}

	.export-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.625rem 1rem;
		background: var(--accent);
		border: none;
		border-radius: var(--radius-sm);
		color: white;
		font-size: 0.8125rem;
		font-weight: 600;
		font-family: var(--font-sans);
		cursor: pointer;
		margin-top: auto;
		transition: opacity 0.15s;
	}

	.export-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.export-btn:not(:disabled):hover {
		opacity: 0.9;
	}
</style>
