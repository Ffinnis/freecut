<script lang="ts">
	import { projectState } from '$lib/stores/project.svelte';
	import { uiState } from '$lib/stores/ui.svelte';
	import DropZone from './DropZone.svelte';
	import VideoPreview from './VideoPreview.svelte';
	import Sidebar from './Sidebar.svelte';
	import TransportBar from './TransportBar.svelte';
	import Timeline from './Timeline.svelte';
	import StatusBar from './StatusBar.svelte';
	import UpdateNotification from './UpdateNotification.svelte';

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
		if (typeof window === 'undefined' || !window.electronAPI?.onFileOpened) return;
		return window.electronAPI.onFileOpened((filePath) => {
			void projectState.loadSourceFile(filePath);
		});
	});

	$effect(() => {
		if (typeof window === 'undefined') return;

		const isMac = navigator.platform.startsWith('Mac');

		const handleKeydown = (event: KeyboardEvent) => {
			if (event.defaultPrevented || event.repeat || isEditableTarget(event.target)) return;

			const mod = isMac ? event.metaKey : event.ctrlKey;

			if (mod && event.key === 'z' && !event.shiftKey) {
				event.preventDefault();
				projectState.applyUndo();
				return;
			}

			if (mod && event.key === 'z' && event.shiftKey) {
				event.preventDefault();
				projectState.applyRedo();
				return;
			}

			if (event.code === 'Space') {
				if (!projectState.hasProject) return;
				event.preventDefault();
				uiState.togglePlayback();
				return;
			}

			if (isDeleteKey(event) && uiState.selectedSegmentId) {
				if (projectState.toggleSegmentAction(uiState.selectedSegmentId)) {
					event.preventDefault();
					event.stopPropagation();
				}
				return;
			}

			if (mod && event.key === 'e') {
				event.preventDefault();
				uiState.activeTab = 'export';
				return;
			}

			if (!projectState.hasProject) return;

			if (event.key === 'ArrowRight') {
				event.preventDefault();
				const currentId = uiState.selectedSegmentId;
				if (currentId) {
					const nextId = projectState.adjacentSegmentId(currentId, 1);
					const seg = projectState.findSegmentById(nextId);
					if (seg) {
						uiState.selectSegment(seg.id);
						uiState.requestSeek(seg.start, projectState.totalDuration);
					}
				} else {
					const seg = projectState.findSegmentAtTime(uiState.currentTime);
					if (seg) uiState.selectSegment(seg.id);
				}
				return;
			}

			if (event.key === 'ArrowLeft') {
				event.preventDefault();
				const currentId = uiState.selectedSegmentId;
				if (currentId) {
					const prevId = projectState.adjacentSegmentId(currentId, -1);
					const seg = projectState.findSegmentById(prevId);
					if (seg) {
						uiState.selectSegment(seg.id);
						uiState.requestSeek(seg.start, projectState.totalDuration);
					}
				} else {
					const seg = projectState.findSegmentAtTime(uiState.currentTime);
					if (seg) uiState.selectSegment(seg.id);
				}
				return;
			}

			if (event.key === 'k' || event.key === 'K') {
				event.preventDefault();
				uiState.togglePlayback();
				return;
			}

			if (event.key === 'l' || event.key === 'L') {
				event.preventDefault();
				if (!uiState.isPlaying) {
					uiState.setPlaybackRate(1);
					uiState.setPlaybackState(true);
				} else {
					const next = Math.min(uiState.playbackRate * 2, 8);
					uiState.setPlaybackRate(next);
				}
				return;
			}

			if (event.key === 'j' || event.key === 'J') {
				event.preventDefault();
				if (uiState.isPlaying && uiState.playbackRate > 1) {
					uiState.setPlaybackRate(uiState.playbackRate / 2);
				} else {
					const t = Math.max(uiState.currentTime - 0.5, 0);
					uiState.requestSeek(t, projectState.totalDuration);
				}
				return;
			}
		};

		window.addEventListener('keydown', handleKeydown, true);
		return () => window.removeEventListener('keydown', handleKeydown, true);
	});

</script>

{#if projectState.hasProject}
	<div class="app-shell has-project">
		<UpdateNotification />
		<div class="titlebar-drag"></div>
		<div class="preview-area">
			<VideoPreview />
		</div>
		<Sidebar />
		<TransportBar />
		<Timeline />
		<StatusBar />
	</div>
{:else}
	<div class="app-shell empty">
		<UpdateNotification />
		<div class="titlebar-drag"></div>
		<DropZone />
	</div>
{/if}

<style>
	.app-shell {
		height: 100vh;
		background: var(--bg-primary);
	}

	.app-shell.has-project {
		display: grid;
		grid-template-areas:
			'preview sidebar'
			'transport transport'
			'timeline timeline'
			'status status';
		grid-template-columns: 1fr var(--sidebar-width);
		grid-template-rows: 1fr var(--transport-height) var(--timeline-min-height) var(--statusbar-height);
	}

	.app-shell.empty {
		display: flex;
		align-items: center;
		justify-content: center;
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
