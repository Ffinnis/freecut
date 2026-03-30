import { DEFAULT_SETTINGS, type Project, type DetectionSettings } from '$lib/types/project';

class ProjectState {
	project = $state<Project | null>(null);
	settings = $state<DetectionSettings>({ ...DEFAULT_SETTINGS });
	isLoading = $state(false);

	get hasProject() {
		return this.project !== null;
	}

	get totalDuration() {
		return this.project?.duration ?? 0;
	}

	get silenceDuration() {
		if (!this.project) return 0;
		return this.project.segments
			.filter((s) => s.type === 'silence' && s.action === 'remove')
			.reduce((sum, s) => sum + (s.end - s.start), 0);
	}

	get cutCount() {
		if (!this.project) return 0;
		return this.project.segments.filter((s) => s.type === 'silence' && s.action === 'remove')
			.length;
	}

	reset() {
		this.project = null;
		this.settings = { ...DEFAULT_SETTINGS };
		this.isLoading = false;
	}
}

export const projectState = new ProjectState();
