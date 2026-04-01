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

describe('generateFcpXml', () => {
  it('produces valid FCP XML with correct structure', () => {
    const xml = generateFcpXml(SEGMENTS, 'TestProject', 30, '/path/to/source.mp4', 12);
    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain('<fcpxml version="1.11">');
    expect(xml).toContain('name="TestProject"');
    expect(xml).toContain('src="file:///path/to/source.mp4"');
    expect(xml).toContain('frameDuration="1001/30000s"');
    // 3 clip elements
    expect((xml.match(/<clip /g) || []).length).toBe(3);
  });

  it('handles 24fps frame duration', () => {
    const xml = generateFcpXml(SEGMENTS, 'Test', 24, '/path/source.mp4', 12);
    expect(xml).toContain('frameDuration="1001/24000s"');
  });
});
