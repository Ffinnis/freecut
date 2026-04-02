import { DEFAULT_SETTINGS, type Project, type DetectionSettings } from '$lib/types/project';
import {
	buildEditTimeline,
	editToSource,
	findEditSegmentAtTime,
	getEditDuration,
	type EditSegment
} from '$lib/utils/editTimeline';
import type { ProbeResult, WaveformData, WaveformChunk } from '$lib/types/ipc';
import { uiState } from './ui.svelte';
import { historyState } from './history.svelte';
import { detectSilenceSegments } from '$lib/utils/silenceDetection';
import { INTENSITY_PRESETS, type IntensityPreset, type Segment } from '$lib/types/project';

class ProjectState {
	project = $state<Project | null>(null);
	settings = $state<DetectionSettings>({ ...DEFAULT_SETTINGS });
	isLoading = $state(false);
	waveform = $state<WaveformData | null>(null);
	waveformLoading = $state(false);
	waveformRequestId = $state<string | null>(null);
	probeResult = $state<ProbeResult | null>(null);
	probeLoading = $state(false);
	probeRequestPath = $state<string | null>(null);
	probePromise: Promise<ProbeResult | null> | null = null;
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
		uiState.setSourceFps(null);
		this.probeResult = null;
		this.probeLoading = false;
		this.probeRequestPath = null;
		this.probePromise = null;
		this.project = {
			id: crypto.randomUUID(),
			sourceFile: path,
			duration: 0,
			sampleRate: 44100,
			segments: [],
			settings: { ...this.settings }
		};
		uiState.resetPlayback();
		uiState.selectSegment(null);
		this.clearPendingDetection();
		this.clearPendingDetectionFrame();
		this.waveform = null;
		this.waveformLoading = true;

		return requestId;
	}

	async loadSourceFile(path: string) {
		if (!path || typeof window === 'undefined' || !window.electronAPI?.extractWaveform) return;

		const supportsWaveformChunks = typeof window.electronAPI.onWaveformChunk === 'function';
		const requestId = this.beginWaveformLoad(path);
		void this.loadProbe(path);

		try {
			const data = await window.electronAPI.extractWaveform(
				supportsWaveformChunks ? { filePath: path, requestId } : path
			);
			this.finishWaveformLoad(requestId, path, data);
		} catch (err) {
			console.error('Waveform extraction failed:', err);
			this.failWaveformLoad(requestId);
		}
	}

	async browseForSourceFile() {
		if (typeof window === 'undefined' || !window.electronAPI?.openFile) return;
		const path = await window.electronAPI.openFile();
		if (!path) return;
		await this.loadSourceFile(path);
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

	async loadProbe(path: string): Promise<ProbeResult | null> {
		if (typeof window === 'undefined' || !window.electronAPI?.probe) return null;

		if (this.probeResult && this.project?.sourceFile === path) {
			return this.probeResult;
		}

		if (this.probeLoading && this.probeRequestPath === path && this.probePromise) {
			return this.probePromise;
		}

		this.probeLoading = true;
		this.probeRequestPath = path;

		const requestPath = path;
		this.probePromise = window.electronAPI.probe(path)
			.then((result) => {
				if (this.project?.sourceFile === requestPath) {
					this.probeResult = result;
					uiState.setSourceFps(result.fps);
				}
				return result;
			})
			.catch((err) => {
				console.error('Probe failed:', err);
				return null;
			})
			.finally(() => {
				if (this.probeRequestPath === requestPath) {
					this.probeLoading = false;
					this.probePromise = null;
				}
			});

		return this.probePromise;
	}

	async ensureProbeForCurrentProject(): Promise<ProbeResult | null> {
		if (!this.project) return null;
		return this.loadProbe(this.project.sourceFile);
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
		historyState.clear();
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

	private commitSegments(next: Segment[]) {
		if (!this.project) return;
		historyState.pushSnapshot(this.project.segments);
		this.project.segments = next;
	}

	applyUndo() {
		if (!this.project) return false;
		const snapshot = historyState.undo(this.project.segments);
		if (!snapshot) return false;
		this.project.segments = snapshot;
		return true;
	}

	applyRedo() {
		if (!this.project) return false;
		const snapshot = historyState.redo(this.project.segments);
		if (!snapshot) return false;
		this.project.segments = snapshot;
		return true;
	}

	startDrag() {
		if (!this.project) return;
		historyState.startDrag(this.project.segments);
	}

	endDrag() {
		historyState.endDrag();
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

		this.commitSegments(nextSegments);
		return true;
	}

	splitSegmentAtTime(time: number): boolean {
		if (!this.project) return false;

		const segments = this.project.segments;
		const index = segments.findIndex((s) => time > s.start && time < s.end);
		if (index === -1) return false;

		const segment = segments[index];
		const MIN_SEGMENT_DURATION = 0.05;
		if (time - segment.start < MIN_SEGMENT_DURATION || segment.end - time < MIN_SEGMENT_DURATION) {
			return false;
		}

		const first: Segment = { ...segment, id: crypto.randomUUID(), end: time };
		const second: Segment = { ...segment, id: crypto.randomUUID(), start: time };

		const nextSegments = segments.slice();
		nextSegments.splice(index, 1, first, second);
		this.commitSegments(nextSegments);
		uiState.selectSegment(null);
		return true;
	}

	splitSegmentAtEditTime(editTime: number): boolean {
		if (!this.project) return false;

		const timeline = buildEditTimeline(this.project.segments);
		if (timeline.length === 0) return false;

		const found = findEditSegmentAtTime(editTime, timeline);
		if (!found) return false;

		return this.splitSegmentAtTime(editToSource(editTime, timeline));
	}

	resizeSegmentEdge(segmentId: string, edge: 'start' | 'end', newTime: number): boolean {
		if (!this.project) return false;

		const segments = this.project.segments;
		const index = segments.findIndex((s) => s.id === segmentId);
		if (index === -1) return false;

		const MIN_WIDTH = 0.05;
		const segment = segments[index];
		let clamped = newTime;

		if (edge === 'start') {
			const minBound = index > 0 ? segments[index - 1].start + MIN_WIDTH : 0;
			const maxBound = segment.end - MIN_WIDTH;
			clamped = Math.min(Math.max(clamped, minBound), maxBound);

			const nextSegments = segments.slice();
			nextSegments[index] = { ...segment, start: clamped };
			if (index > 0) {
				nextSegments[index - 1] = { ...segments[index - 1], end: clamped };
			}
			if (historyState.isDragging) {
				this.project.segments = nextSegments;
			} else {
				this.commitSegments(nextSegments);
			}
		} else {
			const minBound = segment.start + MIN_WIDTH;
			const maxBound = index < segments.length - 1 ? segments[index + 1].end - MIN_WIDTH : (this.project.duration || Infinity);
			clamped = Math.min(Math.max(clamped, minBound), maxBound);

			const nextSegments = segments.slice();
			nextSegments[index] = { ...segment, end: clamped };
			if (index < segments.length - 1) {
				nextSegments[index + 1] = { ...segments[index + 1], start: clamped };
			}
			if (historyState.isDragging) {
				this.project.segments = nextSegments;
			} else {
				this.commitSegments(nextSegments);
			}
		}

		return true;
	}

	setAllSegmentsAction(action: 'keep' | 'remove'): void {
		if (!this.project) return;
		this.commitSegments(this.project.segments.map((s) => ({ ...s, action })));
	}

	nextSegmentBoundary(fromTime: number): number | null {
		if (!this.project) return null;
		const seg = this.findSegmentAtTime(fromTime);
		if (!seg) return null;
		const idx = this.project.segments.indexOf(seg);
		if (idx < this.project.segments.length - 1) {
			return this.project.segments[idx + 1].start;
		}
		return seg.end;
	}

	prevSegmentBoundary(fromTime: number): number | null {
		if (!this.project) return null;
		const seg = this.findSegmentAtTime(fromTime);
		if (!seg) return null;
		const idx = this.project.segments.indexOf(seg);
		if (idx > 0) {
			return this.project.segments[idx - 1].end;
		}
		return seg.start;
	}

	adjacentSegmentId(currentId: string | null, direction: -1 | 1): string | null {
		if (!this.project || !currentId) return null;
		const idx = this.project.segments.findIndex((s) => s.id === currentId);
		if (idx === -1) return null;
		const next = idx + direction;
		if (next < 0 || next >= this.project.segments.length) return null;
		return this.project.segments[next].id;
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
		uiState.setSourceFps(null);
		this.probeResult = null;
		this.probeLoading = false;
		this.probeRequestPath = null;
		this.probePromise = null;
		historyState.clear();
		uiState.selectSegment(null);
	}
}

export const projectState = new ProjectState();
