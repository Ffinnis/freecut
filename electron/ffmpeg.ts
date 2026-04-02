import { app } from 'electron';
import path from 'path';

export function getFfmpegPath(): string {
	const ffmpegStatic = require('ffmpeg-static') as string;

	if (app.isPackaged) {
		return ffmpegStatic.replace('app.asar', 'app.asar.unpacked');
	}

	return ffmpegStatic;
}

export function getFfprobePath(): string {
	const ffprobeStatic = require('ffprobe-static') as { path: string };

	if (app.isPackaged) {
		return ffprobeStatic.path.replace('app.asar', 'app.asar.unpacked');
	}

	return ffprobeStatic.path;
}
