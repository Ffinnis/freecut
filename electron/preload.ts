import { contextBridge, ipcRenderer } from 'electron';

type WaveformExtractRequest = {
	filePath: string;
	requestId: string;
};

type WaveformChunk = {
	requestId: string;
	duration: number;
	peaksPerSecond: number;
	startIndex: number;
	progress: number;
	peaks: number[];
};

type ExportProgress = {
	percent: number;
	timeRemaining: number | null;
};

const electronAPI = {
	openFile: (): Promise<string | null> => ipcRenderer.invoke('dialog:openFile'),

	saveFile: (defaultName: string, filters?: { name: string; extensions: string[] }[]): Promise<string | null> =>
		ipcRenderer.invoke('dialog:saveFile', defaultName, filters),

	extractWaveform: (request: WaveformExtractRequest | string) =>
		ipcRenderer.invoke('media:extractWaveform', request),

	onWaveformChunk: (callback: (chunk: WaveformChunk) => void) => {
		const handler = (_event: Electron.IpcRendererEvent, chunk: WaveformChunk) =>
			callback(chunk);
		ipcRenderer.on('media:waveformChunk', handler);
		return () => ipcRenderer.removeListener('media:waveformChunk', handler);
	},

	onFileOpened: (callback: (filePath: string) => void) => {
		const handler = (_event: Electron.IpcRendererEvent, filePath: string) =>
			callback(filePath);
		ipcRenderer.on('file:opened', handler);
		return () => ipcRenderer.removeListener('file:opened', handler);
	},

	probe: (filePath: string) => ipcRenderer.invoke('media:probe', filePath),

	startExport: (request: {
		sourceFile: string;
		segments: { start: number; end: number }[];
		format: string;
		outputPath: string;
		quality?: string;
		framerate?: number;
	}) => ipcRenderer.invoke('media:export', request),

	cancelExport: () => ipcRenderer.invoke('media:exportCancel'),

	onExportProgress: (callback: (progress: ExportProgress) => void) => {
		const handler = (_event: Electron.IpcRendererEvent, progress: ExportProgress) =>
			callback(progress);
		ipcRenderer.on('media:exportProgress', handler);
		return () => ipcRenderer.removeListener('media:exportProgress', handler);
	},

	shellOpenPath: (filePath: string) => ipcRenderer.invoke('shell:openPath', filePath),

	shellShowInFolder: (filePath: string) => ipcRenderer.invoke('shell:showInFolder', filePath)
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ElectronAPI = typeof electronAPI;
