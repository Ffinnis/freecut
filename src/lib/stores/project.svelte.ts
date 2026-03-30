import { DEFAULT_SETTINGS, type Project, type DetectionSettings } from '$lib/types/project';
import type { WaveformData, WaveformChunk } from '$lib/types/ipc';

class ProjectState {
	project = $state<Project | null>(null);
	settings = $state<DetectionSettings>({ ...DEFAULT_SETTINGS });
	isLoading = $state(false);
	waveform = $state<WaveformData | null>(null);
	waveformLoading = $state(false);
	waveformRequestId = $state<string | null>(null);

	get hasProject() {
		return this.project !== null;
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
	}

	failWaveformLoad(requestId: string) {
		if (this.waveformRequestId !== requestId) return;

		this.waveformRequestId = null;
		this.waveformLoading = false;
	}

	reset() {
		this.project = null;
		this.settings = { ...DEFAULT_SETTINGS };
		this.isLoading = false;
		this.waveform = null;
		this.waveformLoading = false;
		this.waveformRequestId = null;
	}
}

export const projectState = new ProjectState();
