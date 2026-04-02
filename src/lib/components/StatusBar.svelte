<script lang="ts">
	import { projectState } from '$lib/stores/project.svelte';
	import { uiState } from '$lib/stores/ui.svelte';

	function formatDuration(seconds: number): string {
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		const s = Math.floor(seconds % 60);
		if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
		return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
	}

	function formatFileSize(bytes: number): string {
		if (bytes <= 0) return '';
		const units = ['B', 'KB', 'MB', 'GB', 'TB'];
		let value = bytes;
		let unitIndex = 0;

		while (value >= 1024 && unitIndex < units.length - 1) {
			value /= 1024;
			unitIndex += 1;
		}

		const digits = value >= 100 || unitIndex === 0 ? 0 : 1;
		return `${value.toFixed(digits)} ${units[unitIndex]}`;
	}

	function formatCodecLabel(): string {
		const metadata = projectState.probeResult;
		if (!metadata) return '';

		const codecs = [metadata.videoCodec, metadata.audioCodec]
			.filter(Boolean)
			.map((codec) => codec.toUpperCase());

		return codecs.join(' / ');
	}

	let mediaText = $derived.by(() => {
		if (!projectState.hasProject) return '';

		const metadata = projectState.probeResult;
		const parts = [formatDuration(metadata?.duration || projectState.totalDuration)];

		if (metadata?.width && metadata?.height) {
			parts.push(`${metadata.width}×${metadata.height}`);
		}

		const codecLabel = formatCodecLabel();
		if (codecLabel) {
			parts.push(codecLabel);
		}

		const fileSize = metadata ? formatFileSize(metadata.fileSize) : '';
		if (fileSize) {
			parts.push(fileSize);
		}

		return parts.join(' · ');
	});

	let durationText = $derived.by(() => {
		if (!projectState.hasProject) return '';
		const total = formatDuration(projectState.totalDuration);
		const withoutSilence = formatDuration(projectState.totalDuration - projectState.silenceDuration);
		const cuts = projectState.cutCount;
		if (uiState.silenceRemoved) {
			return `edited ${withoutSilence} \u2013 original ${total} \u2013 ${cuts} cuts`;
		}
		return `duration ${total} \u2013 ${withoutSilence} without silence \u2013 ${cuts} cuts`;
	});
</script>

<div class="status-bar">
	<div class="left">
		{#if projectState.hasProject}
			<span class="media-text">{mediaText}</span>
		{/if}
	</div>
	<div class="center">
		{#if projectState.hasProject}
			<span class="duration-text">{durationText}</span>
		{/if}
	</div>
	<div class="right">
		<svg class="zoom-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<circle cx="11" cy="11" r="8" />
			<line x1="21" y1="21" x2="16.65" y2="16.65" />
		</svg>
		<input
			type="range"
			class="zoom-slider"
			min="0"
			max="1"
			step="0.005"
			bind:value={uiState.zoomFraction}
		/>
	</div>
</div>

<style>
	.status-bar {
		grid-area: status;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 0.75rem;
		background: var(--bg-primary);
		border-top: 1px solid var(--border);
		height: var(--statusbar-height);
	}

	.left, .center, .right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.left {
		flex: 1;
		min-width: 0;
	}

	.center {
		flex: 1;
		justify-content: center;
		min-width: 0;
	}

	.right {
		min-width: 120px;
		justify-content: flex-end;
	}

	.media-text {
		font-size: 0.625rem;
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.duration-text {
		font-size: 0.625rem;
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.zoom-icon {
		color: var(--text-muted);
		flex-shrink: 0;
	}

	.zoom-slider {
		width: 80px;
		-webkit-appearance: none;
		appearance: none;
		height: 3px;
		background: var(--border);
		border-radius: 2px;
		outline: none;
	}

	.zoom-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--text-secondary);
		cursor: pointer;
	}
</style>
