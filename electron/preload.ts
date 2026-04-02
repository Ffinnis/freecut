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

	shellShowInFolder: (filePath: string) => ipcRenderer.invoke('shell:showInFolder', filePath),

	checkForUpdate: () => ipcRenderer.invoke('update:check'),
	downloadUpdate: () => ipcRenderer.invoke('update:download'),
	installUpdate: () => ipcRenderer.invoke('update:install'),

	onUpdateAvailable: (callback: (info: { version: string; releaseNotes: string }) => void) => {
		const handler = (_event: Electron.IpcRendererEvent, info: { version: string; releaseNotes: string }) =>
			callback(info);
		ipcRenderer.on('update:available', handler);
		return () => ipcRenderer.removeListener('update:available', handler);
	},

	onUpdateDownloadProgress: (callback: (progress: { percent: number }) => void) => {
		const handler = (_event: Electron.IpcRendererEvent, progress: { percent: number }) =>
			callback(progress);
		ipcRenderer.on('update:download-progress', handler);
		return () => ipcRenderer.removeListener('update:download-progress', handler);
	},

	onUpdateDownloaded: (callback: () => void) => {
		const handler = () => callback();
		ipcRenderer.on('update:downloaded', handler);
		return () => ipcRenderer.removeListener('update:downloaded', handler);
	},

	onUpdateError: (callback: (error: { message: string }) => void) => {
		const handler = (_event: Electron.IpcRendererEvent, error: { message: string }) =>
			callback(error);
		ipcRenderer.on('update:error', handler);
		return () => ipcRenderer.removeListener('update:error', handler);
	}
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ElectronAPI = typeof electronAPI;
