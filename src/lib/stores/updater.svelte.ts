type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error';

class UpdaterState {
	status = $state<UpdateStatus>('idle');
	availableVersion = $state<string | null>(null);
	downloadPercent = $state(0);
	errorMessage = $state<string | null>(null);

	get visible() {
		return this.status === 'available' || this.status === 'downloading' || this.status === 'ready';
	}

	init() {
		if (typeof window === 'undefined' || !window.electronAPI?.onUpdateAvailable) return;

		window.electronAPI.onUpdateAvailable((info) => {
			this.status = 'available';
			this.availableVersion = info.version;
		});

		window.electronAPI.onUpdateDownloadProgress((progress) => {
			this.status = 'downloading';
			this.downloadPercent = progress.percent;
		});

		window.electronAPI.onUpdateDownloaded(() => {
			this.status = 'ready';
		});

		window.electronAPI.onUpdateError((error) => {
			this.status = 'error';
			this.errorMessage = error.message;
		});
	}

	checkForUpdate() {
		this.status = 'checking';
		window.electronAPI?.checkForUpdate();
	}

	downloadUpdate() {
		this.status = 'downloading';
		this.downloadPercent = 0;
		window.electronAPI?.downloadUpdate();
	}

	installUpdate() {
		window.electronAPI?.installUpdate();
	}

	dismiss() {
		this.status = 'idle';
		this.availableVersion = null;
		this.downloadPercent = 0;
		this.errorMessage = null;
	}
}

export const updaterState = new UpdaterState();
