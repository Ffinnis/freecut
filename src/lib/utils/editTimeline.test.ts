import { describe, it, expect } from 'vitest';
import {
	buildEditTimeline,
	getEditDuration,
	findEditSegmentAtTime,
	editToSource,
	sourceToEdit,
	buildCollapsedPeaks
} from './editTimeline';
import type { Segment } from '$lib/types/project';

function seg(
	start: number,
	end: number,
	type: 'speech' | 'silence',
	action: 'keep' | 'remove'
): Segment {
	return { id: `${type}:${start}-${end}`, start, end, type, action };
}

const MIXED: Segment[] = [
	seg(0, 3, 'speech', 'keep'),
	seg(3, 5, 'silence', 'remove'),
	seg(5, 8, 'speech', 'keep'),
	seg(8, 9, 'silence', 'remove'),
	seg(9, 12, 'speech', 'keep')
];

describe('buildEditTimeline', () => {
	it('maps kept segments to packed edit positions', () => {
		expect(buildEditTimeline(MIXED)).toEqual([
			{ editStart: 0, editEnd: 3, sourceStart: 0, sourceEnd: 3 },
			{ editStart: 3, editEnd: 6, sourceStart: 5, sourceEnd: 8 },
			{ editStart: 6, editEnd: 9, sourceStart: 9, sourceEnd: 12 }
		]);
	});

	it('returns empty for no segments', () => {
		expect(buildEditTimeline([])).toEqual([]);
	});

	it('returns empty when all removed', () => {
		expect(buildEditTimeline([seg(0, 5, 'silence', 'remove')])).toEqual([]);
	});

	it('handles single kept segment', () => {
		expect(buildEditTimeline([seg(2, 5, 'speech', 'keep')])).toEqual([
			{ editStart: 0, editEnd: 3, sourceStart: 2, sourceEnd: 5 }
		]);
	});
});

describe('getEditDuration', () => {
	it('returns 0 for empty timeline', () => {
		expect(getEditDuration([])).toBe(0);
	});

	it('returns last editEnd', () => {
		expect(getEditDuration(buildEditTimeline(MIXED))).toBe(9);
	});
});

describe('findEditSegmentAtTime', () => {
	const tl = buildEditTimeline(MIXED);

	it('finds first segment', () => {
		expect(findEditSegmentAtTime(1, tl)?.index).toBe(0);
	});

	it('finds middle segment', () => {
		expect(findEditSegmentAtTime(4, tl)?.index).toBe(1);
	});

	it('finds last segment', () => {
		expect(findEditSegmentAtTime(7, tl)?.index).toBe(2);
	});

	it('finds segment at exact boundary', () => {
		expect(findEditSegmentAtTime(3, tl)?.index).toBe(1);
	});

	it('returns null beyond range', () => {
		expect(findEditSegmentAtTime(100, tl)).toBeNull();
	});

	it('returns null for empty timeline', () => {
		expect(findEditSegmentAtTime(0, [])).toBeNull();
	});
});

describe('editToSource', () => {
	const tl = buildEditTimeline(MIXED);

	it('maps within first segment (identity)', () => {
		expect(editToSource(1.5, tl)).toBe(1.5);
	});

	it('maps within second segment (skips gap)', () => {
		expect(editToSource(4, tl)).toBe(6);
	});

	it('maps within third segment', () => {
		expect(editToSource(7, tl)).toBe(10);
	});

	it('clamps below zero', () => {
		expect(editToSource(-1, tl)).toBe(0);
	});

	it('clamps beyond end', () => {
		expect(editToSource(100, tl)).toBe(12);
	});

	it('returns 0 for empty timeline', () => {
		expect(editToSource(5, [])).toBe(0);
	});
});

describe('sourceToEdit', () => {
	const tl = buildEditTimeline(MIXED);

	it('maps within first segment (identity)', () => {
		expect(sourceToEdit(1.5, tl)).toBe(1.5);
	});

	it('maps within second segment (collapses gap)', () => {
		expect(sourceToEdit(6, tl)).toBe(4);
	});

	it('clamps before first segment', () => {
		expect(sourceToEdit(-1, tl)).toBe(0);
	});

	it('clamps after last segment', () => {
		expect(sourceToEdit(100, tl)).toBe(9);
	});

	it('returns 0 for empty timeline', () => {
		expect(sourceToEdit(5, [])).toBe(0);
	});
});

describe('buildCollapsedPeaks', () => {
	it('concatenates peaks from kept segments only', () => {
		// 10 peaks/sec, segments: keep 0-1s, remove 1-2s, keep 2-3s
		const peaks = [
			0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, // 0-1s
			0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, // 1-2s (silence)
			0.5, 0.4, 0.3, 0.2, 0.1, 0.6, 0.7, 0.8, 0.9, 1.0 // 2-3s
		];
		const segs: Segment[] = [
			seg(0, 1, 'speech', 'keep'),
			seg(1, 2, 'silence', 'remove'),
			seg(2, 3, 'speech', 'keep')
		];
		const tl = buildEditTimeline(segs);
		const result = buildCollapsedPeaks(peaks, 10, tl);

		expect(result).toEqual([
			0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 0.5, 0.4, 0.3, 0.2, 0.1, 0.6,
			0.7, 0.8, 0.9, 1.0
		]);
	});

	it('returns empty for empty timeline', () => {
		expect(buildCollapsedPeaks([0.1, 0.2], 10, [])).toEqual([]);
	});
});
