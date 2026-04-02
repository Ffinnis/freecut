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
		category: 'public.app-category.video',
		icon: 'build/icons/icon.icns'
	},
	win: {
		icon: 'build/icons/icon.ico'
	},
	linux: {
		icon: 'build/icons/icon.png'
	}
};

export default config;
