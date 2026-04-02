import { app, BrowserWindow, ipcMain, dialog, protocol, shell, Menu } from 'electron';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { Readable } from 'stream';
import path from 'path';
import serve from 'electron-serve';
import { extractWaveform } from './waveform';
import { probeFile } from './probe';
import { runExport, cancelExport } from './export';
import { writeEditorFile } from './exportEditors';
import { initUpdater } from './updater';

const MEDIA_PROTOCOL = 'freecut-media';
const MEDIA_MIME_TYPES: Record<string, string> = {
	'.mp4': 'video/mp4',
	'.mov': 'video/quicktime',
	'.m4v': 'video/x-m4v',
	'.webm': 'video/webm',
	'.mkv': 'video/x-matroska',
	'.mp3': 'audio/mpeg',
	'.wav': 'audio/wav',
	'.aac': 'audio/aac'
};

protocol.registerSchemesAsPrivileged([
	{
		scheme: MEDIA_PROTOCOL,
		privileges: {
			secure: true,
			standard: true,
			supportFetchAPI: true,
			stream: true
		}
	}
]);

const isDev = !app.isPackaged;

const loadURL = isDev
	? null
	: serve({ directory: path.join(__dirname, '../build') });

let mainWindow: BrowserWindow | null = null;

async function showOpenMediaDialog(browserWindow: BrowserWindow) {
	const result = await dialog.showOpenDialog(browserWindow, {
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
}

async function openSourceFileFromMenu(browserWindow: BrowserWindow | null) {
	if (!browserWindow) return;
	const filePath = await showOpenMediaDialog(browserWindow);
	if (!filePath) return;
	browserWindow.webContents.send('file:opened', filePath);
}

function installApplicationMenu() {
	const appSubmenu: Electron.MenuItemConstructorOptions[] = [
		{ role: 'about' },
		{ type: 'separator' },
		{ role: 'services' },
		{ type: 'separator' },
		{ role: 'hide' },
		{ role: 'hideOthers' },
		{ role: 'unhide' },
		{ type: 'separator' },
		{ role: 'quit' }
	];

	const fileSubmenu: Electron.MenuItemConstructorOptions[] = [
		{
			label: 'Open...',
			accelerator: 'CmdOrCtrl+O',
			click: () => {
				void openSourceFileFromMenu(mainWindow);
			}
		},
		{ type: 'separator' },
		process.platform === 'darwin' ? { role: 'close' } : { role: 'quit' }
	];

	const editSubmenu: Electron.MenuItemConstructorOptions[] = [
		{ role: 'undo' },
		{ role: 'redo' },
		{ type: 'separator' },
		{ role: 'cut' },
		{ role: 'copy' },
		{ role: 'paste' }
	];
	if (process.platform === 'darwin') {
		editSubmenu.push({ role: 'pasteAndMatchStyle' }, { role: 'delete' }, { role: 'selectAll' });
	} else {
		editSubmenu.push({ role: 'delete' }, { type: 'separator' }, { role: 'selectAll' });
	}

	const viewSubmenu: Electron.MenuItemConstructorOptions[] = [
		{ role: 'reload' },
		{ role: 'forceReload' },
		{ role: 'toggleDevTools' },
		{ type: 'separator' },
		{ role: 'resetZoom' },
		{ role: 'zoomIn' },
		{ role: 'zoomOut' },
		{ type: 'separator' },
		{ role: 'togglefullscreen' }
	];

	const windowSubmenu: Electron.MenuItemConstructorOptions[] = [
		{ role: 'minimize' },
		{ role: 'zoom' }
	];
	if (process.platform === 'darwin') {
		windowSubmenu.push({ type: 'separator' }, { role: 'front' });
	} else {
		windowSubmenu.push({ role: 'close' });
	}

	const template: Electron.MenuItemConstructorOptions[] = [
		...(process.platform === 'darwin'
			? [{ label: app.name, submenu: appSubmenu }]
			: []),
		{ label: 'File', submenu: fileSubmenu },
		{ label: 'Edit', submenu: editSubmenu },
		{ label: 'View', submenu: viewSubmenu },
		{ label: 'Window', submenu: windowSubmenu },
		{ role: 'help', submenu: [] }
	];

	Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function getMediaMimeType(filePath: string) {
	return MEDIA_MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

function parseByteRange(rangeHeader: string, size: number) {
	const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
	if (!match) return null;

	const startText = match[1];
	const endText = match[2];

	if (!startText && !endText) return null;

	if (!startText) {
		const suffixLength = Number.parseInt(endText, 10);
		if (!Number.isFinite(suffixLength) || suffixLength <= 0) return null;
		const start = Math.max(0, size - suffixLength);
		return { start, end: size - 1 };
	}

	const start = Number.parseInt(startText, 10);
	if (!Number.isFinite(start) || start < 0 || start >= size) return null;

	if (!endText) {
		return { start, end: size - 1 };
	}

	const end = Number.parseInt(endText, 10);
	if (!Number.isFinite(end) || end < start) return null;

	return { start, end: Math.min(end, size - 1) };
}

function registerMediaProtocol() {
	protocol.handle(MEDIA_PROTOCOL, async (request) => {
		const url = new URL(request.url);
		const filePath = url.searchParams.get('path');

		if (!filePath) {
			return new Response('Missing media file path', { status: 400 });
		}

		let fileInfo;
		try {
			fileInfo = await stat(filePath);
		} catch {
			return new Response('Media file not found', { status: 404 });
		}

		if (!fileInfo.isFile()) {
			return new Response('Media file not found', { status: 404 });
		}

		const headers = new Headers({
			'Accept-Ranges': 'bytes',
			'Cache-Control': 'no-store',
			'Content-Type': getMediaMimeType(filePath)
		});
		const rangeHeader = request.headers.get('range');

		if (!rangeHeader) {
			headers.set('Content-Length', String(fileInfo.size));
			return new Response(Readable.toWeb(createReadStream(filePath)) as BodyInit, {
				status: 200,
				headers
			});
		}

		const range = parseByteRange(rangeHeader, fileInfo.size);
		if (!range) {
			headers.set('Content-Range', `bytes */${fileInfo.size}`);
			return new Response(null, { status: 416, headers });
		}

		const { start, end } = range;
		headers.set('Content-Length', String(end - start + 1));
		headers.set('Content-Range', `bytes ${start}-${end}/${fileInfo.size}`);

		return new Response(
			Readable.toWeb(createReadStream(filePath, { start, end })) as BodyInit,
			{
				status: 206,
				headers
			}
		);
	});
}

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
	registerMediaProtocol();
	createWindow();
	installApplicationMenu();
	registerIpcHandlers();
	initUpdater(mainWindow!);

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
		if (!mainWindow) return null;
		return showOpenMediaDialog(mainWindow);
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

	ipcMain.handle('dialog:saveFile', async (_event, defaultName: string, filters?: { name: string; extensions: string[] }[]) => {
		const result = await dialog.showSaveDialog(mainWindow!, {
			defaultPath: defaultName,
			filters: filters ?? [
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

	ipcMain.handle('media:probe', async (_event, filePath: string) => {
		return probeFile(filePath);
	});

	ipcMain.handle('media:export', async (event, request: {
		sourceFile: string;
		segments: { start: number; end: number }[];
		format: string;
		outputPath: string;
		quality?: string;
		framerate?: number;
	}) => {
		const editorFormats = ['edl', 'fcpxml'];

		if (editorFormats.includes(request.format)) {
			const probeResult = await probeFile(request.sourceFile);
			const fps = request.framerate ?? (probeResult.fps || 25);
			const title = request.sourceFile.split('/').pop()?.replace(/\.[^.]+$/, '') ?? 'Untitled';

			return writeEditorFile(
				request.outputPath,
				request.segments,
				request.format as 'edl' | 'fcpxml',
				title,
				fps,
				request.sourceFile,
				probeResult.duration,
				{
					width: probeResult.width,
					height: probeResult.height,
					hasVideo: probeResult.videoCodec !== '',
					hasAudio: probeResult.audioCodec !== '',
				}
			);
		}

		const probeResult = await probeFile(request.sourceFile);
		const hasVideo = ['mp4', 'mov'].includes(request.format);

		return runExport({
			sourceFile: request.sourceFile,
			segments: request.segments,
			format: request.format,
			outputPath: request.outputPath,
			quality: (request.quality as 'low' | 'medium' | 'high' | 'original') ?? 'medium',
			hasVideo,
			sourceBitrate: probeResult.videoBitrate,
			onProgress: (progress) => {
				event.sender.send('media:exportProgress', progress);
			}
		});
	});

	ipcMain.handle('media:exportCancel', async () => {
		cancelExport();
	});

	ipcMain.handle('shell:openPath', async (_event, filePath: string) => {
		await shell.openPath(filePath);
	});

	ipcMain.handle('shell:showInFolder', async (_event, filePath: string) => {
		shell.showItemInFolder(filePath);
	});
}
