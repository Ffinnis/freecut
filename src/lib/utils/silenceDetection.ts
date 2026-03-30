import type { WaveformData } from '$lib/types/ipc';
import type { DetectionSettings, Segment } from '$lib/types/project';

const AUTO_THRESHOLD_FALLBACK = 0.032;
const AUTO_THRESHOLD_MIN = 0.002;
const AUTO_THRESHOLD_MAX = 0.08;
const MIN_SEGMENT_SECONDS = 0.001;
const SPEECH_GAP_CLOSE_MS = 75;

export interface DetectionResult {
	thresholdValue: number;
	segments: Segment[];
}

interface TimeRange {
	start: number;
	end: number;
}

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

function percentile(sorted: number[], fraction: number) {
	if (sorted.length === 0) return AUTO_THRESHOLD_FALLBACK;
	if (sorted.length === 1) return sorted[0];

	const index = clamp(fraction, 0, 1) * (sorted.length - 1);
	const lower = Math.floor(index);
	const upper = Math.ceil(index);
	const weight = index - lower;

	if (lower === upper) return sorted[lower];
	return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function computeAutoThreshold(peaks: number[]) {
	const nonZeroPeaks = peaks.filter((peak) => peak > 0);
	if (nonZeroPeaks.length < 32) return AUTO_THRESHOLD_FALLBACK;

	const sorted = [...nonZeroPeaks].sort((a, b) => a - b);
	return clamp(percentile(sorted, 0.2) * 1.8, AUTO_THRESHOLD_MIN, AUTO_THRESHOLD_MAX);
}

function closeShortSpeechGaps(mask: boolean[], maxGapFrames: number) {
	if (maxGapFrames <= 0 || mask.length === 0) return mask;

	const closed = [...mask];
	let index = 0;

	while (index < closed.length) {
		while (index < closed.length && closed[index]) index++;

		const gapStart = index;
		while (index < closed.length && !closed[index]) index++;
		const gapEnd = index;
		const gapLength = gapEnd - gapStart;

		if (gapStart > 0 && gapEnd < closed.length && gapLength > 0 && gapLength <= maxGapFrames) {
			for (let i = gapStart; i < gapEnd; i++) {
				closed[i] = true;
			}
		}
	}

	return closed;
}

function extractSilentRuns(mask: boolean[], peaksPerSecond: number, minSilenceFrames: number) {
	const runs: TimeRange[] = [];
	let runStart = -1;

	for (let i = 0; i < mask.length; i++) {
		if (mask[i]) {
			if (runStart === -1) runStart = i;
			continue;
		}

		if (runStart !== -1 && i - runStart >= minSilenceFrames) {
			runs.push({
				start: runStart / peaksPerSecond,
				end: i / peaksPerSecond
			});
		}

		runStart = -1;
	}

	if (runStart !== -1 && mask.length - runStart >= minSilenceFrames) {
		runs.push({
			start: runStart / peaksPerSecond,
			end: mask.length / peaksPerSecond
		});
	}

	return runs;
}

function trimAndMergeRuns(
	runs: TimeRange[],
	duration: number,
	paddingBeforeMs: number,
	paddingAfterMs: number
) {
	const paddingBefore = paddingBeforeMs / 1000;
	const paddingAfter = paddingAfterMs / 1000;
	const merged: TimeRange[] = [];

	for (const run of runs) {
		const trimmedStart = clamp(run.start + paddingBefore, 0, duration);
		const trimmedEnd = clamp(run.end - paddingAfter, 0, duration);

		if (trimmedEnd - trimmedStart < MIN_SEGMENT_SECONDS) continue;

		const previous = merged.at(-1);
		if (previous && trimmedStart <= previous.end + MIN_SEGMENT_SECONDS) {
			previous.end = Math.max(previous.end, trimmedEnd);
			continue;
		}

		merged.push({ start: trimmedStart, end: trimmedEnd });
	}

	return merged;
}

function createSegmentId(type: Segment['type'], start: number, end: number) {
	return `${type}:${Math.round(start * 1000)}-${Math.round(end * 1000)}`;
}

function buildSegmentsFromSilentRuns(runs: TimeRange[], duration: number): Segment[] {
	const segments: Segment[] = [];
	let cursor = 0;

	for (const run of runs) {
		if (run.start - cursor >= MIN_SEGMENT_SECONDS) {
			segments.push({
				id: createSegmentId('speech', cursor, run.start),
				start: cursor,
				end: run.start,
				type: 'speech',
				action: 'keep'
			});
		}

		segments.push({
			id: createSegmentId('silence', run.start, run.end),
			start: run.start,
			end: run.end,
			type: 'silence',
			action: 'remove'
		});

		cursor = run.end;
	}

	if (duration - cursor >= MIN_SEGMENT_SECONDS) {
		segments.push({
			id: createSegmentId('speech', cursor, duration),
			start: cursor,
			end: duration,
			type: 'speech',
			action: 'keep'
		});
	}

	if (segments.length > 0) return segments;

	return [
		{
			id: createSegmentId('speech', 0, duration),
			start: 0,
			end: duration,
			type: 'speech',
			action: 'keep'
		}
	];
}

export function detectSilenceSegments(
	waveform: WaveformData | null,
	settings: DetectionSettings,
	durationOverride?: number
): DetectionResult {
	const duration = Math.max(durationOverride ?? waveform?.duration ?? 0, 0);
	if (!waveform || waveform.peaks.length === 0 || waveform.peaksPerSecond <= 0 || duration <= 0) {
		return {
			thresholdValue: settings.thresholdAuto ? AUTO_THRESHOLD_FALLBACK : settings.manualThresholdValue,
			segments: duration > 0
				? [
					{
						id: createSegmentId('speech', 0, duration),
						start: 0,
						end: duration,
						type: 'speech',
						action: 'keep'
					}
				]
				: []
		};
	}

	const thresholdValue = settings.thresholdAuto
		? computeAutoThreshold(waveform.peaks)
		: clamp(settings.manualThresholdValue, 0, 1);

	const silentMask = waveform.peaks.map((peak) => peak <= thresholdValue);
	const closedMask = closeShortSpeechGaps(
		silentMask,
		Math.max(1, Math.round((SPEECH_GAP_CLOSE_MS / 1000) * waveform.peaksPerSecond))
	);
	const minSilenceFrames = Math.max(
		1,
		Math.ceil((settings.minSilenceDuration / 1000) * waveform.peaksPerSecond)
	);

	const rawRuns = extractSilentRuns(closedMask, waveform.peaksPerSecond, minSilenceFrames);
	const trimmedRuns = trimAndMergeRuns(
		rawRuns,
		duration,
		settings.paddingBefore,
		settings.paddingAfter
	);

	return {
		thresholdValue,
		segments: buildSegmentsFromSilentRuns(trimmedRuns, duration)
	};
}
