import { describe, it, expect } from 'vitest';
import { generateEdl, generateFcpXml, secondsToTimecode } from './exportEditors';

const SEGMENTS = [
  { start: 0, end: 3 },
  { start: 5, end: 8 },
  { start: 9, end: 12 }
];

describe('secondsToTimecode', () => {
  it('converts 0 to 00:00:00:00', () => {
    expect(secondsToTimecode(0, 30)).toBe('00:00:00:00');
  });

  it('converts 90.5 seconds at 30fps', () => {
    expect(secondsToTimecode(90.5, 30)).toBe('00:01:30:15');
  });

  it('converts with 24fps', () => {
    expect(secondsToTimecode(1.5, 24)).toBe('00:00:01:12');
  });

  it('handles exact hours', () => {
    expect(secondsToTimecode(3600, 30)).toBe('01:00:00:00');
  });

  it('produces integer frames at 29.97fps', () => {
    expect(secondsToTimecode(1, 29.97)).toBe('00:00:01:00');
  });

  it('produces integer frames at 23.976fps', () => {
    expect(secondsToTimecode(1.5, 23.976)).toBe('00:00:01:12');
  });
});

describe('generateEdl', () => {
  it('produces valid CMX 3600 EDL', () => {
    const edl = generateEdl(SEGMENTS, 'MyProject', 30);
    const lines = edl.split('\n');

    expect(lines[0]).toBe('TITLE: MyProject');
    expect(lines[1]).toBe('FCM: NON-DROP FRAME');
    expect(lines[2]).toBe('');

    // First event
    expect(lines[3]).toMatch(/^001\s+AX\s+V\s+C\s+00:00:00:00 00:00:03:00 00:00:00:00 00:00:03:00$/);
    // Second event (source in at 5s)
    expect(lines[4]).toMatch(/^002\s+AX\s+V\s+C\s+00:00:05:00 00:00:08:00 00:00:03:00 00:00:06:00$/);
    // Third event (source in at 9s)
    expect(lines[5]).toMatch(/^003\s+AX\s+V\s+C\s+00:00:09:00 00:00:12:00 00:00:06:00 00:00:09:00$/);
  });

  it('handles empty segments', () => {
    const edl = generateEdl([], 'Empty', 30);
    expect(edl).toContain('TITLE: Empty');
    expect(edl.split('\n').filter(l => l.match(/^\d{3}/))).toHaveLength(0);
  });
});

const DEFAULT_MEDIA = { width: 1920, height: 1080, hasVideo: true, hasAudio: true };

describe('generateFcpXml', () => {
  it('produces valid FCP XML with correct structure', () => {
    const xml = generateFcpXml(SEGMENTS, 'TestProject', 30, '/path/to/source.mp4', 12, DEFAULT_MEDIA);
    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain('<fcpxml version="1.11">');
    expect(xml).toContain('name="TestProject"');
    expect(xml).toContain('<format id="r1" name="FFVideoFormat1080p30" />');
    expect(xml).toContain('<media-rep kind="original-media" src="file:///path/to/source.mp4" />');
    expect(xml).toContain('<sequence format="r1">');
    expect((xml.match(/<asset-clip /g) || []).length).toBe(3);
    expect(xml).not.toContain('<asset id="r2" name="TestProject" src=');
  });

  it('handles 24fps frame duration', () => {
    const xml = generateFcpXml(SEGMENTS, 'Test', 24, '/path/source.mp4', 12, DEFAULT_MEDIA);
    expect(xml).toContain('name="FFVideoFormat1080p24"');
  });

  it('uses NTSC duration for 29.97fps', () => {
    const xml = generateFcpXml(SEGMENTS, 'Test', 29.97, '/path/source.mp4', 12, DEFAULT_MEDIA);
    expect(xml).toContain('name="FFVideoFormat1080p2997"');
  });

  it('uses actual dimensions from probe data', () => {
    const media = { width: 3840, height: 2160, hasVideo: true, hasAudio: true };
    const xml = generateFcpXml(SEGMENTS, 'Test', 30, '/path/source.mp4', 12, media);
    expect(xml).toContain('frameDuration="1/30s"');
    expect(xml).toContain('width="3840"');
    expect(xml).toContain('height="2160"');
    expect(xml).not.toContain('width="1920"');
  });

  it('sets hasVideo="0" for audio-only media', () => {
    const media = { width: 0, height: 0, hasVideo: false, hasAudio: true };
    const xml = generateFcpXml(SEGMENTS, 'Podcast', 25, '/path/podcast.mp3', 180, media);
    expect(xml).toContain('hasVideo="0"');
    expect(xml).toContain('hasAudio="1"');
    expect(xml).not.toContain('width=');
    expect(xml).not.toContain('height=');
  });

  it('emits audio clip refs for audio-only media', () => {
    const media = { width: 0, height: 0, hasVideo: false, hasAudio: true };
    const xml = generateFcpXml(SEGMENTS, 'Podcast', 25, '/path/podcast.mp3', 180, media);
    expect(xml).toContain('<asset-clip name="Podcast" ref="r2"');
    expect(xml).not.toContain('<audio ref=');
    expect(xml).not.toContain('<video ref=');
  });

  it('emits video clip refs for video media', () => {
    const xml = generateFcpXml(SEGMENTS, 'Test', 30, '/path/source.mp4', 12, DEFAULT_MEDIA);
    expect(xml).toContain('<asset-clip name="Test" ref="r2"');
    expect(xml).not.toContain('<audio ref=');
    expect(xml).not.toContain('<video ref=');
  });

  it('encodes file URLs safely for paths with spaces', () => {
    const xml = generateFcpXml(SEGMENTS, 'Test', 30, '/tmp/My File.mp4', 12, DEFAULT_MEDIA);
    expect(xml).toContain('src="file:///tmp/My%20File.mp4"');
  });
});
