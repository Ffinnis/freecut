<script lang="ts">
	import { projectState } from '$lib/stores/project.svelte';
	import { uiState } from '$lib/stores/ui.svelte';
	import type { IntensityPreset } from '$lib/types/project';

	const presets: IntensityPreset[] = ['no-cuts', 'natural', 'fast', 'super'];
	const labels = ['No cuts', 'Natural', 'Fast', 'Super'];

	let sliderValue = $derived(presets.indexOf(projectState.settings.intensity));

	function onIntensityInput(e: Event) {
		const idx = parseInt((e.target as HTMLInputElement).value);
		const preset = presets[idx];
		projectState.applyIntensityPreset(preset);
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
	<div class="action-row">
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
		<button class="gear-btn" aria-label="Settings">
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<circle cx="12" cy="12" r="3" />
				<path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
			</svg>
		</button>
	</div>

	<button class="customize-toggle" onclick={() => uiState.showCustomize = !uiState.showCustomize}>
		Customize {uiState.showCustomize ? 'v' : '>'}
	</button>

	<div class="section">
		<h3>Intensity</h3>
		<p class="description">How tight or loose to make the cuts.</p>
		<div class="intensity-slider">
			<input
				type="range"
				min="0"
				max="3"
				step="1"
				value={sliderValue}
				oninput={onIntensityInput}
			/>
			<div class="intensity-labels">
				{#each labels as label, i}
					<span class:active={i === sliderValue}>{label}</span>
				{/each}
			</div>
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
			<input
				type="text"
				class="threshold-value"
				value={projectState.settings.thresholdValue.toFixed(5)}
				disabled={projectState.settings.thresholdAuto}
				onchange={onThresholdNumber}
			/>
		</div>
		<input
			type="range"
			class="threshold-slider"
			min="0"
			max="1"
			step="0.001"
			value={projectState.settings.manualThresholdValue}
			disabled={projectState.settings.thresholdAuto}
			oninput={onThresholdInput}
		/>
	</div>
</div>

<style>
	.silence-tab {
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.action-row {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.remove-btn {
		flex: 1;
		padding: 0.5rem 1rem;
		background: var(--text-primary);
		color: var(--bg-primary);
		border: none;
		border-radius: var(--radius-sm);
		font-size: 0.8125rem;
		font-weight: 600;
		font-family: var(--font-sans);
		cursor: pointer;
		transition: opacity 0.15s;
	}

	.remove-btn:hover {
		opacity: 0.9;
	}

	.remove-btn.active-toggle {
		background: var(--accent);
		color: white;
	}

	.remove-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.gear-btn {
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
		cursor: pointer;
		transition: background 0.15s;
	}

	.gear-btn:hover {
		background: var(--border);
	}

	.customize-toggle {
		background: none;
		border: none;
		color: var(--text-secondary);
		font-size: 0.75rem;
		font-family: var(--font-sans);
		cursor: pointer;
		text-align: right;
		padding: 0;
	}

	.customize-toggle:hover {
		color: var(--text-primary);
	}

	.section {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	h3 {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.description {
		font-size: 0.6875rem;
		color: var(--text-muted);
	}

	.intensity-slider {
		margin-top: 0.5rem;
	}

	.intensity-slider input[type='range'] {
		width: 100%;
		-webkit-appearance: none;
		appearance: none;
		height: 4px;
		background: var(--border);
		border-radius: 2px;
		outline: none;
	}

	.intensity-slider input[type='range']::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: var(--text-primary);
		cursor: pointer;
	}

	.intensity-labels {
		display: flex;
		justify-content: space-between;
		margin-top: 0.375rem;
	}

	.intensity-labels span {
		font-size: 0.6875rem;
		color: var(--text-muted);
		transition: color 0.15s;
	}

	.intensity-labels span.active {
		color: var(--text-primary);
		font-weight: 600;
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
	}

	.threshold-value:disabled {
		opacity: 0.5;
	}

	.threshold-slider {
		width: 100%;
		-webkit-appearance: none;
		appearance: none;
		height: 4px;
		background: var(--border);
		border-radius: 2px;
		outline: none;
		margin-top: 0.25rem;
	}

	.threshold-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: var(--text-primary);
		cursor: pointer;
	}

	.threshold-slider:disabled {
		opacity: 0.5;
	}

	.threshold-slider:disabled::-webkit-slider-thumb {
		cursor: default;
	}
</style>
