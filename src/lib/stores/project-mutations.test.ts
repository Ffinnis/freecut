import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { projectState } from './project.svelte';
import { historyState } from './history.svelte';
import { uiState } from './ui.svelte';
import type { Segment } from '$lib/types/project';
import type { WaveformData } from '$lib/types/ipc';

function seg(
	start: number,
	end: number,
	type: 'speech' | 'silence' = 'speech',
	action: 'keep' | 'remove' = 'keep'
): Segment {
	return { id: `${type}:${start}-${end}`, start, end, type, action };
}

function setupProject(segments: Segment[], duration = 10) {
	projectState.reset();
	projectState.project = {
		id: 'test',
		sourceFile: '/test.mp4',
		duration,
		sampleRate: 44100,
		segments,
		settings: projectState.settings
	};
	historyState.clear();
}

function assertContiguity(segments: Segment[]) {
	for (let i = 0; i < segments.length - 1; i++) {
		expect(segments[i].end).toBe(segments[i + 1].start);
	}
}

describe('splitSegmentAtTime', () => {
	it('splits a segment in the middle', () => {
		setupProject([seg(0, 5), seg(5, 10)]);
		const result = projectState.splitSegmentAtTime(2.5);
		expect(result).toBe(true);
		expect(projectState.project!.segments).toHaveLength(3);
		expect(projectState.project!.segments[0].end).toBe(2.5);
		expect(projectState.project!.segments[1].start).toBe(2.5);
		expect(projectState.project!.segments[1].end).toBe(5);
		assertContiguity(projectState.project!.segments);
	});

	it('preserves segment type and action on both halves', () => {
		setupProject([seg(0, 10, 'silence', 'keep')]);
		projectState.splitSegmentAtTime(5);
		const [first, second] = projectState.project!.segments;
		expect(first.type).toBe('silence');
		expect(first.action).toBe('keep');
		expect(second.type).toBe('silence');
		expect(second.action).toBe('keep');
	});

	it('preserves remove action when splitting an already removed segment', () => {
		setupProject([seg(0, 10, 'speech', 'remove')]);
		projectState.splitSegmentAtTime(5);
		const [first, second] = projectState.project!.segments;
		expect(first.action).toBe('remove');
		expect(second.action).toBe('remove');
	});

	it('rejects split too close to start edge', () => {
		setupProject([seg(0, 10)]);
		expect(projectState.splitSegmentAtTime(0.02)).toBe(false);
		expect(projectState.project!.segments).toHaveLength(1);
	});

	it('rejects split too close to end edge', () => {
		setupProject([seg(0, 10)]);
		expect(projectState.splitSegmentAtTime(9.98)).toBe(false);
		expect(projectState.project!.segments).toHaveLength(1);
	});

	it('rejects split outside any segment', () => {
		setupProject([seg(0, 5)], 10);
		expect(projectState.splitSegmentAtTime(7)).toBe(false);
	});

	it('clears selection after splitting', () => {
		setupProject([seg(0, 10)]);
		projectState.splitSegmentAtTime(5);
		expect(uiState.selectedSegmentId).toBeNull();
	});

	it('supports undo', () => {
		setupProject([seg(0, 10)]);
		projectState.splitSegmentAtTime(5);
		expect(projectState.project!.segments).toHaveLength(2);
		projectState.applyUndo();
		expect(projectState.project!.segments).toHaveLength(1);
		expect(projectState.project!.segments[0].start).toBe(0);
		expect(projectState.project!.segments[0].end).toBe(10);
	});
});

describe('splitSegmentAtEditTime', () => {
	it('splits the kept segment addressed by collapsed timeline time', () => {
		setupProject([
			seg(0, 3, 'speech', 'keep'),
			seg(3, 5, 'silence', 'remove'),
			seg(5, 8, 'speech', 'keep')
		]);

		const result = projectState.splitSegmentAtEditTime(4);

		expect(result).toBe(true);
		expect(projectState.project!.segments).toHaveLength(4);
		expect(projectState.project!.segments[2].start).toBe(5);
		expect(projectState.project!.segments[2].end).toBe(6);
		expect(projectState.project!.segments[3].start).toBe(6);
		expect(projectState.project!.segments[3].end).toBe(8);
		assertContiguity(projectState.project!.segments);
	});

	it('rejects edit times outside kept clips', () => {
		setupProject([
			seg(0, 3, 'speech', 'keep'),
			seg(3, 5, 'silence', 'remove'),
			seg(5, 8, 'speech', 'keep')
		]);

		expect(projectState.splitSegmentAtEditTime(100)).toBe(false);
		expect(projectState.project!.segments).toHaveLength(3);
	});
});

describe('resizeSegmentEdge', () => {
	it('resizes end edge and updates next segment start', () => {
		setupProject([seg(0, 5), seg(5, 10)]);
		const id = projectState.project!.segments[0].id;
		projectState.resizeSegmentEdge(id, 'end', 6);
		expect(projectState.project!.segments[0].end).toBe(6);
		expect(projectState.project!.segments[1].start).toBe(6);
		assertContiguity(projectState.project!.segments);
	});

	it('resizes start edge and updates previous segment end', () => {
		setupProject([seg(0, 5), seg(5, 10)]);
		const id = projectState.project!.segments[1].id;
		projectState.resizeSegmentEdge(id, 'start', 4);
		expect(projectState.project!.segments[0].end).toBe(4);
		expect(projectState.project!.segments[1].start).toBe(4);
		assertContiguity(projectState.project!.segments);
	});

	it('clamps to minimum segment width', () => {
		setupProject([seg(0, 5), seg(5, 10)]);
		const id = projectState.project!.segments[0].id;
		projectState.resizeSegmentEdge(id, 'end', 9.99);
		const segments = projectState.project!.segments;
		expect(segments[1].end - segments[1].start).toBeGreaterThanOrEqual(0.05);
		assertContiguity(segments);
	});

	it('clamps start edge to 0', () => {
		setupProject([seg(0, 5), seg(5, 10)]);
		const id = projectState.project!.segments[0].id;
		projectState.resizeSegmentEdge(id, 'start', -5);
		expect(projectState.project!.segments[0].start).toBe(0);
	});

	it('clamps end edge to duration for last segment', () => {
		setupProject([seg(0, 5), seg(5, 10)], 10);
		const id = projectState.project!.segments[1].id;
		projectState.resizeSegmentEdge(id, 'end', 15);
		expect(projectState.project!.segments[1].end).toBe(10);
	});

	it('returns false for unknown segment', () => {
		setupProject([seg(0, 10)]);
		expect(projectState.resizeSegmentEdge('nope', 'end', 5)).toBe(false);
	});

	it('supports undo', () => {
		setupProject([seg(0, 5), seg(5, 10)]);
		const id = projectState.project!.segments[0].id;
		projectState.resizeSegmentEdge(id, 'end', 7);
		projectState.applyUndo();
		expect(projectState.project!.segments[0].end).toBe(5);
		expect(projectState.project!.segments[1].start).toBe(5);
	});
});

describe('setAllSegmentsAction', () => {
	it('marks all segments as remove', () => {
		setupProject([seg(0, 3, 'speech', 'keep'), seg(3, 6, 'silence', 'keep'), seg(6, 10, 'speech', 'keep')]);
		projectState.setAllSegmentsAction('remove');
		for (const s of projectState.project!.segments) {
			expect(s.action).toBe('remove');
		}
	});

	it('marks all segments as keep', () => {
		setupProject([seg(0, 5, 'speech', 'remove'), seg(5, 10, 'silence', 'remove')]);
		projectState.setAllSegmentsAction('keep');
		for (const s of projectState.project!.segments) {
			expect(s.action).toBe('keep');
		}
	});

	it('supports undo', () => {
		setupProject([seg(0, 5, 'speech', 'keep'), seg(5, 10, 'silence', 'remove')]);
		projectState.setAllSegmentsAction('remove');
		projectState.applyUndo();
		expect(projectState.project!.segments[0].action).toBe('keep');
		expect(projectState.project!.segments[1].action).toBe('remove');
	});
});

describe('navigation helpers', () => {
	beforeEach(() => {
		setupProject([seg(0, 3), seg(3, 6), seg(6, 10)]);
	});

	it('nextSegmentBoundary returns start of next segment', () => {
		expect(projectState.nextSegmentBoundary(1)).toBe(3);
		expect(projectState.nextSegmentBoundary(4)).toBe(6);
	});

	it('nextSegmentBoundary at last segment returns end', () => {
		expect(projectState.nextSegmentBoundary(8)).toBe(10);
	});

	it('prevSegmentBoundary returns end of previous segment', () => {
		expect(projectState.prevSegmentBoundary(4)).toBe(3);
		expect(projectState.prevSegmentBoundary(8)).toBe(6);
	});

	it('prevSegmentBoundary at first segment returns start', () => {
		expect(projectState.prevSegmentBoundary(1)).toBe(0);
	});

	it('adjacentSegmentId returns next', () => {
		const id = projectState.project!.segments[0].id;
		expect(projectState.adjacentSegmentId(id, 1)).toBe(projectState.project!.segments[1].id);
	});

	it('adjacentSegmentId returns previous', () => {
		const id = projectState.project!.segments[1].id;
		expect(projectState.adjacentSegmentId(id, -1)).toBe(projectState.project!.segments[0].id);
	});

	it('adjacentSegmentId returns null at boundary', () => {
		const first = projectState.project!.segments[0].id;
		const last = projectState.project!.segments[2].id;
		expect(projectState.adjacentSegmentId(first, -1)).toBeNull();
		expect(projectState.adjacentSegmentId(last, 1)).toBeNull();
	});

	it('adjacentSegmentId returns null for unknown id', () => {
		expect(projectState.adjacentSegmentId('nope', 1)).toBeNull();
	});
});

describe('source file loading', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		projectState.reset();
	});

	it('browseForSourceFile opens and loads the selected file', async () => {
		const waveform: WaveformData = {
			duration: 12,
			peaksPerSecond: 200,
			peaks: [0.1, 0.4, 0.2]
		};
		const openFile = vi.fn().mockResolvedValue('/new-file.mp4');
		const extractWaveform = vi.fn().mockResolvedValue(waveform);
		const probe = vi.fn().mockResolvedValue({
			fps: 30,
			width: 1920,
			height: 1080,
			fileSize: 1000,
			videoBitrate: 8000,
			audioBitrate: 320,
			duration: 12,
			videoCodec: 'h264',
			audioCodec: 'aac'
		});

		vi.stubGlobal('window', {
			electronAPI: {
				openFile,
				extractWaveform,
				onWaveformChunk: vi.fn(),
				probe
			}
		});

		await projectState.browseForSourceFile();

		expect(openFile).toHaveBeenCalledOnce();
		expect(extractWaveform).toHaveBeenCalledOnce();
		expect(projectState.project?.sourceFile).toBe('/new-file.mp4');
		expect(projectState.waveform?.duration).toBe(12);
		expect(projectState.waveformLoading).toBe(false);
	});

	it('browseForSourceFile does nothing when picker is canceled', async () => {
		const openFile = vi.fn().mockResolvedValue(null);
		const extractWaveform = vi.fn();

		vi.stubGlobal('window', {
			electronAPI: {
				openFile,
				extractWaveform
			}
		});

		await projectState.browseForSourceFile();

		expect(openFile).toHaveBeenCalledOnce();
		expect(extractWaveform).not.toHaveBeenCalled();
		expect(projectState.project).toBeNull();
	});
});
