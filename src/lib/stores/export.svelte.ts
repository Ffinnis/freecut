import type { ExportFormat, VideoQuality, ProbeResult, ExportProgress } from '$lib/types/ipc';

export type ExportUiState = 'grid' | 'settings' | 'exporting' | 'done';

class ExportState {
	uiState = $state<ExportUiState>('grid');
	selectedFormat = $state<ExportFormat>('mp4');
	selectedQuality = $state<VideoQuality>('medium');
	selectedFramerate = $state<number>(30);
	probeResult = $state<ProbeResult | null>(null);
	probing = $state(false);
	progress = $state<ExportProgress>({ percent: 0, timeRemaining: null });
	exportError = $state<string | null>(null);
	outputPath = $state<string>('');
	progressCleanup: (() => void) | null = null;

	reset() {
		this.uiState = 'grid';
		this.probeResult = null;
		this.exportError = null;
		this.outputPath = '';
		this.progress = { percent: 0, timeRemaining: null };
		this.cleanupProgress();
	}

	cleanupProgress() {
		this.progressCleanup?.();
		this.progressCleanup = null;
	}
}

export const exportState = new ExportState();
