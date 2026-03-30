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

const electronAPI = {
	openFile: (): Promise<string | null> => ipcRenderer.invoke('dialog:openFile'),

	saveFile: (defaultName: string): Promise<string | null> =>
		ipcRenderer.invoke('dialog:saveFile', defaultName),

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
	}
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ElectronAPI = typeof electronAPI;
