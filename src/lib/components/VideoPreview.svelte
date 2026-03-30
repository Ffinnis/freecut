<script lang="ts">
	import { projectState } from '$lib/stores/project.svelte';

	let filename = $derived(
		projectState.project?.sourceFile.split('/').pop() ?? ''
	);
</script>

<div class="preview">
	<div class="video-container">
		<div class="placeholder">
			<p class="filename">{filename}</p>
		</div>
	</div>
</div>

<style>
	.preview {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		-webkit-app-region: no-drag;
	}

	.video-container {
		width: 100%;
		max-width: 100%;
		aspect-ratio: 16 / 9;
		max-height: 100%;
		background: #000;
		border-radius: var(--radius-md);
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.filename {
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 0.875rem;
	}
</style>
