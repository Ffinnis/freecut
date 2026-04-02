export interface WaveformData {
	duration: number;
	peaksPerSecond: number;
	peaks: number[];
}

export interface WaveformExtractRequest {
	filePath: string;
	requestId: string;
}

export interface WaveformChunk extends WaveformData {
	requestId: string;
	startIndex: number;
	progress: number;
}

export type ExportFormat = 'mp4' | 'mov' | 'wav' | 'mp3' | 'fcpxml' | 'edl';

export type VideoQuality = 'low' | 'medium' | 'high' | 'original';

export interface ExportRequest {
	sourceFile: string;
	segments: { start: number; end: number }[];
	format: ExportFormat;
	outputPath: string;
	quality?: VideoQuality;
	framerate?: number;
}

export interface ExportProgress {
	percent: number;
	timeRemaining: number | null;
}

export interface ExportResult {
	success: boolean;
	outputPath?: string;
	error?: string;
}

export interface ProbeResult {
	fps: number;
	width: number;
	height: number;
	videoBitrate: number;
	audioBitrate: number;
	duration: number;
	videoCodec: string;
	audioCodec: string;
}

export interface ElectronAPI {
	openFile: () => Promise<string | null>;
	saveFile: (defaultName: string, filters?: { name: string; extensions: string[] }[]) => Promise<string | null>;
	extractWaveform: (request: WaveformExtractRequest | string) => Promise<WaveformData>;
	onWaveformChunk?: (callback: (chunk: WaveformChunk) => void) => () => void;
	onFileOpened: (callback: (filePath: string) => void) => () => void;
	probe: (filePath: string) => Promise<ProbeResult>;
	startExport: (request: ExportRequest) => Promise<ExportResult>;
	cancelExport: () => Promise<void>;
	onExportProgress: (callback: (progress: ExportProgress) => void) => () => void;
	shellOpenPath: (filePath: string) => Promise<void>;
	shellShowInFolder: (filePath: string) => Promise<void>;
}

declare global {
	interface Window {
		electronAPI: ElectronAPI;
	}
}
