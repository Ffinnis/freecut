export interface ElectronAPI {
	openFile: () => Promise<string | null>;
	saveFile: (defaultName: string) => Promise<string | null>;
	onFileOpened: (callback: (filePath: string) => void) => () => void;
}

declare global {
	interface Window {
		electronAPI: ElectronAPI;
	}
}
