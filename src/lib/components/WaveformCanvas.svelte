<script lang="ts">
	import type { Segment } from '$lib/types/project';

	interface Props {
		peaks: number[];
		peaksPerSecond: number;
		pps: number;
		scrollX: number;
		viewportWidth: number;
		segments?: Segment[];
		selectedSegmentId?: string | null;
		thresholdValue?: number;
		height?: number;
	}

	let {
		peaks,
		peaksPerSecond,
		pps,
		scrollX,
		viewportWidth,
		segments = [],
		selectedSegmentId = null,
		thresholdValue = 0,
		height = 48
	}: Props = $props();

	let canvas: HTMLCanvasElement;
	let cachedSource: number[] | null = null;
	let peakLevels: Float32Array[] = [];
	let levelSizes: number[] = [];
	let rafId = 0;

	function buildPeakLevels(source: number[]) {
		const levels: Float32Array[] = [];
		const sizes: number[] = [];

		let current = Float32Array.from(source);
		let groupSize = 1;

		levels.push(current);
		sizes.push(groupSize);

		while (current.length > 1) {
			const next = new Float32Array(Math.ceil(current.length / 2));

			for (let i = 0; i < next.length; i++) {
				const left = current[i * 2] ?? 0;
				const right = current[i * 2 + 1] ?? 0;
				next[i] = Math.max(left, right);
			}

			current = next;
			groupSize *= 2;
			levels.push(current);
			sizes.push(groupSize);
		}

		peakLevels = levels;
		levelSizes = sizes;
	}

	function ensurePeakLevels(source: number[]) {
		if (source === cachedSource) return;
		cachedSource = source;

		if (source.length === 0) {
			peakLevels = [];
			levelSizes = [];
			return;
		}

		buildPeakLevels(source);
	}

	function getLevelIndex(peaksPerPixel: number): number {
		let index = 0;

		while (index + 1 < levelSizes.length && levelSizes[index + 1] <= peaksPerPixel) {
			index++;
		}

		return index;
	}

	function drawThresholdBand(ctx: CanvasRenderingContext2D, width: number, centerY: number) {
		if (thresholdValue <= 0) return;

		const bandHeight = Math.min(centerY, thresholdValue * centerY);
		if (bandHeight <= 0) return;

		ctx.fillStyle = 'rgba(251, 191, 36, 0.14)';
		ctx.fillRect(0, centerY - bandHeight, width, bandHeight * 2);

		ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(0, centerY - bandHeight);
		ctx.lineTo(width, centerY - bandHeight);
		ctx.moveTo(0, centerY + bandHeight);
		ctx.lineTo(width, centerY + bandHeight);
		ctx.stroke();
	}

	function drawSilenceSegments(
		ctx: CanvasRenderingContext2D,
		width: number,
		height: number,
		startTime: number,
		endTime: number
	) {
		for (const segment of segments) {
			if (segment.type !== 'silence') continue;
			if (segment.end < startTime) continue;
			if (segment.start > endTime) break;

			const startX = Math.max(0, (segment.start - startTime) * pps);
			const endX = Math.min(width, Math.max(startX + 1, (segment.end - startTime) * pps));
			const segmentWidth = Math.max(1, endX - startX);
			const isSelected = segment.id === selectedSegmentId;

			if (segment.action === 'remove') {
				ctx.fillStyle = isSelected ? 'rgba(233, 69, 96, 0.46)' : 'rgba(233, 69, 96, 0.32)';
				ctx.fillRect(startX, 0, segmentWidth, height);
			}

			if (segment.action === 'keep' || isSelected) {
				ctx.strokeStyle = isSelected ? 'rgba(255, 255, 255, 0.92)' : 'rgba(255, 255, 255, 0.65)';
				ctx.lineWidth = isSelected ? 1.5 : 1;
				ctx.strokeRect(
					startX + 0.5,
					0.5,
					Math.max(0, segmentWidth - 1),
					Math.max(0, height - 1)
				);
			}
		}
	}

	function drawWaveform() {
		if (!canvas || pps <= 0 || viewportWidth <= 0) return;

		ensurePeakLevels(peaks);

		const dpr = window.devicePixelRatio || 1;
		const w = Math.max(1, Math.floor(viewportWidth));
		const h = Math.max(1, Math.floor(height));

		canvas.width = Math.max(1, Math.round(w * dpr));
		canvas.height = Math.max(1, Math.round(h * dpr));
		canvas.style.width = `${w}px`;
		canvas.style.height = `${h}px`;

		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, w, h);

		const startTime = scrollX / pps;
		const endTime = (scrollX + w) / pps;
		const centerY = h / 2;

		drawThresholdBand(ctx, w, centerY);
		drawSilenceSegments(ctx, w, h, startTime, endTime);

		if (peakLevels.length === 0) return;

		const basePeaks = peakLevels[0];
		const startPeak = Math.max(0, Math.floor(startTime * peaksPerSecond));
		const endPeak = Math.min(basePeaks.length - 1, Math.ceil(endTime * peaksPerSecond));

		if (startPeak > endPeak) return;

		const pixelsPerPeak = pps / peaksPerSecond;

		ctx.fillStyle = 'rgba(74, 222, 128, 0.65)';

		if (pixelsPerPeak >= 1) {
			const barWidth = Math.max(1, pixelsPerPeak - 0.5);

			for (let i = startPeak; i <= endPeak; i++) {
				const amplitude = basePeaks[i];
				if (amplitude <= 0) continue;

				const peakTime = i / peaksPerSecond;
				const x = (peakTime - startTime) * pps;
				const barHeight = Math.max(1, amplitude * centerY);

				ctx.fillRect(x, centerY - barHeight, barWidth, barHeight * 2);
			}

			return;
		}

		const peaksPerPixel = peaksPerSecond / pps;
		const levelIndex = getLevelIndex(peaksPerPixel);
		const level = peakLevels[levelIndex];
		const groupSize = levelSizes[levelIndex];
		const levelStart = Math.max(0, Math.floor(startPeak / groupSize));
		const levelEnd = Math.min(level.length - 1, Math.ceil(endPeak / groupSize));

		for (let px = 0; px < w; px++) {
			const colStartPeak = startPeak + px * peaksPerPixel;
			const colEndPeak = startPeak + (px + 1) * peaksPerPixel;
			const colStart = Math.max(levelStart, Math.floor(colStartPeak / groupSize));
			const colEnd = Math.min(levelEnd, Math.ceil(colEndPeak / groupSize));

			let maxVal = 0;
			for (let i = colStart; i <= colEnd; i++) {
				if (level[i] > maxVal) maxVal = level[i];
			}

			if (maxVal <= 0) continue;

			const barHeight = Math.max(1, maxVal * centerY);
			ctx.fillRect(px, centerY - barHeight, 1, barHeight * 2);
		}
	}

	$effect(() => {
		peaks;
		peaksPerSecond;
		pps;
		scrollX;
		viewportWidth;
		segments;
		selectedSegmentId;
		thresholdValue;
		height;

		if (rafId) cancelAnimationFrame(rafId);
		rafId = requestAnimationFrame(() => {
			rafId = 0;
			drawWaveform();
		});

		return () => {
			if (rafId) {
				cancelAnimationFrame(rafId);
				rafId = 0;
			}
		};
	});
</script>

<canvas
	bind:this={canvas}
	class="waveform-canvas"
	style="transform: translateX({scrollX}px)"
></canvas>

<style>
	.waveform-canvas {
		position: relative;
		display: block;
		pointer-events: none;
		transform-origin: top left;
		will-change: transform;
	}
</style>
