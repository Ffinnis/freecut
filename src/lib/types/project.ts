export interface Project {
	id: string;
	sourceFile: string;
	duration: number;
	sampleRate: number;
	segments: Segment[];
	settings: DetectionSettings;
}

export interface Segment {
	id: string;
	start: number;
	end: number;
	type: 'speech' | 'silence';
	action: 'keep' | 'remove' | 'speed';
	speedMultiplier?: number;
}

export type IntensityPreset = 'no-cuts' | 'natural' | 'fast' | 'super';

export interface DetectionSettings {
	intensity: IntensityPreset;
	thresholdAuto: boolean;
	thresholdValue: number;
	minSilenceDuration: number;
	paddingBefore: number;
	paddingAfter: number;
}

export const INTENSITY_PRESETS: Record<
	IntensityPreset,
	{ minSilenceDuration: number; paddingBefore: number; paddingAfter: number }
> = {
	'no-cuts': { minSilenceDuration: 99999, paddingBefore: 200, paddingAfter: 200 },
	natural: { minSilenceDuration: 800, paddingBefore: 200, paddingAfter: 200 },
	fast: { minSilenceDuration: 400, paddingBefore: 100, paddingAfter: 100 },
	super: { minSilenceDuration: 200, paddingBefore: 50, paddingAfter: 50 }
};

export const DEFAULT_SETTINGS: DetectionSettings = {
	intensity: 'fast',
	thresholdAuto: true,
	thresholdValue: 0.032,
	minSilenceDuration: 400,
	paddingBefore: 100,
	paddingAfter: 100
};
