import { describe, it, expect } from 'vitest';
import { buildFilterComplex, qualityArgs } from './export';

describe('buildFilterComplex', () => {
  it('builds correct filter for single segment', () => {
    const segments = [{ start: 0, end: 5 }];
    const result = buildFilterComplex(segments, true);
    expect(result).toBe(
      '[0:v]trim=start=0:end=5,setpts=PTS-STARTPTS[v0];' +
      '[0:a]atrim=start=0:end=5,asetpts=PTS-STARTPTS[a0];' +
      '[v0][a0]concat=n=1:v=1:a=1[vout][aout]'
    );
  });

  it('builds correct filter for multiple segments', () => {
    const segments = [
      { start: 0, end: 3 },
      { start: 5, end: 8 },
      { start: 9, end: 12 }
    ];
    const result = buildFilterComplex(segments, true);
    expect(result).toBe(
      '[0:v]trim=start=0:end=3,setpts=PTS-STARTPTS[v0];' +
      '[0:a]atrim=start=0:end=3,asetpts=PTS-STARTPTS[a0];' +
      '[0:v]trim=start=5:end=8,setpts=PTS-STARTPTS[v1];' +
      '[0:a]atrim=start=5:end=8,asetpts=PTS-STARTPTS[a1];' +
      '[0:v]trim=start=9:end=12,setpts=PTS-STARTPTS[v2];' +
      '[0:a]atrim=start=9:end=12,asetpts=PTS-STARTPTS[a2];' +
      '[v0][a0][v1][a1][v2][a2]concat=n=3:v=1:a=1[vout][aout]'
    );
  });

  it('includes scale filter for 720p', () => {
    const segments = [{ start: 0, end: 5 }];
    const result = buildFilterComplex(segments, true, true);
    expect(result).toContain('setpts=PTS-STARTPTS,scale=-2:720');
  });

  it('builds audio-only filter when hasVideo is false', () => {
    const segments = [
      { start: 0, end: 3 },
      { start: 5, end: 8 }
    ];
    const result = buildFilterComplex(segments, false);
    expect(result).toBe(
      '[0:a]atrim=start=0:end=3,asetpts=PTS-STARTPTS[a0];' +
      '[0:a]atrim=start=5:end=8,asetpts=PTS-STARTPTS[a1];' +
      '[a0][a1]concat=n=2:v=0:a=1[aout]'
    );
  });
});

describe('qualityArgs', () => {
  it('returns CRF 28 for low quality', () => {
    const args = qualityArgs('low', 5000000);
    expect(args).toContain('-crf');
    expect(args).toContain('28');
  });

  it('returns CRF 23 for medium quality', () => {
    const args = qualityArgs('medium', 5000000);
    expect(args).toContain('-crf');
    expect(args).toContain('23');
  });

  it('returns CRF 18 for high quality', () => {
    const args = qualityArgs('high', 5000000);
    expect(args).toContain('-crf');
    expect(args).toContain('18');
  });

  it('returns bitrate-based args for original quality', () => {
    const args = qualityArgs('original', 5000000);
    expect(args).toContain('-b:v');
    expect(args).toContain('5000000');
  });
});
