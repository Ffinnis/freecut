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

export interface ElectronAPI {
	openFile: () => Promise<string | null>;
	saveFile: (defaultName: string) => Promise<string | null>;
	extractWaveform: (request: WaveformExtractRequest | string) => Promise<WaveformData>;
	onWaveformChunk?: (callback: (chunk: WaveformChunk) => void) => () => void;
	onFileOpened: (callback: (filePath: string) => void) => () => void;
}

declare global {
	interface Window {
		electronAPI: ElectronAPI;
	}
}
