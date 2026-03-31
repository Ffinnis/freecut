import type { Segment } from '$lib/types/project';

export interface EditSegment {
	editStart: number;
	editEnd: number;
	sourceStart: number;
	sourceEnd: number;
}

export function buildEditTimeline(segments: Segment[]): EditSegment[] {
	const result: EditSegment[] = [];
	let editOffset = 0;

	for (const s of segments) {
		if (s.action !== 'keep') continue;
		const dur = s.end - s.start;
		result.push({
			editStart: editOffset,
			editEnd: editOffset + dur,
			sourceStart: s.start,
			sourceEnd: s.end
		});
		editOffset += dur;
	}

	return result;
}

export function getEditDuration(timeline: EditSegment[]): number {
	if (timeline.length === 0) return 0;
	return timeline[timeline.length - 1].editEnd;
}

export function findEditSegmentAtTime(
	editTime: number,
	timeline: EditSegment[]
): { segment: EditSegment; index: number } | null {
	let left = 0;
	let right = timeline.length - 1;

	while (left <= right) {
		const mid = (left + right) >> 1;
		const seg = timeline[mid];

		if (editTime < seg.editStart) {
			right = mid - 1;
		} else if (editTime > seg.editEnd) {
			left = mid + 1;
		} else {
			return { segment: seg, index: mid };
		}
	}

	return null;
}

export function editToSource(editTime: number, timeline: EditSegment[]): number {
	if (timeline.length === 0) return 0;
	if (editTime <= 0) return timeline[0].sourceStart;

	const found = findEditSegmentAtTime(editTime, timeline);
	if (found) {
		return found.segment.sourceStart + (editTime - found.segment.editStart);
	}

	return timeline[timeline.length - 1].sourceEnd;
}

export function sourceToEdit(sourceTime: number, timeline: EditSegment[]): number {
	if (timeline.length === 0) return 0;

	for (const seg of timeline) {
		if (sourceTime >= seg.sourceStart && sourceTime <= seg.sourceEnd) {
			return seg.editStart + (sourceTime - seg.sourceStart);
		}
	}

	if (sourceTime < timeline[0].sourceStart) return 0;
	return timeline[timeline.length - 1].editEnd;
}

export function buildCollapsedPeaks(
	peaks: number[],
	peaksPerSecond: number,
	timeline: EditSegment[]
): number[] {
	const result: number[] = [];

	for (const seg of timeline) {
		const startIdx = Math.round(seg.sourceStart * peaksPerSecond);
		const endIdx = Math.round(seg.sourceEnd * peaksPerSecond);
		for (let i = startIdx; i < endIdx && i < peaks.length; i++) {
			result.push(peaks[i]);
		}
	}

	return result;
}
