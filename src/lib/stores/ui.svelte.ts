class UIState {
	activeTab = $state<'silence' | 'sections' | 'export'>('silence');
	isPlaying = $state(false);
	currentTime = $state(0);
	sourceFps = $state<number | null>(null);
	requestedSeekTime = $state(0);
	seekRequestId = $state('');
	zoomFraction = $state(0);
	timelineScrollX = $state(0);
	viewportWidth = $state(1500);
	showCustomize = $state(false);
	selectedSegmentId = $state<string | null>(null);
	silenceRemoved = $state(false);
	playbackRate = $state(1);

	get formattedTimecode(): string {
		const total = Math.floor(this.currentTime);
		const h = Math.floor(total / 3600);
		const m = Math.floor((total % 3600) / 60);
		const s = total % 60;
		const fps = this.sourceFps && this.sourceFps > 0 ? this.sourceFps : null;
		const maxFrame = fps ? Math.max(0, Math.ceil(fps) - 1) : 0;
		const frameDigits = Math.max(2, String(maxFrame).length);
		const f = fps ? Math.min(Math.floor((this.currentTime - total) * fps), maxFrame) : 0;
		return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(f).padStart(frameDigits, '0')}`;
	}

	setPlaybackState(next: boolean) {
		this.isPlaying = next;
	}

	togglePlayback() {
		this.isPlaying = !this.isPlaying;
	}

	setCurrentTime(next: number) {
		this.currentTime = Number.isFinite(next) && next >= 0 ? next : 0;
	}

	setPlaybackTime(next: number, duration = Number.POSITIVE_INFINITY) {
		const safeDuration = Number.isFinite(duration) && duration >= 0 ? duration : 0;
		const clamped = Math.min(Math.max(next, 0), safeDuration);
		this.setCurrentTime(clamped);
	}

	setSourceFps(next: number | null) {
		this.sourceFps = Number.isFinite(next) && (next ?? 0) > 0 ? next : null;
	}

	requestSeek(next: number, duration = Number.POSITIVE_INFINITY) {
		const safeDuration = Number.isFinite(duration) && duration >= 0 ? duration : 0;
		const clamped = Math.min(Math.max(next, 0), safeDuration);
		this.requestedSeekTime = clamped;
		this.setCurrentTime(clamped);
		this.seekRequestId = crypto.randomUUID();
	}

	toggleSilenceRemoved() {
		this.silenceRemoved = !this.silenceRemoved;
	}

	setPlaybackRate(rate: number) {
		this.playbackRate = Math.min(Math.max(rate, 0.25), 8);
	}

	resetPlayback() {
		this.isPlaying = false;
		this.currentTime = 0;
		this.requestedSeekTime = 0;
		this.seekRequestId = crypto.randomUUID();
		this.silenceRemoved = false;
		this.playbackRate = 1;
	}

	selectSegment(segmentId: string | null) {
		this.selectedSegmentId = segmentId;
	}
}

export const uiState = new UIState();

// --- Zoom math (pure functions) ---

export function computePps(zoomFraction: number, viewportWidth: number, duration: number): number {
	if (duration <= 0) return 1;
	const minPps = viewportWidth / (4 * duration);
	const maxPps = viewportWidth / 4;
	if (minPps >= maxPps) return minPps;
	return minPps * Math.pow(maxPps / minPps, zoomFraction);
}

export function computeContentWidth(pps: number, duration: number, viewportWidth: number): number {
	const rulerTimeSpan = Math.max(duration, viewportWidth / pps);
	return rulerTimeSpan * pps;
}

export function computeRulerTimeSpan(pps: number, duration: number, viewportWidth: number): number {
	return Math.max(duration, viewportWidth / pps);
}

export function timeToPixel(time: number, pps: number): number {
	return time * pps;
}

export function pixelToTime(px: number, pps: number): number {
	return px / pps;
}
