import { contextBridge, ipcRenderer } from 'electron';

const electronAPI = {
	openFile: (): Promise<string | null> => ipcRenderer.invoke('dialog:openFile'),

	saveFile: (defaultName: string): Promise<string | null> =>
		ipcRenderer.invoke('dialog:saveFile', defaultName),

	onFileOpened: (callback: (filePath: string) => void) => {
		const handler = (_event: Electron.IpcRendererEvent, filePath: string) =>
			callback(filePath);
		ipcRenderer.on('file:opened', handler);
		return () => ipcRenderer.removeListener('file:opened', handler);
	}
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ElectronAPI = typeof electronAPI;
