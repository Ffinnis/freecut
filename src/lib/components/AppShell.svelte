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

		if (target.isContentEditable || target.closest('[contenteditable="true"], textarea, select')) {
			return true;
		}

		const input = target.closest('input');
		if (!(input instanceof HTMLInputElement)) return false;

		return !['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit'].includes(input.type);
	}

	function isDeleteKey(event: KeyboardEvent) {
		return (
			event.key === 'Backspace' ||
			event.key === 'Delete' ||
			event.code === 'Backspace' ||
			event.code === 'Delete' ||
			event.keyCode === 8 ||
			event.keyCode === 46
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
			if (event.defaultPrevented || event.repeat || isEditableTarget(event.target)) return;

			if (event.code === 'Space') {
				if (!projectState.hasProject) return;
				event.preventDefault();
				uiState.togglePlayback();
				return;
			}

			if (isDeleteKey(event) && uiState.selectedSegmentId) {
				if (projectState.toggleSilenceSegmentAction(uiState.selectedSegmentId)) {
					event.preventDefault();
					event.stopPropagation();
				}
			}
		};

		window.addEventListener('keydown', handleKeydown, true);
		return () => window.removeEventListener('keydown', handleKeydown, true);
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
