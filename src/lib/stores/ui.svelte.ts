class UIState {
	activeTab = $state<'silence' | 'sections' | 'export'>('silence');
	isPlaying = $state(false);
	currentTime = $state(0);
	zoomFraction = $state(0);
	timelineScrollX = $state(0);
	viewportWidth = $state(1500);
	showCustomize = $state(false);

	get formattedTimecode(): string {
		const total = Math.floor(this.currentTime);
		const h = Math.floor(total / 3600);
		const m = Math.floor((total % 3600) / 60);
		const s = total % 60;
		const f = Math.floor((this.currentTime - total) * 30);
		return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
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
