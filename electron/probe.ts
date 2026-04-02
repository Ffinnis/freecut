import { spawn } from 'child_process';
import { getFfprobePath } from './ffmpeg';

export interface ProbeResult {
  fps: number;
  width: number;
  height: number;
  fileSize: number;
  videoBitrate: number;
  audioBitrate: number;
  duration: number;
  videoCodec: string;
  audioCodec: string;
}

interface ProbeStream {
  codec_type: string;
  codec_name?: string;
  width?: number;
  height?: number;
  r_frame_rate?: string;
  bit_rate?: string;
}

interface ProbeOutput {
  streams: ProbeStream[];
  format: {
    duration?: string;
    size?: string;
  };
}

export function parseProbeOutput(jsonString: string): ProbeResult {
  const data: ProbeOutput = JSON.parse(jsonString);
  const video = data.streams.find((s) => s.codec_type === 'video');
  const audio = data.streams.find((s) => s.codec_type === 'audio');
  const durationText = typeof data.format.duration === 'string' ? data.format.duration : '0';

  let fps = 0;
  if (video?.r_frame_rate) {
    const [num, den] = video.r_frame_rate.split('/').map(Number);
    fps = den ? num / den : num;
  }

	return {
	  fps,
	  width: video?.width ?? 0,
	  height: video?.height ?? 0,
	  fileSize: parseInt(data.format.size ?? '0', 10) || 0,
	  videoBitrate: parseInt(video?.bit_rate ?? '0', 10) || 0,
	  audioBitrate: parseInt(audio?.bit_rate ?? '0', 10) || 0,
	  duration: Number.parseFloat(durationText) || 0,
	  videoCodec: video?.codec_name ?? '',
	  audioCodec: audio?.codec_name ?? ''
	};
}

export function probeFile(filePath: string): Promise<ProbeResult> {
  return new Promise((resolve, reject) => {
    const ffprobePath = getFfprobePath();
    const proc = spawn(ffprobePath, [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_streams',
      '-show_format',
      filePath
    ]);

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    proc.on('error', (err) => {
      reject(new Error(`FFprobe failed to start: ${err.message}`));
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`FFprobe exited with code ${code}: ${stderr}`));
        return;
      }
      try {
        resolve(parseProbeOutput(stdout));
      } catch (err) {
        reject(new Error(`Failed to parse FFprobe output: ${(err as Error).message}`));
      }
    });
  });
}
