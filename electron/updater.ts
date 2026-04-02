import { autoUpdater } from 'electron-updater';
import { BrowserWindow, ipcMain } from 'electron';

export function initUpdater(mainWindow: BrowserWindow) {
	autoUpdater.autoDownload = false;
	autoUpdater.autoInstallOnAppQuit = false;

	autoUpdater.on('update-available', (info) => {
		mainWindow.webContents.send('update:available', {
			version: info.version,
			releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : ''
		});
	});

	autoUpdater.on('download-progress', (progress) => {
		mainWindow.webContents.send('update:download-progress', {
			percent: Math.round(progress.percent)
		});
	});

	autoUpdater.on('update-downloaded', () => {
		mainWindow.webContents.send('update:downloaded');
	});

	autoUpdater.on('error', (err) => {
		mainWindow.webContents.send('update:error', {
			message: err.message
		});
	});

	ipcMain.handle('update:check', async () => {
		await autoUpdater.checkForUpdates();
	});

	ipcMain.handle('update:download', async () => {
		await autoUpdater.downloadUpdate();
	});

	ipcMain.handle('update:install', () => {
		autoUpdater.quitAndInstall();
	});

	setTimeout(() => {
		autoUpdater.checkForUpdates().catch(() => {});
	}, 3000);
}
