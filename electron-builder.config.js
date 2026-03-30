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
	mac: {
		target: ['dmg'],
		category: 'public.app-category.video'
	}
};

export default config;
