import { describe, it, expect } from 'vitest';
import { parseProbeOutput } from './probe';

const SAMPLE_PROBE_OUTPUT = JSON.stringify({
  streams: [
    {
      codec_type: 'video',
      codec_name: 'h264',
      width: 1920,
      height: 1080,
      r_frame_rate: '30000/1001',
      bit_rate: '5000000'
    },
    {
      codec_type: 'audio',
      codec_name: 'aac',
      bit_rate: '128000'
    }
  ],
  format: {
    duration: '120.500000',
    size: '75432123'
  }
});

describe('parseProbeOutput', () => {
  it('parses standard h264/aac probe output', () => {
    const result = parseProbeOutput(SAMPLE_PROBE_OUTPUT);
    expect(result).toEqual({
      fps: expect.closeTo(29.97, 1),
      width: 1920,
      height: 1080,
      fileSize: 75432123,
      videoBitrate: 5000000,
      audioBitrate: 128000,
      duration: 120.5,
      videoCodec: 'h264',
      audioCodec: 'aac'
    });
  });

  it('handles integer frame rates', () => {
    const output = JSON.stringify({
      streams: [
        { codec_type: 'video', codec_name: 'h264', width: 1280, height: 720, r_frame_rate: '24/1', bit_rate: '3000000' },
        { codec_type: 'audio', codec_name: 'aac', bit_rate: '96000' }
      ],
      format: { duration: '60.0', size: '12345678' }
    });
    const result = parseProbeOutput(output);
    expect(result.fps).toBe(24);
    expect(result.width).toBe(1280);
  });

  it('handles audio-only files', () => {
    const output = JSON.stringify({
      streams: [
        { codec_type: 'audio', codec_name: 'mp3', bit_rate: '320000' }
      ],
      format: { duration: '180.0', size: '7200000' }
    });
    const result = parseProbeOutput(output);
    expect(result.fps).toBe(0);
    expect(result.width).toBe(0);
    expect(result.height).toBe(0);
    expect(result.fileSize).toBe(7200000);
    expect(result.videoCodec).toBe('');
    expect(result.audioCodec).toBe('mp3');
  });

  it('defaults missing bit_rate to 0', () => {
    const output = JSON.stringify({
      streams: [
        { codec_type: 'video', codec_name: 'h264', width: 1920, height: 1080, r_frame_rate: '30/1' },
        { codec_type: 'audio', codec_name: 'aac' }
      ],
      format: { duration: '10.0', size: '640000' }
    });
    const result = parseProbeOutput(output);
    expect(result.fileSize).toBe(640000);
    expect(result.videoBitrate).toBe(0);
    expect(result.audioBitrate).toBe(0);
  });
});
