import { spawn, type ChildProcess } from 'child_process';
import { getFfmpegPath } from './ffmpeg';

type VideoQuality = 'low' | 'medium' | 'high' | 'original';

interface ExportSegment {
  start: number;
  end: number;
}

interface ExportProgress {
  percent: number;
  timeRemaining: number | null;
}

export function buildFilterComplex(segments: ExportSegment[], hasVideo: boolean, scale720p = false): string {
  const parts: string[] = [];
  const concatInputs: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    const { start, end } = segments[i];

    if (hasVideo) {
      const scaleFilter = scale720p ? ',scale=-2:720' : '';
      parts.push(`[0:v]trim=start=${start}:end=${end},setpts=PTS-STARTPTS${scaleFilter}[v${i}]`);
      parts.push(`[0:a]atrim=start=${start}:end=${end},asetpts=PTS-STARTPTS[a${i}]`);
      concatInputs.push(`[v${i}][a${i}]`);
    } else {
      parts.push(`[0:a]atrim=start=${start}:end=${end},asetpts=PTS-STARTPTS[a${i}]`);
      concatInputs.push(`[a${i}]`);
    }
  }

  if (hasVideo) {
    parts.push(`${concatInputs.join('')}concat=n=${segments.length}:v=1:a=1[vout][aout]`);
  } else {
    parts.push(`${concatInputs.join('')}concat=n=${segments.length}:v=0:a=1[aout]`);
  }

  return parts.join(';');
}

export function qualityArgs(quality: VideoQuality, sourceBitrate: number): string[] {
  switch (quality) {
    case 'low':
      return ['-crf', '28', '-preset', 'medium'];
    case 'medium':
      return ['-crf', '23', '-preset', 'medium'];
    case 'high':
      return ['-crf', '18', '-preset', 'slow'];
    case 'original':
      return ['-b:v', String(sourceBitrate), '-preset', 'medium'];
  }
}

export function proResQualityArgs(quality: VideoQuality): string[] {
  switch (quality) {
    case 'low':
      return ['-profile:v', '0'];      // ProRes 422 Proxy
    case 'medium':
      return ['-profile:v', '1'];      // ProRes 422 LT
    case 'high':
      return ['-profile:v', '3'];      // ProRes 422 HQ
    case 'original':
      return ['-profile:v', '3'];      // ProRes 422 HQ
  }
}

function parseTimeProgress(line: string): number | null {
  const match = line.match(/time=(\d+):(\d+):(\d+)\.(\d+)/);
  if (!match) return null;
  return parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3]) + parseInt(match[4]) / 100;
}

let activeProcess: ChildProcess | null = null;

export function cancelExport(): void {
  if (activeProcess) {
    activeProcess.kill('SIGTERM');
    activeProcess = null;
  }
}

export interface ExportOptions {
  sourceFile: string;
  segments: ExportSegment[];
  format: string;
  outputPath: string;
  quality: VideoQuality;
  hasVideo: boolean;
  sourceBitrate: number;
  onProgress?: (progress: ExportProgress) => void;
}

export function runExport(options: ExportOptions): Promise<{ success: boolean; error?: string }> {
  const { sourceFile, segments, format, outputPath, quality, hasVideo, sourceBitrate, onProgress } = options;

  const totalDuration = segments.reduce((sum, s) => sum + (s.end - s.start), 0);
  const scale720p = hasVideo && quality === 'low';
  const filterComplex = buildFilterComplex(segments, hasVideo, scale720p);

  const args: string[] = ['-i', sourceFile, '-filter_complex', filterComplex];

  if (hasVideo) {
    args.push('-map', '[vout]', '-map', '[aout]');

    if (format === 'mov') {
      args.push(...proResQualityArgs(quality));
      args.push('-c:v', 'prores_ks', '-pix_fmt', 'yuv422p10le', '-c:a', 'pcm_s16le');
    } else {
      args.push(...qualityArgs(quality, sourceBitrate));
      args.push('-c:v', 'libx264', '-c:a', 'aac');
    }
  } else {
    args.push('-map', '[aout]');

    if (format === 'wav') {
      args.push('-c:a', 'pcm_s16le');
    } else if (format === 'mp3') {
      const bitrates: Record<VideoQuality, string> = {
        low: '128k',
        medium: '192k',
        high: '256k',
        original: '320k'
      };
      args.push('-c:a', 'libmp3lame', '-b:a', bitrates[quality]);
    }
  }

  args.push('-y', outputPath);

  return new Promise((resolve) => {
    const ffmpegPath = getFfmpegPath();
    const proc = spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    activeProcess = proc;

    let stderr = '';
    let startTime = Date.now();

    proc.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
      const currentTime = parseTimeProgress(chunk.toString());
      if (currentTime !== null && totalDuration > 0 && onProgress) {
        const percent = Math.min(99, Math.round((currentTime / totalDuration) * 100));
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = currentTime / elapsed;
        const remaining = rate > 0 ? (totalDuration - currentTime) / rate : null;
        onProgress({ percent, timeRemaining: remaining ? Math.round(remaining) : null });
      }
    });

    proc.on('error', (err) => {
      activeProcess = null;
      resolve({ success: false, error: `FFmpeg failed to start: ${err.message}` });
    });

    proc.on('close', (code) => {
      activeProcess = null;
      if (code === 0) {
        onProgress?.({ percent: 100, timeRemaining: 0 });
        resolve({ success: true });
      } else {
        resolve({ success: false, error: `FFmpeg exited with code ${code}: ${stderr.slice(-500)}` });
      }
    });
  });
}
