import { describe, it, expect, beforeEach } from 'vitest';
import { historyState } from './history.svelte';
import type { Segment } from '$lib/types/project';

function seg(start: number, end: number): Segment {
	return { id: `s:${start}-${end}`, start, end, type: 'speech', action: 'keep' };
}

function segs(...pairs: [number, number][]): Segment[] {
	return pairs.map(([s, e]) => seg(s, e));
}

describe('HistoryState', () => {
	beforeEach(() => {
		historyState.clear();
	});

	it('starts empty', () => {
		expect(historyState.canUndo).toBe(false);
		expect(historyState.canRedo).toBe(false);
	});

	it('pushSnapshot enables undo', () => {
		historyState.pushSnapshot(segs([0, 1]));
		expect(historyState.canUndo).toBe(true);
		expect(historyState.canRedo).toBe(false);
	});

	it('undo returns the previous snapshot', () => {
		const before = segs([0, 1]);
		const after = segs([0, 2]);
		historyState.pushSnapshot(before);
		const result = historyState.undo(after);
		expect(result).toEqual(before);
	});

	it('undo enables redo', () => {
		historyState.pushSnapshot(segs([0, 1]));
		historyState.undo(segs([0, 2]));
		expect(historyState.canRedo).toBe(true);
	});

	it('redo returns the snapshot that was undone', () => {
		const before = segs([0, 1]);
		const after = segs([0, 2]);
		historyState.pushSnapshot(before);
		historyState.undo(after);
		const result = historyState.redo(before);
		expect(result).toEqual(after);
	});

	it('push clears redo stack', () => {
		historyState.pushSnapshot(segs([0, 1]));
		historyState.undo(segs([0, 2]));
		expect(historyState.canRedo).toBe(true);
		historyState.pushSnapshot(segs([0, 3]));
		expect(historyState.canRedo).toBe(false);
	});

	it('undo on empty stack returns null', () => {
		expect(historyState.undo(segs([0, 1]))).toBeNull();
	});

	it('redo on empty stack returns null', () => {
		expect(historyState.redo(segs([0, 1]))).toBeNull();
	});

	it('respects max stack depth', () => {
		for (let i = 0; i < 60; i++) {
			historyState.pushSnapshot(segs([0, i]));
		}
		let undoCount = 0;
		while (historyState.canUndo) {
			historyState.undo(segs([0, 99]));
			undoCount++;
		}
		expect(undoCount).toBe(50);
	});

	it('clear resets both stacks', () => {
		historyState.pushSnapshot(segs([0, 1]));
		historyState.undo(segs([0, 2]));
		historyState.clear();
		expect(historyState.canUndo).toBe(false);
		expect(historyState.canRedo).toBe(false);
	});

	it('snapshots are independent copies', () => {
		const original = segs([0, 1]);
		historyState.pushSnapshot(original);
		original[0].end = 999;
		const result = historyState.undo(segs([0, 2]));
		expect(result![0].end).toBe(1);
	});

	describe('drag coalescing', () => {
		it('startDrag saves one snapshot and suppresses further pushes', () => {
			const before = segs([0, 1]);
			historyState.startDrag(before);
			historyState.pushSnapshot(segs([0, 1.1]));
			historyState.pushSnapshot(segs([0, 1.2]));
			historyState.pushSnapshot(segs([0, 1.3]));
			historyState.endDrag();

			expect(historyState.canUndo).toBe(true);
			const result = historyState.undo(segs([0, 1.3]));
			expect(result).toEqual(before);
			expect(historyState.canUndo).toBe(false);
		});

		it('endDrag re-enables normal pushSnapshot', () => {
			historyState.startDrag(segs([0, 1]));
			historyState.endDrag();
			historyState.pushSnapshot(segs([0, 2]));
			historyState.pushSnapshot(segs([0, 3]));
			let undoCount = 0;
			while (historyState.canUndo) {
				historyState.undo(segs([0, 99]));
				undoCount++;
			}
			expect(undoCount).toBe(3);
		});
	});
});
