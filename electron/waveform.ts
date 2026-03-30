import { spawn } from 'child_process';
import { getFfmpegPath } from './ffmpeg';

export interface WaveformData {
	duration: number;
	peaksPerSecond: number;
	peaks: number[];
}

export interface WaveformChunk extends WaveformData {
	requestId: string;
	startIndex: number;
	progress: number;
}

const DECODE_RATE = 8000;
const PEAKS_PER_SECOND = 200;
const WINDOW_SIZE = DECODE_RATE / PEAKS_PER_SECOND; // 40 samples
const CHUNK_PROGRESS_STEP = 0.1;

function parseDuration(stderr: string): number {
	const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/);
	if (!match) return 0;
	const h = parseInt(match[1], 10);
	const m = parseInt(match[2], 10);
	const s = parseInt(match[3], 10);
	const cs = parseInt(match[4], 10);
	return h * 3600 + m * 60 + s + cs / 100;
}

export function extractWaveform(
	filePath: string,
	requestId: string,
	onChunk?: (chunk: WaveformChunk) => void
): Promise<WaveformData> {
	return new Promise((resolve, reject) => {
		const ffmpegPath = getFfmpegPath();

		const proc = spawn(ffmpegPath, [
			'-i', filePath,
			'-vn',                    // no video
			'-ac', '1',               // mono
			'-ar', String(DECODE_RATE), // 8 kHz
			'-f', 's16le',            // signed 16-bit little-endian PCM
			'-'                       // stdout
		], { stdio: ['ignore', 'pipe', 'pipe'] });

		const peaks: number[] = [];
		let stderrData = '';
		let duration = 0;
		let expectedPeakCount = 0;
		let emittedPeakCount = 0;
		let nextChunkProgress = CHUNK_PROGRESS_STEP;

		// Accumulator for streaming peak computation
		let windowMax = 0;
		let windowPos = 0;
		let leftover: Buffer = Buffer.alloc(0);

		function updateDuration() {
			const parsedDuration = parseDuration(stderrData);
			if (parsedDuration <= 0 || parsedDuration === duration) return;

			duration = parsedDuration;
			expectedPeakCount = Math.max(1, Math.ceil(duration * PEAKS_PER_SECOND));
		}

		function emitAvailableChunks(force = false) {
			if (!onChunk) return;
			if (duration <= 0 || expectedPeakCount <= 0) return;

			if (force) {
				if (emittedPeakCount >= peaks.length) return;
				onChunk({
					requestId,
					duration,
					peaksPerSecond: PEAKS_PER_SECOND,
					startIndex: emittedPeakCount,
					progress: 1,
					peaks: peaks.slice(emittedPeakCount)
				});
				emittedPeakCount = peaks.length;
				return;
			}

			while (nextChunkProgress <= 1) {
				const targetPeakCount = Math.ceil(expectedPeakCount * nextChunkProgress);
				if (peaks.length < targetPeakCount) break;
				if (targetPeakCount <= emittedPeakCount) {
					nextChunkProgress = Number((nextChunkProgress + CHUNK_PROGRESS_STEP).toFixed(4));
					continue;
				}

				onChunk({
					requestId,
					duration,
					peaksPerSecond: PEAKS_PER_SECOND,
					startIndex: emittedPeakCount,
					progress: Math.min(1, targetPeakCount / expectedPeakCount),
					peaks: peaks.slice(emittedPeakCount, targetPeakCount)
				});
				emittedPeakCount = targetPeakCount;
				nextChunkProgress = Number((nextChunkProgress + CHUNK_PROGRESS_STEP).toFixed(4));
			}
		}

		proc.stdout.on('data', (chunk: Buffer) => {
			// Prepend any leftover bytes from previous chunk
			if (leftover.length > 0) {
				chunk = Buffer.concat([leftover, chunk]);
				leftover = Buffer.alloc(0);
			}

			// s16le = 2 bytes per sample
			const sampleCount = Math.floor(chunk.length / 2);
			const remainder = chunk.length % 2;

			if (remainder > 0) {
				leftover = Buffer.from(chunk.subarray(chunk.length - remainder));
			}

			for (let i = 0; i < sampleCount; i++) {
				const sample = chunk.readInt16LE(i * 2);
				const abs = Math.abs(sample) / 32768;
				if (abs > windowMax) windowMax = abs;
				windowPos++;

				if (windowPos >= WINDOW_SIZE) {
					peaks.push(windowMax);
					windowMax = 0;
					windowPos = 0;
				}
			}

			emitAvailableChunks();
		});

		proc.stderr.on('data', (chunk: Buffer) => {
			stderrData += chunk.toString();
			updateDuration();
			emitAvailableChunks();
		});

		proc.on('error', (err) => {
			reject(new Error(`FFmpeg failed to start: ${err.message}`));
		});

		proc.on('close', (code) => {
			// Flush remaining samples in the last window
			if (windowPos > 0) {
				peaks.push(windowMax);
			}

			duration = parseDuration(stderrData) || duration || peaks.length / PEAKS_PER_SECOND;
			expectedPeakCount = Math.max(1, Math.ceil(duration * PEAKS_PER_SECOND));

			if (code !== 0 && peaks.length === 0) {
				reject(new Error(`FFmpeg exited with code ${code}. No audio data extracted.`));
				return;
			}

			emitAvailableChunks(true);

			resolve({
				duration,
				peaksPerSecond: PEAKS_PER_SECOND,
				peaks
			});
		});
	});
}
