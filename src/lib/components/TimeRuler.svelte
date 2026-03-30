<script lang="ts">
	import { uiState } from '$lib/stores/ui.svelte';

	let { pps, duration }: { pps: number; duration: number } = $props();

	const NICE_INTERVALS = [
		0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30,
		60, 120, 300, 600, 900, 1800, 3600
	];

	function pickInterval(pps: number): number {
		const target = 100 / pps;
		return NICE_INTERVALS.find((n) => n >= target) ?? NICE_INTERVALS[NICE_INTERVALS.length - 1];
	}

	function getSubdivisions(interval: number): number {
		if (interval <= 0.25) return 2;
		if (interval <= 1) return 5;
		if (interval === 2) return 4;
		if (interval === 5) return 5;
		if (interval === 10) return 5;
		if (interval === 15) return 3;
		if (interval === 30) return 6;
		if (interval === 60) return 6;
		if (interval === 120) return 4;
		if (interval === 300) return 5;
		if (interval === 600) return 6;
		if (interval === 900) return 3;
		if (interval === 1800) return 6;
		if (interval === 3600) return 6;
		return 4;
	}

	let rulerTimeSpan = $derived(Math.max(duration, uiState.viewportWidth / pps));

	let ticks = $derived.by(() => {
		const interval = pickInterval(pps);
		const subdivisions = getSubdivisions(interval);
		const subInterval = interval / subdivisions;

		// Viewport culling
		const scrollLeft = uiState.timelineScrollX;
		const vw = uiState.viewportWidth;
		const visibleStartTime = Math.max(0, (scrollLeft - 200) / pps);
		const visibleEndTime = Math.min(rulerTimeSpan, (scrollLeft + vw + 200) / pps);

		const startTick = Math.floor(visibleStartTime / subInterval) * subInterval;

		const result: { time: number; px: number; label: string; major: boolean }[] = [];
		for (let t = startTick; t <= visibleEndTime; t += subInterval) {
			const rounded = Math.round(t * 1000) / 1000;
			const isMajor = Math.abs(rounded % interval) < 0.001 || Math.abs(rounded % interval - interval) < 0.001;
			result.push({
				time: rounded,
				px: rounded * pps,
				label: isMajor ? formatTick(rounded) : '',
				major: isMajor
			});
		}
		return result;
	});

	function formatTick(seconds: number): string {
		if (seconds === 0) return '';
		if (seconds < 1) return `${seconds}s`;
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		const s = seconds % 60;
		if (h > 0) {
			if (m === 0 && s === 0) return `${h}h`;
			if (s === 0) return `${h}h${String(m).padStart(2, '0')}m`;
			return `${h}h${String(m).padStart(2, '0')}m`;
		}
		if (m > 0) {
			if (s === 0) return `${m}m`;
			return `${m}m${String(s).padStart(2, '0')}s`;
		}
		if (Number.isInteger(s)) return `${s}s`;
		return `${s.toFixed(1)}s`;
	}
</script>

<div class="ruler">
	{#each ticks as tick}
		<div
			class="tick"
			class:major={tick.major}
			style="left: {tick.px}px"
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
