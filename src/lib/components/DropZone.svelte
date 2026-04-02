<script lang="ts">
	import { projectState } from '$lib/stores/project.svelte';

	let isDragOver = $state(false);

	async function handleBrowse() {
		await projectState.browseForSourceFile();
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
			void projectState.loadSourceFile(path);
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
	<div class="background-art">
		<svg class="waveform-art" viewBox="0 0 200 40" preserveAspectRatio="none">
			{#each Array(100) as _, i}
				{@const h = Math.sin(i * 0.15) * 12 + Math.sin(i * 0.08 + 1) * 6 + Math.random() * 2}
				<rect
					x={i * 2}
					y={20 - Math.abs(h) / 2}
					width="1.2"
					height={Math.abs(h)}
					rx="0.6"
					fill="currentColor"
				/>
			{/each}
		</svg>
	</div>

	<div class="content">
		<div class="icon-ring">
			<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
				<line x1="12" y1="5" x2="12" y2="19" />
				<polyline points="19 12 12 19 5 12" />
			</svg>
		</div>

		<h1>Drop audio or video to edit</h1>

		<p class="browse-hint">or click anywhere to <span class="link">browse</span></p>

		<p class="formats">MP4, MOV, MKV, WAV, MP3</p>
	</div>
</div>

<style>
	.drop-zone {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		cursor: pointer;
		-webkit-app-region: no-drag;
		overflow: hidden;
	}

	.drop-zone::before {
		content: '';
		position: absolute;
		inset: 0;
		background: radial-gradient(ellipse 60% 50% at 50% 55%, var(--accent-subtle) 0%, transparent 70%);
		opacity: 0;
		transition: opacity 0.4s ease;
		pointer-events: none;
	}

	.drop-zone:hover::before {
		opacity: 1;
	}

	.drop-zone.drag-over::before {
		opacity: 1;
		background: radial-gradient(ellipse 70% 60% at 50% 55%, var(--accent-muted) 0%, transparent 70%);
	}

	.background-art {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
	}

	.waveform-art {
		width: 80%;
		max-width: 700px;
		height: 120px;
		color: var(--border);
		opacity: 0.4;
		transition: opacity 0.3s ease, color 0.3s ease;
	}

	.drop-zone:hover .waveform-art {
		opacity: 0.5;
		color: var(--text-muted);
	}

	.drop-zone.drag-over .waveform-art {
		opacity: 0.6;
		color: var(--accent);
	}

	.content {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		z-index: 1;
	}

	.icon-ring {
		width: 72px;
		height: 72px;
		border: 1.5px solid var(--border-hover);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-muted);
		transition: border-color 0.3s ease, color 0.3s ease, transform 0.3s ease;
	}

	.drop-zone:hover .icon-ring {
		border-color: var(--accent);
		color: var(--accent);
		transform: translateY(2px);
	}

	.drop-zone.drag-over .icon-ring {
		border-color: var(--accent);
		color: var(--accent);
		transform: translateY(4px);
	}

	h1 {
		font-size: 1.375rem;
		font-weight: 500;
		color: var(--text-secondary);
		letter-spacing: -0.02em;
		transition: color 0.3s ease;
	}

	.drop-zone:hover h1 {
		color: var(--text-primary);
	}

	.browse-hint {
		color: var(--text-muted);
		font-size: 0.8125rem;
	}

	.link {
		color: var(--text-secondary);
		text-decoration: underline;
		text-underline-offset: 3px;
		text-decoration-color: var(--border-hover);
		transition: color 0.2s, text-decoration-color 0.2s;
	}

	.drop-zone:hover .link {
		color: var(--accent);
		text-decoration-color: var(--accent);
	}

	.formats {
		font-size: 0.6875rem;
		color: var(--text-muted);
		letter-spacing: 0.05em;
		margin-top: 0.5rem;
		opacity: 0.6;
	}
</style>
