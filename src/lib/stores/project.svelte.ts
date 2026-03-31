import { DEFAULT_SETTINGS, type Project, type DetectionSettings } from '$lib/types/project';
import { buildEditTimeline, getEditDuration, type EditSegment } from '$lib/utils/editTimeline';
import type { WaveformData, WaveformChunk } from '$lib/types/ipc';
import { uiState } from './ui.svelte';
import { detectSilenceSegments } from '$lib/utils/silenceDetection';
import { INTENSITY_PRESETS, type IntensityPreset, type Segment } from '$lib/types/project';

class ProjectState {
	project = $state<Project | null>(null);
	settings = $state<DetectionSettings>({ ...DEFAULT_SETTINGS });
	isLoading = $state(false);
	waveform = $state<WaveformData | null>(null);
	waveformLoading = $state(false);
	waveformRequestId = $state<string | null>(null);
	detectionTimer: ReturnType<typeof setTimeout> | null = null;
	detectionFrame: number | null = null;

	get hasProject() {
		return this.project !== null;
	}

	get canDetectSilence() {
		return this.waveform !== null && !this.waveformLoading;
	}

	get totalDuration() {
		return this.project?.duration ?? 0;
	}

	get silenceDuration() {
		if (!this.project) return 0;
		return this.project.segments
			.filter((s) => s.type === 'silence' && s.action === 'remove')
			.reduce((sum, s) => sum + (s.end - s.start), 0);
	}

	get cutCount() {
		if (!this.project) return 0;
		return this.project.segments.filter((s) => s.type === 'silence' && s.action === 'remove')
			.length;
	}

	get editTimeline(): EditSegment[] {
		if (!uiState.silenceRemoved || !this.project) return [];
		return buildEditTimeline(this.project.segments);
	}

	get editDuration(): number {
		return getEditDuration(this.editTimeline);
	}

	syncProjectSettings() {
		if (!this.project) return;
		this.project.settings = { ...this.settings };
	}

	clearPendingDetection() {
		if (!this.detectionTimer) return;
		clearTimeout(this.detectionTimer);
		this.detectionTimer = null;
	}

	clearPendingDetectionFrame() {
		if (this.detectionFrame === null) return;
		cancelAnimationFrame(this.detectionFrame);
		this.detectionFrame = null;
	}

	setDuration(duration: number) {
		if (!this.project || !Number.isFinite(duration) || duration <= 0) return;
		this.project.duration = duration;
	}

	beginWaveformLoad(path: string): string {
		const requestId = crypto.randomUUID();

		this.waveformRequestId = requestId;
		this.project = {
			id: crypto.randomUUID(),
			sourceFile: path,
			duration: 0,
			sampleRate: 44100,
			segments: [],
			settings: { ...this.settings }
		};
		uiState.selectSegment(null);
		this.clearPendingDetection();
		this.clearPendingDetectionFrame();
		this.waveform = null;
		this.waveformLoading = true;

		return requestId;
	}

	applyWaveformChunk(chunk: WaveformChunk) {
		if (chunk.requestId !== this.waveformRequestId || !this.project) return;

		this.project.duration = chunk.duration;

		const current = this.waveform;
		if (!current || chunk.startIndex === 0 || current.peaksPerSecond !== chunk.peaksPerSecond) {
			this.waveform = {
				duration: chunk.duration,
				peaksPerSecond: chunk.peaksPerSecond,
				peaks: [...chunk.peaks]
			};
			return;
		}

		const nextPeaks = current.peaks.slice();
		if (chunk.startIndex > nextPeaks.length) {
			nextPeaks.length = chunk.startIndex;
		}
		nextPeaks.splice(chunk.startIndex, chunk.peaks.length, ...chunk.peaks);

		this.waveform = {
			duration: chunk.duration || current.duration,
			peaksPerSecond: current.peaksPerSecond,
			peaks: nextPeaks
		};
	}

	finishWaveformLoad(requestId: string, path: string, data: WaveformData) {
		if (this.waveformRequestId !== requestId) return;
		if (this.project?.sourceFile !== path) return;

		this.waveform = data;
		this.project.duration = data.duration;
		this.waveformRequestId = null;
		this.waveformLoading = false;
		this.runSilenceDetection();
	}

	failWaveformLoad(requestId: string) {
		if (this.waveformRequestId !== requestId) return;

		this.waveformRequestId = null;
		this.waveformLoading = false;
	}

	applyIntensityPreset(preset: IntensityPreset) {
		const mapping = INTENSITY_PRESETS[preset];
		this.settings.intensity = preset;
		this.settings.minSilenceDuration = mapping.minSilenceDuration;
		this.settings.paddingBefore = mapping.paddingBefore;
		this.settings.paddingAfter = mapping.paddingAfter;
		this.syncProjectSettings();
		this.scheduleSilenceDetection();
	}

	setThresholdAuto(next: boolean) {
		this.settings.thresholdAuto = next;
		this.syncProjectSettings();
		this.scheduleSilenceDetection();
	}

	setManualThresholdValue(next: number, options?: { live?: boolean }) {
		if (!Number.isFinite(next)) return;
		this.settings.manualThresholdValue = Math.min(Math.max(next, 0), 1);
		this.syncProjectSettings();
		if (options?.live) {
			this.scheduleLiveSilenceDetection();
			return;
		}

		this.scheduleSilenceDetection();
	}

	scheduleSilenceDetection(delay = 75) {
		if (!this.project || !this.waveform || this.waveformLoading) return;
		this.clearPendingDetection();
		this.clearPendingDetectionFrame();
		this.detectionTimer = setTimeout(() => {
			this.detectionTimer = null;
			this.runSilenceDetection();
		}, delay);
	}

	scheduleLiveSilenceDetection() {
		if (!this.project || !this.waveform || this.waveformLoading) return;
		this.clearPendingDetection();
		if (this.detectionFrame !== null) return;

		this.detectionFrame = requestAnimationFrame(() => {
			this.detectionFrame = null;
			this.runSilenceDetection();
		});
	}

	runSilenceDetection() {
		this.clearPendingDetection();
		this.clearPendingDetectionFrame();
		if (!this.project) return;

		const result = detectSilenceSegments(this.waveform, this.settings, this.project.duration);
		this.settings.thresholdValue = result.thresholdValue;
		this.project.settings = { ...this.settings };
		this.project.segments = result.segments;
		uiState.selectSegment(null);
	}

	findSegmentById(segmentId: string | null): Segment | null {
		if (!segmentId || !this.project) return null;
		return this.project.segments.find((segment) => segment.id === segmentId) ?? null;
	}

	findSegmentAtTime(time: number): Segment | null {
		if (!this.project || this.project.segments.length === 0) return null;

		let left = 0;
		let right = this.project.segments.length - 1;

		while (left <= right) {
			const mid = Math.floor((left + right) / 2);
			const segment = this.project.segments[mid];

			if (time < segment.start) {
				right = mid - 1;
				continue;
			}

			if (time > segment.end) {
				left = mid + 1;
				continue;
			}

			return segment;
		}

		return null;
	}

	toggleSegmentAction(segmentId: string | null) {
		if (!segmentId || !this.project) return false;

		const segmentIndex = this.project.segments.findIndex((segment) => segment.id === segmentId);
		if (segmentIndex === -1) return false;

		const segment = this.project.segments[segmentIndex];

		const nextAction = segment.action === 'remove' ? 'keep' : 'remove';
		const nextSegments = this.project.segments.slice();
		nextSegments[segmentIndex] = {
			...segment,
			action: nextAction
		};

		this.project.segments = nextSegments;
		return true;
	}

	reset() {
		this.clearPendingDetection();
		this.clearPendingDetectionFrame();
		this.project = null;
		this.settings = { ...DEFAULT_SETTINGS };
		this.isLoading = false;
		this.waveform = null;
		this.waveformLoading = false;
		this.waveformRequestId = null;
		uiState.selectSegment(null);
	}
}

export const projectState = new ProjectState();
