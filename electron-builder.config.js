/** @type {import('electron-builder').Configuration} */
const config = {
	appId: 'com.freecut.app',
	productName: 'free-cut',
	directories: {
		output: 'release'
	},
	files: [
		'dist/**/*',
		'build/**/*'
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
		category: 'public.app-category.video',
		icon: 'resources/icon.icns'
	}
};

export default config;
