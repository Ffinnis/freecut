/** @type {import('electron-builder').Configuration} */
const config = {
	appId: 'com.freecut.app',
	productName: 'free-cut',
	directories: {
		output: 'release'
	},
	files: [
		'dist/**/*',
		'build/**/*',
		'node_modules/**/*'
	],
	asarUnpack: [
		'node_modules/ffmpeg-static/**'
	],
	publish: [{
		provider: 'github',
		owner: 'Ffinnis',
		repo: 'freecut'
	}],
	mac: {
		target: ['dmg', 'zip'],
		category: 'public.app-category.video'
	}
};

export default config;
