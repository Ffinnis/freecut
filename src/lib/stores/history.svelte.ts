import type { Segment } from '$lib/types/project';

const MAX_STACK_DEPTH = 50;

class HistoryState {
	undoStack = $state<Segment[][]>([]);
	redoStack = $state<Segment[][]>([]);
	isDragging = $state(false);

	get canUndo(): boolean {
		return this.undoStack.length > 0;
	}

	get canRedo(): boolean {
		return this.redoStack.length > 0;
	}

	pushSnapshot(segments: Segment[]): void {
		if (this.isDragging) return;
		const snapshot = segments.map((s) => ({ ...s }));
		this.undoStack = [...this.undoStack.slice(-(MAX_STACK_DEPTH - 1)), snapshot];
		this.redoStack = [];
	}

	undo(currentSegments: Segment[]): Segment[] | null {
		if (this.undoStack.length === 0) return null;
		const next = [...this.undoStack];
		const snapshot = next.pop()!;
		this.undoStack = next;
		this.redoStack = [...this.redoStack, currentSegments.map((s) => ({ ...s }))];
		return snapshot;
	}

	redo(currentSegments: Segment[]): Segment[] | null {
		if (this.redoStack.length === 0) return null;
		const next = [...this.redoStack];
		const snapshot = next.pop()!;
		this.redoStack = next;
		this.undoStack = [...this.undoStack, currentSegments.map((s) => ({ ...s }))];
		return snapshot;
	}

	startDrag(segments: Segment[]): void {
		const snapshot = segments.map((s) => ({ ...s }));
		this.undoStack = [...this.undoStack.slice(-(MAX_STACK_DEPTH - 1)), snapshot];
		this.redoStack = [];
		this.isDragging = true;
	}

	endDrag(): void {
		this.isDragging = false;
	}

	clear(): void {
		this.undoStack = [];
		this.redoStack = [];
		this.isDragging = false;
	}
}

export const historyState = new HistoryState();
