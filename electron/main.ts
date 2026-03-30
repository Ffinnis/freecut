import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import serve from 'electron-serve';
import { extractWaveform } from './waveform';

const isDev = !app.isPackaged;

const loadURL = isDev
	? null
	: serve({ directory: path.join(__dirname, '../build') });

let mainWindow: BrowserWindow | null = null;

function createWindow() {
	mainWindow = new BrowserWindow({
		width: 1400,
		height: 900,
		minWidth: 1000,
		minHeight: 700,
		backgroundColor: '#1e1e1e',
		titleBarStyle: 'hiddenInset',
		webPreferences: {
			preload: path.join(__dirname, 'preload.js'),
			contextIsolation: true,
			nodeIntegration: false
		}
	});

	if (isDev) {
		mainWindow.loadURL('http://localhost:5173');
		mainWindow.webContents.openDevTools();
	} else {
		loadURL!(mainWindow);
	}

	mainWindow.on('closed', () => {
		mainWindow = null;
	});
}

app.whenReady().then(() => {
	createWindow();
	registerIpcHandlers();

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow();
		}
	});
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

function registerIpcHandlers() {
	ipcMain.handle('dialog:openFile', async () => {
		const result = await dialog.showOpenDialog(mainWindow!, {
			properties: ['openFile'],
			filters: [
				{
					name: 'Media Files',
					extensions: ['mp4', 'mov', 'mkv', 'webm', 'wav', 'mp3', 'aac']
				}
			]
		});

		if (result.canceled || result.filePaths.length === 0) {
			return null;
		}

		return result.filePaths[0];
	});

	ipcMain.handle(
		'media:extractWaveform',
		async (event, request: { filePath: string; requestId: string } | string) => {
			const payload = typeof request === 'string'
				? { filePath: request, requestId: `legacy-${Date.now()}` }
				: request;

			return extractWaveform(payload.filePath, payload.requestId, (chunk) => {
				event.sender.send('media:waveformChunk', chunk);
			});
		}
	);

	ipcMain.handle('dialog:saveFile', async (_event, defaultName: string) => {
		const result = await dialog.showSaveDialog(mainWindow!, {
			defaultPath: defaultName,
			filters: [
				{ name: 'MP4 Video', extensions: ['mp4'] },
				{ name: 'MOV Video', extensions: ['mov'] },
				{ name: 'WAV Audio', extensions: ['wav'] },
				{ name: 'MP3 Audio', extensions: ['mp3'] }
			]
		});

		if (result.canceled || !result.filePath) {
			return null;
		}

		return result.filePath;
	});
}
