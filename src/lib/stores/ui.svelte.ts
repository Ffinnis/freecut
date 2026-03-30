class UIState {
	activeTab = $state<'silence' | 'sections' | 'export'>('silence');
	isPlaying = $state(false);
	currentTime = $state(0);
	zoomLevel = $state(1);
	timelineScrollX = $state(0);
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
