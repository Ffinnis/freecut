<script lang="ts">
	import { updaterState } from '$lib/stores/updater.svelte';

	$effect(() => {
		updaterState.init();
	});
</script>

{#if updaterState.visible}
	<div class="update-bar">
		{#if updaterState.status === 'available'}
			<span class="update-text">Update v{updaterState.availableVersion} available</span>
			<button class="update-btn" onclick={() => updaterState.downloadUpdate()}>Download</button>
			<button class="dismiss-btn" onclick={() => updaterState.dismiss()} aria-label="Dismiss">&times;</button>
		{:else if updaterState.status === 'downloading'}
			<span class="update-text">Downloading update\u2026 {updaterState.downloadPercent}%</span>
			<div class="progress-track">
				<div class="progress-fill" style="width: {updaterState.downloadPercent}%"></div>
			</div>
		{:else if updaterState.status === 'ready'}
			<span class="update-text">Update ready</span>
			<button class="update-btn" onclick={() => updaterState.installUpdate()}>Restart</button>
		{/if}
	</div>
{/if}

<style>
	.update-bar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.375rem 0.75rem;
		background: var(--accent-muted);
		border-bottom: 1px solid var(--border);
		-webkit-app-region: no-drag;
	}

	.update-text {
		font-size: 0.75rem;
		color: var(--text-secondary);
	}

	.update-btn {
		font-size: 0.6875rem;
		padding: 0.2rem 0.5rem;
		border: none;
		border-radius: 4px;
		background: var(--accent);
		color: #fff;
		cursor: pointer;
		transition: background 0.15s;
	}

	.update-btn:hover {
		background: var(--accent-hover);
	}

	.dismiss-btn {
		font-size: 0.875rem;
		line-height: 1;
		padding: 0 0.25rem;
		border: none;
		background: none;
		color: var(--text-muted);
		cursor: pointer;
		margin-left: auto;
	}

	.dismiss-btn:hover {
		color: var(--text-primary);
	}

	.progress-track {
		flex: 1;
		height: 4px;
		background: var(--border);
		border-radius: 2px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: var(--accent);
		border-radius: 2px;
		transition: width 0.3s ease;
	}
</style>
