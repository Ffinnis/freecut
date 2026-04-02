import { beforeEach, describe, expect, it } from 'vitest';
import { uiState } from './ui.svelte';

describe('UIState formattedTimecode', () => {
	beforeEach(() => {
		uiState.setCurrentTime(0);
		uiState.setSourceFps(null);
	});

	it('uses the source fps for integer frame rates', () => {
		uiState.setSourceFps(60);
		uiState.setCurrentTime(3723.75);

		expect(uiState.formattedTimecode).toBe('01:02:03:45');
	});

	it('uses the source fps for fractional frame rates', () => {
		uiState.setSourceFps(23.976);
		uiState.setCurrentTime(1.5);

		expect(uiState.formattedTimecode).toBe('00:00:01:11');
	});

	it('falls back to zero frames when the source fps is unknown', () => {
		uiState.setCurrentTime(1.5);

		expect(uiState.formattedTimecode).toBe('00:00:01:00');
	});
});
