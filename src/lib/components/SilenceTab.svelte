<script lang="ts">
	import { projectState } from '$lib/stores/project.svelte';
	import { uiState } from '$lib/stores/ui.svelte';
	import type { IntensityPreset } from '$lib/types/project';

	const presets: IntensityPreset[] = ['no-cuts', 'natural', 'fast', 'super'];
	const labels = ['No cuts', 'Natural', 'Fast', 'Super'];

	let sliderValue = $derived(presets.indexOf(projectState.settings.intensity));

	function selectPreset(idx: number) {
		projectState.applyIntensityPreset(presets[idx]);
	}

	function onThresholdInput(e: Event) {
		projectState.setManualThresholdValue(parseFloat((e.target as HTMLInputElement).value), { live: true });
	}

	function onThresholdNumber(e: Event) {
		const val = parseFloat((e.target as HTMLInputElement).value);
		if (!isNaN(val) && val >= 0 && val <= 1) {
			projectState.setManualThresholdValue(val);
		}
	}

	function onThresholdAutoChange(e: Event) {
		projectState.setThresholdAuto((e.target as HTMLInputElement).checked);
	}
</script>

<div class="silence-tab">
	<button
		class="remove-btn"
		class:active-toggle={uiState.silenceRemoved}
		disabled={!projectState.canDetectSilence}
		onclick={() => {
			if (projectState.cutCount === 0) {
				projectState.runSilenceDetection();
			}
			if (projectState.cutCount > 0) {
				uiState.toggleSilenceRemoved();
			}
		}}
	>
		{uiState.silenceRemoved ? 'Restore Timeline' : 'Remove Silence'}
	</button>

	<button
		class="customize-toggle"
		onclick={() => uiState.showCustomize = !uiState.showCustomize}
	>
		<span>Customize</span>
		<svg
			class="chevron"
			class:open={uiState.showCustomize}
			width="12"
			height="12"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<polyline points="9 18 15 12 9 6" />
		</svg>
	</button>

	{#if uiState.showCustomize}
		<div class="section">
			<h3>Intensity</h3>
			<p class="description">How tight or loose to make the cuts.</p>
			<div class="segmented-control">
				{#each labels as label, i}
					<button
						class="segment"
						class:active={i === sliderValue}
						onclick={() => selectPreset(i)}
					>
						{label}
					</button>
				{/each}
			</div>
		</div>

		<div class="section">
			<h3>Threshold</h3>
			<p class="description">Below this is considered silent.</p>
			<div class="threshold-controls">
				<label class="auto-check">
					<input
						type="checkbox"
						checked={projectState.settings.thresholdAuto}
						onchange={onThresholdAutoChange}
					/>
					Auto
				</label>
				{#if projectState.settings.thresholdAuto}
					<span class="threshold-detected">
						Detected: {projectState.settings.thresholdValue.toFixed(5)}
					</span>
				{:else}
					<input
						type="text"
						class="threshold-value"
						value={projectState.settings.thresholdValue.toFixed(5)}
						onchange={onThresholdNumber}
					/>
				{/if}
			</div>
			{#if !projectState.settings.thresholdAuto}
				<input
					type="range"
					class="threshold-slider"
					min="0"
					max="1"
					step="0.001"
					value={projectState.settings.manualThresholdValue}
					oninput={onThresholdInput}
				/>
			{/if}
		</div>
	{/if}
</div>

<style>
	.silence-tab {
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.remove-btn {
		width: 100%;
		padding: 0.625rem 1rem;
		background: var(--text-primary);
		color: var(--bg-primary);
		border: none;
		border-radius: var(--radius-md);
		font-size: 0.8125rem;
		font-weight: 600;
		font-family: var(--font-sans);
		cursor: pointer;
		transition: opacity 0.15s, background 0.15s, transform 0.1s;
	}

	.remove-btn:hover {
		opacity: 0.92;
	}

	.remove-btn:active {
		transform: scale(0.99);
	}

	.remove-btn.active-toggle {
		background: var(--accent);
		color: white;
	}

	.remove-btn:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.remove-btn:disabled:active {
		transform: none;
	}

	.customize-toggle {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		background: none;
		border: none;
		color: var(--text-secondary);
		font-size: 0.75rem;
		font-family: var(--font-sans);
		cursor: pointer;
		padding: 0.25rem 0;
	}

	.customize-toggle:hover {
		color: var(--text-primary);
	}

	.chevron {
		transition: transform 0.2s ease;
	}

	.chevron.open {
		transform: rotate(90deg);
	}

	.section {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	h3 {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-primary);
		letter-spacing: 0.01em;
	}

	.description {
		font-size: 0.6875rem;
		color: var(--text-muted);
	}

	.segmented-control {
		display: flex;
		background: var(--bg-input);
		border-radius: var(--radius-md);
		padding: 2px;
		gap: 2px;
		margin-top: 0.5rem;
	}

	.segment {
		flex: 1;
		padding: 0.375rem 0.25rem;
		background: transparent;
		border: none;
		border-radius: 6px;
		color: var(--text-muted);
		font-size: 0.6875rem;
		font-family: var(--font-sans);
		font-weight: 500;
		cursor: pointer;
		transition: background 0.15s, color 0.15s;
	}

	.segment:hover {
		color: var(--text-secondary);
	}

	.segment.active {
		background: var(--bg-elevated);
		color: var(--text-primary);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
	}

	.threshold-controls {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin-top: 0.25rem;
	}

	.auto-check {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.75rem;
		color: var(--text-secondary);
		cursor: pointer;
	}

	.auto-check input[type='checkbox'] {
		accent-color: var(--accent);
	}

	.threshold-detected {
		font-family: var(--font-mono);
		font-size: 0.6875rem;
		color: var(--text-muted);
	}

	.threshold-value {
		width: 72px;
		padding: 0.25rem 0.375rem;
		background: var(--bg-input);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		color: var(--text-primary);
		font-family: var(--font-mono);
		font-size: 0.6875rem;
		text-align: right;
		transition: border-color 0.15s;
	}

	.threshold-value:focus {
		border-color: var(--accent);
		outline: none;
	}

	.threshold-slider {
		width: 100%;
		-webkit-appearance: none;
		appearance: none;
		height: 4px;
		background: var(--border);
		border-radius: 2px;
		outline: none;
		margin-top: 0.375rem;
	}

	.threshold-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: var(--text-primary);
		cursor: pointer;
		transition: transform 0.1s;
	}

	.threshold-slider::-webkit-slider-thumb:hover {
		transform: scale(1.15);
	}
</style>
