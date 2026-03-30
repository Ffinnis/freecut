<script lang="ts">
	import type { ElectronAPI } from '$lib/types/ipc';

	let isDragOver = $state(false);
	let filePath = $state<string | null>(null);

	async function handleBrowse() {
		if (typeof window !== 'undefined' && window.electronAPI) {
			const path = await window.electronAPI.openFile();
			if (path) filePath = path;
		}
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		isDragOver = true;
	}

	function handleDragLeave() {
		isDragOver = false;
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragOver = false;

		const files = e.dataTransfer?.files;
		if (files && files.length > 0) {
			const file = files[0];
			filePath = file.path || file.name;
		}
	}
</script>

<main>
	<div
		class="drop-zone"
		class:drag-over={isDragOver}
		role="button"
		tabindex="0"
		ondragover={handleDragOver}
		ondragleave={handleDragLeave}
		ondrop={handleDrop}
		onclick={handleBrowse}
		onkeydown={(e) => e.key === 'Enter' && handleBrowse()}
	>
		<div class="drop-icon">
			<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
				<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
				<polyline points="7 10 12 15 17 10" />
				<line x1="12" y1="15" x2="12" y2="3" />
			</svg>
		</div>
		<h1>Drop a File to Edit</h1>
		<p class="subtitle">audio or video</p>
		<p class="browse">Or click to <span class="link">Browse</span></p>

		{#if filePath}
			<p class="file-path">{filePath}</p>
		{/if}
	</div>
</main>

<style>
	main {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100vh;
		padding: 2rem;
	}

	.drop-zone {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		width: 100%;
		max-width: 500px;
		padding: 4rem 3rem;
		border: 2px dashed var(--border);
		border-radius: var(--radius-lg);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.drop-zone:hover,
	.drop-zone.drag-over {
		border-color: var(--accent);
		background: var(--accent-muted);
	}

	.drop-icon {
		color: var(--text-muted);
		margin-bottom: 0.5rem;
		transition: color 0.2s ease;
	}

	.drop-zone:hover .drop-icon,
	.drop-zone.drag-over .drop-icon {
		color: var(--accent);
	}

	h1 {
		font-size: 1.5rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.subtitle {
		color: var(--text-secondary);
		font-size: 1rem;
	}

	.browse {
		color: var(--text-muted);
		font-size: 0.875rem;
		margin-top: 0.5rem;
	}

	.link {
		color: var(--accent);
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.file-path {
		color: var(--success);
		font-family: var(--font-mono);
		font-size: 0.75rem;
		margin-top: 1rem;
		word-break: break-all;
		text-align: center;
	}
</style>
