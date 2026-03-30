<script lang="ts">
	import { projectState } from '$lib/stores/project.svelte';
	import { uiState } from '$lib/stores/ui.svelte';
	import DropZone from './DropZone.svelte';
	import VideoPreview from './VideoPreview.svelte';
	import Sidebar from './Sidebar.svelte';
	import TransportBar from './TransportBar.svelte';
	import Timeline from './Timeline.svelte';
	import StatusBar from './StatusBar.svelte';

	function isEditableTarget(target: EventTarget | null) {
		if (!(target instanceof HTMLElement)) return false;

		return (
			target.isContentEditable ||
			target.closest('input, textarea, select, [contenteditable="true"]') !== null
		);
	}

	$effect(() => {
		if (typeof window === 'undefined' || !window.electronAPI?.onWaveformChunk) return;
		return window.electronAPI.onWaveformChunk((chunk) => {
			projectState.applyWaveformChunk(chunk);
		});
	});

	$effect(() => {
		if (typeof window === 'undefined') return;

		const handleKeydown = (event: KeyboardEvent) => {
			if (event.defaultPrevented || event.repeat || event.code !== 'Space') return;
			if (!projectState.hasProject || isEditableTarget(event.target)) return;

			event.preventDefault();
			uiState.togglePlayback();
		};

		window.addEventListener('keydown', handleKeydown);
		return () => window.removeEventListener('keydown', handleKeydown);
	});
</script>

<div class="app-shell">
	<div class="titlebar-drag"></div>
	<div class="preview-area">
		{#if projectState.hasProject}
			<VideoPreview />
		{:else}
			<DropZone />
		{/if}
	</div>
	<Sidebar />
	<TransportBar />
	<Timeline />
	<StatusBar />
</div>

<style>
	.app-shell {
		display: grid;
		grid-template-areas:
			'preview sidebar'
			'transport transport'
			'timeline timeline'
			'status status';
		grid-template-columns: 1fr var(--sidebar-width);
		grid-template-rows: 1fr var(--transport-height) var(--timeline-min-height) var(--statusbar-height);
		height: 100vh;
		background: var(--bg-primary);
	}

	.titlebar-drag {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		height: var(--titlebar-height);
		-webkit-app-region: drag;
		z-index: 100;
		pointer-events: auto;
	}

	.preview-area {
		grid-area: preview;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-surface);
		padding-top: var(--titlebar-height);
		overflow: hidden;
	}
</style>
