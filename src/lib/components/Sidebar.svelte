<script lang="ts">
	import { uiState } from '$lib/stores/ui.svelte';
	import SilenceTab from './SilenceTab.svelte';
	import SectionsTab from './SectionsTab.svelte';
	import ExportTab from './ExportTab.svelte';

	const tabs = [
		{ id: 'silence' as const, label: 'Silence' },
		{ id: 'sections' as const, label: 'Sections' },
		{ id: 'export' as const, label: 'Export' }
	];
</script>

<aside class="sidebar">
	<div class="tab-bar">
		{#each tabs as tab}
			<button
				class="tab"
				class:active={uiState.activeTab === tab.id}
				onclick={() => uiState.activeTab = tab.id}
			>
				{#if tab.id === 'silence'}
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="6" cy="6" r="3" />
						<path d="M8.12 8.12L12 12" />
						<path d="M20 4L8.12 15.88" />
						<circle cx="6" cy="18" r="3" />
						<path d="M14.8 14.8L20 20" />
					</svg>
				{:else if tab.id === 'sections'}
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<line x1="8" y1="6" x2="21" y2="6" />
						<line x1="8" y1="12" x2="21" y2="12" />
						<line x1="8" y1="18" x2="21" y2="18" />
						<line x1="3" y1="6" x2="3.01" y2="6" />
						<line x1="3" y1="12" x2="3.01" y2="12" />
						<line x1="3" y1="18" x2="3.01" y2="18" />
					</svg>
				{:else}
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
						<polyline points="7 10 12 15 17 10" />
						<line x1="12" y1="15" x2="12" y2="3" />
					</svg>
				{/if}
				<span>{tab.label}</span>
			</button>
		{/each}
	</div>

	<div class="tab-content">
		{#if uiState.activeTab === 'silence'}
			<SilenceTab />
		{:else if uiState.activeTab === 'sections'}
			<SectionsTab />
		{:else}
			<ExportTab />
		{/if}
	</div>
</aside>

<style>
	.sidebar {
		grid-area: sidebar;
		background: var(--bg-elevated);
		border-left: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.tab-bar {
		display: flex;
		gap: 1px;
		padding: 0 1px;
		background: var(--border-subtle);
		flex-shrink: 0;
		position: relative;
		z-index: 101;
		-webkit-app-region: no-drag;
	}

	.tab {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		padding: 0.75rem 0.5rem;
		background: var(--bg-elevated);
		border: none;
		border-bottom: 2px solid transparent;
		color: var(--text-muted);
		font-size: 0.6875rem;
		font-weight: 500;
		font-family: var(--font-sans);
		cursor: pointer;
		transition: color 0.15s, border-color 0.15s, background 0.15s;
		min-width: 0;
		letter-spacing: 0.01em;
	}

	.tab :global(svg) {
		pointer-events: none;
		flex-shrink: 0;
	}

	.tab:hover {
		color: var(--text-secondary);
		background: var(--bg-surface);
	}

	.tab.active {
		color: var(--text-primary);
		border-bottom-color: var(--accent);
		background: var(--bg-surface);
	}

	.tab-content {
		flex: 1;
		overflow-y: auto;
	}
</style>
