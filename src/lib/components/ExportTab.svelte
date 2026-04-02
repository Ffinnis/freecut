<script lang="ts">
	import { projectState } from '$lib/stores/project.svelte';
	import { exportState } from '$lib/stores/export.svelte';
	import type { ExportFormat, VideoQuality } from '$lib/types/ipc';

	const VIDEO_FORMATS: ExportFormat[] = ['mp4', 'mov'];
	const AUDIO_FORMATS: ExportFormat[] = ['wav', 'mp3'];
	const EDITOR_FORMATS: ExportFormat[] = ['fcpxml', 'edl'];

	const FORMAT_LABELS: Record<ExportFormat, string> = {
		mp4: 'MP4', mov: 'MOV', wav: 'WAV', mp3: 'MP3',
		fcpxml: 'FCP XML', edl: 'EDL'
	};

	const FORMAT_EXTENSIONS: Record<ExportFormat, { name: string; extensions: string[] }[]> = {
		mp4: [{ name: 'MP4 Video', extensions: ['mp4'] }],
		mov: [{ name: 'MOV Video', extensions: ['mov'] }],
		wav: [{ name: 'WAV Audio', extensions: ['wav'] }],
		mp3: [{ name: 'MP3 Audio', extensions: ['mp3'] }],
		fcpxml: [{ name: 'FCP XML', extensions: ['fcpxml'] }],
		edl: [{ name: 'Edit Decision List', extensions: ['edl'] }]
	};

	const QUALITY_LABELS: { value: VideoQuality; label: string }[] = [
		{ value: 'low', label: 'Low' },
		{ value: 'medium', label: 'Medium' },
		{ value: 'high', label: 'High' },
		{ value: 'original', label: 'Original' }
	];

	const FRAMERATES = [23.976, 24, 25, 29.97, 30, 59.94, 60];

	const isVideoFormat = $derived(VIDEO_FORMATS.includes(exportState.selectedFormat));
	const isEditorFormat = $derived(EDITOR_FORMATS.includes(exportState.selectedFormat));
	const needsQuality = $derived(isVideoFormat || exportState.selectedFormat === 'mp3');

	function getKeptSegments(): { start: number; end: number }[] {
		if (!projectState.project) return [];
		return projectState.project.segments
			.filter((s) => s.action === 'keep')
			.map((s) => ({ start: s.start, end: s.end }));
	}

	async function selectFormat(format: ExportFormat) {
		exportState.selectedFormat = format;
		exportState.exportError = null;

		if (!projectState.project) return;

		const probeResult = await projectState.ensureProbeForCurrentProject();
		if (probeResult?.fps) {
			const closest = FRAMERATES.reduce((prev, curr) =>
				Math.abs(curr - probeResult.fps) < Math.abs(prev - probeResult.fps) ? curr : prev
			);
			exportState.selectedFramerate = closest;
		}

		exportState.uiState = 'settings';
	}

	function goBack() {
		exportState.uiState = 'grid';
		exportState.exportError = null;
	}

	async function startExport() {
		if (!projectState.project) return;

		const segments = getKeptSegments();
		if (segments.length === 0) {
			exportState.exportError = 'No segments to export — all content is removed.';
			return;
		}

		const sourceName = projectState.project.sourceFile.split('/').pop()?.replace(/\.[^.]+$/, '') ?? 'export';
		const ext = exportState.selectedFormat === 'fcpxml' ? 'fcpxml' : exportState.selectedFormat;
		const defaultName = `${sourceName}_cut.${ext}`;

		const savePath = await window.electronAPI.saveFile(defaultName, FORMAT_EXTENSIONS[exportState.selectedFormat]);
		if (!savePath) return;

		exportState.outputPath = savePath;
		exportState.uiState = 'exporting';
		exportState.progress = { percent: 0, timeRemaining: null };
		exportState.exportError = null;

		exportState.progressCleanup = window.electronAPI.onExportProgress((p) => {
			exportState.progress = p;
		});

		try {
			const result = await window.electronAPI.startExport({
				sourceFile: projectState.project.sourceFile,
				segments,
				format: exportState.selectedFormat,
				outputPath: savePath,
				quality: needsQuality ? exportState.selectedQuality : undefined,
				framerate: isEditorFormat ? exportState.selectedFramerate : undefined
			});

			exportState.cleanupProgress();

			if (result.success) {
				exportState.progress = { percent: 100, timeRemaining: 0 };
				exportState.uiState = 'done';
			} else {
				exportState.exportError = result.error ?? 'Export failed';
				exportState.uiState = 'settings';
			}
		} catch (err) {
			exportState.cleanupProgress();
			exportState.exportError = (err as Error).message;
			exportState.uiState = 'settings';
		}
	}

	async function handleCancel() {
		await window.electronAPI.cancelExport();
		exportState.cleanupProgress();
		exportState.uiState = 'grid';
	}

	function openFile() {
		if (exportState.outputPath) window.electronAPI.shellOpenPath(exportState.outputPath);
	}

	function showInFolder() {
		if (exportState.outputPath) window.electronAPI.shellShowInFolder(exportState.outputPath);
	}

	function exportAnother() {
		exportState.reset();
	}

	function formatTime(seconds: number | null): string {
		if (seconds === null) return '...';
		if (seconds < 60) return `0:${String(Math.round(seconds)).padStart(2, '0')}`;
		const m = Math.floor(seconds / 60);
		const s = Math.round(seconds % 60);
		return `${m}:${String(s).padStart(2, '0')}`;
	}
</script>

<div class="export-tab">
	{#if !projectState.hasProject}
		<p class="empty">Load a file to export</p>

	{:else if exportState.uiState === 'grid'}
		<div class="section">
			<h3>Video / Audio</h3>
			<div class="format-grid">
				{#each [...VIDEO_FORMATS, ...AUDIO_FORMATS] as fmt}
					<button class="format-btn" onclick={() => selectFormat(fmt)}>{FORMAT_LABELS[fmt]}</button>
				{/each}
			</div>
		</div>
		<div class="section">
			<h3>Editor Project</h3>
			<div class="format-grid">
				{#each EDITOR_FORMATS as fmt}
					<button class="format-btn" onclick={() => selectFormat(fmt)}>{FORMAT_LABELS[fmt]}</button>
				{/each}
			</div>
		</div>

	{:else if exportState.uiState === 'settings'}
		<div class="settings-header">
			<button class="back-btn" onclick={goBack} aria-label="Back to format selection">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<polyline points="15 18 9 12 15 6" />
				</svg>
			</button>
			<h3>Export {FORMAT_LABELS[exportState.selectedFormat]}</h3>
		</div>

		{#if projectState.probeLoading && !projectState.probeResult}
			<p class="probing">Analyzing source...</p>
		{:else}
			{#if needsQuality}
				<div class="section">
					<span class="label">Quality</span>
					<div class="quality-grid">
						{#each QUALITY_LABELS as q}
							<button
								class="quality-btn"
								class:active={exportState.selectedQuality === q.value}
								onclick={() => exportState.selectedQuality = q.value}
							>{q.label}</button>
						{/each}
					</div>
				</div>
			{/if}

			{#if isEditorFormat}
				<div class="section">
					<label class="label" for="framerate-select">Framerate</label>
					<select id="framerate-select" class="framerate-select" bind:value={exportState.selectedFramerate}>
						{#each FRAMERATES as fps}
							<option value={fps}>{fps} fps</option>
						{/each}
					</select>
				</div>
			{/if}

			{#if exportState.exportError}
				<p class="error">{exportState.exportError}</p>
			{/if}

			<button class="export-btn" onclick={startExport}>Export</button>
		{/if}

	{:else if exportState.uiState === 'exporting'}
		<div class="progress-section">
			<h3>Exporting {FORMAT_LABELS[exportState.selectedFormat]}...</h3>
			<div class="progress-bar">
				<div class="progress-fill" style="width: {exportState.progress.percent}%"></div>
			</div>
			<div class="progress-info">
				<span>{exportState.progress.percent}%</span>
				<span>~{formatTime(exportState.progress.timeRemaining)} remaining</span>
			</div>
			<button class="cancel-btn" onclick={handleCancel}>Cancel</button>
		</div>

	{:else if exportState.uiState === 'done'}
		<div class="done-section">
			<div class="done-icon">
				<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
					<polyline points="22 4 12 14.01 9 11.01" />
				</svg>
			</div>
			<h3>Export complete</h3>
			<div class="done-actions">
				<button class="link-btn" onclick={openFile}>Open file</button>
				<button class="link-btn" onclick={showInFolder}>Show in folder</button>
			</div>
			<button class="export-btn secondary" onclick={exportAnother}>Export another</button>
		</div>
	{/if}
</div>

<style>
	.export-tab {
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.empty {
		color: var(--text-muted);
		font-size: 0.8125rem;
		text-align: center;
		margin-top: 2rem;
	}

	.section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	h3 {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin: 0;
	}

	.format-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.375rem;
	}

	.format-btn {
		padding: 0.5rem;
		background: var(--bg-surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
		font-size: 0.75rem;
		font-family: var(--font-sans);
		cursor: pointer;
		transition: background 0.15s, border-color 0.15s;
	}

	.format-btn:hover {
		background: var(--bg-elevated);
		border-color: var(--border-hover);
		color: var(--text-primary);
	}

	/* Settings header */
	.settings-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.settings-header h3 {
		text-transform: none;
		letter-spacing: normal;
		font-size: 0.875rem;
		color: var(--text-primary);
	}

	.back-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		background: none;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
		cursor: pointer;
		transition: background 0.15s;
	}

	.back-btn:hover {
		background: var(--bg-surface);
		color: var(--text-primary);
	}

	.probing {
		color: var(--text-muted);
		font-size: 0.8125rem;
	}

	.label {
		font-size: 0.6875rem;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	/* Quality grid */
	.quality-grid {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr 1fr;
		gap: 0.25rem;
	}

	.quality-btn {
		padding: 0.375rem 0.25rem;
		background: var(--bg-surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
		font-size: 0.6875rem;
		font-family: var(--font-sans);
		cursor: pointer;
		transition: all 0.15s;
	}

	.quality-btn:hover {
		border-color: var(--border-hover);
		color: var(--text-primary);
	}

	.quality-btn.active {
		background: var(--accent);
		border-color: var(--accent);
		color: white;
	}

	/* Framerate select */
	.framerate-select {
		padding: 0.375rem 0.5rem;
		background: var(--bg-surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		color: var(--text-primary);
		font-size: 0.8125rem;
		font-family: var(--font-sans);
	}

	/* Export button */
	.export-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.625rem 1rem;
		background: var(--accent);
		border: none;
		border-radius: var(--radius-sm);
		color: white;
		font-size: 0.8125rem;
		font-weight: 600;
		font-family: var(--font-sans);
		cursor: pointer;
		transition: opacity 0.15s;
	}

	.export-btn:hover {
		opacity: 0.9;
	}

	.export-btn.secondary {
		background: var(--bg-surface);
		border: 1px solid var(--border);
		color: var(--text-primary);
	}

	.export-btn.secondary:hover {
		background: var(--bg-elevated);
	}

	/* Progress */
	.progress-section {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.progress-section h3 {
		text-transform: none;
		letter-spacing: normal;
		font-size: 0.875rem;
		color: var(--text-primary);
	}

	.progress-bar {
		height: 6px;
		background: var(--bg-surface);
		border-radius: 3px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: var(--accent);
		border-radius: 3px;
		transition: width 0.3s ease;
	}

	.progress-info {
		display: flex;
		justify-content: space-between;
		font-size: 0.6875rem;
		color: var(--text-muted);
	}

	.cancel-btn {
		padding: 0.5rem 1rem;
		background: var(--bg-surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		color: #ff6b6b;
		font-size: 0.8125rem;
		font-weight: 600;
		font-family: var(--font-sans);
		cursor: pointer;
		transition: background 0.15s;
	}

	.cancel-btn:hover {
		background: var(--bg-elevated);
	}

	/* Done */
	.done-section {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		padding-top: 1rem;
	}

	.done-icon {
		color: #4ade80;
	}

	.done-section h3 {
		text-transform: none;
		letter-spacing: normal;
		font-size: 0.875rem;
		color: var(--text-primary);
	}

	.done-actions {
		display: flex;
		gap: 1rem;
	}

	.link-btn {
		background: none;
		border: none;
		color: var(--accent);
		font-size: 0.8125rem;
		font-family: var(--font-sans);
		cursor: pointer;
		text-decoration: underline;
		padding: 0;
	}

	.link-btn:hover {
		opacity: 0.8;
	}

	.error {
		color: #ff6b6b;
		font-size: 0.75rem;
		padding: 0.5rem;
		background: rgba(255, 107, 107, 0.1);
		border-radius: var(--radius-sm);
	}
</style>
