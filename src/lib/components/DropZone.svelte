<script lang="ts">
	import { projectState } from '$lib/stores/project.svelte';

	let isDragOver = $state(false);

	async function loadFile(path: string) {
		if (!window.electronAPI?.extractWaveform) return;

		const supportsWaveformChunks = typeof window.electronAPI?.onWaveformChunk === 'function';
		const requestId = projectState.beginWaveformLoad(path);
		void projectState.loadProbe(path);

		try {
			const data = await window.electronAPI.extractWaveform(
				supportsWaveformChunks ? { filePath: path, requestId } : path
			);
			projectState.finishWaveformLoad(requestId, path, data);
		} catch (err) {
			console.error('Waveform extraction failed:', err);
			projectState.failWaveformLoad(requestId);
		}
	}

	async function handleBrowse() {
		if (typeof window !== 'undefined' && window.electronAPI) {
			const path = await window.electronAPI.openFile();
			if (path) loadFile(path);
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
			const path = (file as File & { path?: string }).path || file.name;
			loadFile(path);
		}
	}
</script>

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
	<h1>Drop a File to Edit</h1>
	<p class="subtitle">audio or video</p>

	<div class="drop-circle">
		<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
			<line x1="12" y1="5" x2="12" y2="19" />
			<polyline points="19 12 12 19 5 12" />
		</svg>
	</div>

	<p class="browse">Or click to <span class="link">Browse.</span></p>
</div>

<style>
	.drop-zone {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		width: 100%;
		height: 100%;
		cursor: pointer;
		transition: background 0.2s ease;
		-webkit-app-region: no-drag;
	}

	.drop-zone.drag-over {
		background: var(--accent-muted);
	}

	h1 {
		font-size: 2rem;
		font-weight: 400;
		color: var(--text-muted);
		letter-spacing: -0.02em;
	}

	.subtitle {
		color: var(--text-muted);
		font-size: 0.875rem;
		margin-bottom: 1.5rem;
	}

	.drop-circle {
		width: 100px;
		height: 100px;
		border: 2px dashed var(--text-muted);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-muted);
		margin-bottom: 1.5rem;
		transition: border-color 0.2s ease, color 0.2s ease;
	}

	.drop-zone:hover .drop-circle,
	.drop-zone.drag-over .drop-circle {
		border-color: var(--accent);
		color: var(--accent);
	}

	.browse {
		color: var(--text-muted);
		font-size: 0.875rem;
	}

	.link {
		color: var(--text-secondary);
		text-decoration: underline;
		text-underline-offset: 2px;
	}
</style>
