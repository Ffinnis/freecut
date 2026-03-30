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
	return getFfmpegPath().replace(/ffmpeg$/, 'ffprobe');
}
