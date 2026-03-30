<script lang="ts">
	import { projectState } from '$lib/stores/project.svelte';
	import { uiState } from '$lib/stores/ui.svelte';

	let duration = $derived(projectState.totalDuration || 30 * 60);

	let ticks = $derived.by(() => {
		const d = duration * uiState.zoomLevel;
		let interval: number;
		if (d < 120) interval = 10;
		else if (d < 600) interval = 30;
		else if (d < 1800) interval = 60;
		else if (d < 7200) interval = 300;
		else interval = 600;

		const result: { time: number; label: string; major: boolean }[] = [];
		for (let t = 0; t <= duration; t += interval) {
			result.push({ time: t, label: formatTick(t), major: true });
			if (interval >= 30) {
				for (let sub = 1; sub < (interval >= 60 ? 2 : 3); sub++) {
					const minor = t + (interval / (interval >= 60 ? 2 : 3)) * sub;
					if (minor < duration) {
						result.push({ time: minor, label: '', major: false });
					}
				}
			}
		}
		return result;
	});

	function formatTick(seconds: number): string {
		if (seconds === 0) return '';
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		const s = seconds % 60;
		if (h > 0) return s > 0 ? `${h}h${String(m).padStart(2, '0')}m` : `${h}h${m > 0 ? String(m).padStart(2, '0') + 'm' : ''}`;
		if (m > 0) return s > 0 ? `${m}m${String(s).padStart(2, '0')}s` : `${m}m`;
		return `${s}s`;
	}

	function pct(time: number): number {
		return (time / duration) * 100;
	}
</script>

<div class="ruler">
	{#each ticks as tick}
		<div
			class="tick"
			class:major={tick.major}
			style="left: {pct(tick.time)}%"
		>
			<div class="tick-line"></div>
			{#if tick.label}
				<span class="tick-label">{tick.label}</span>
			{/if}
		</div>
	{/each}
</div>

<style>
	.ruler {
		position: relative;
		height: 24px;
		background: var(--bg-secondary);
		border-bottom: 1px solid var(--border);
		overflow: hidden;
	}

	.tick {
		position: absolute;
		top: 0;
		height: 100%;
	}

	.tick-line {
		width: 1px;
		background: var(--border);
	}

	.tick.major .tick-line {
		height: 10px;
	}

	.tick:not(.major) .tick-line {
		height: 6px;
	}

	.tick-label {
		position: absolute;
		top: 10px;
		left: 4px;
		font-size: 0.5625rem;
		font-family: var(--font-mono);
		color: var(--text-muted);
		white-space: nowrap;
	}
</style>
