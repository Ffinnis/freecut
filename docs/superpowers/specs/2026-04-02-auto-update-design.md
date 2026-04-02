# Auto-Update via GitHub Releases

## Context

free-cut is distributed as a macOS DMG. Users currently have no way to know when a new version is available and must manually check for updates. This adds `electron-updater` to check GitHub Releases for new versions and notify users within the app.

## Decisions

- **Update library:** `electron-updater` (from electron-builder ecosystem)
- **Update source:** GitHub Releases on `Ffinnis/freecut`
- **UX model:** Notify + manual download + prompt restart. No silent installs.
- **Platform:** macOS only (ZIP target required for electron-updater, DMG kept for manual downloads)
- **Code signing:** Already configured (Apple Developer ID + notarization)

## Architecture

### New file: `electron/updater.ts`

Encapsulates all auto-update logic. Follows the same module pattern as `electron/export.ts` and `electron/probe.ts`.

Responsibilities:
- Initialize `autoUpdater` from `electron-updater` with GitHub provider config
- Check for updates on app launch (after a short delay to not block startup)
- Disable auto-download (user must opt in)
- Forward update events to the renderer via IPC:
  - `update:available` — `{ version: string, releaseNotes: string }`
  - `update:not-available` — no new version
  - `update:download-progress` — `{ percent: number }`
  - `update:downloaded` — ready to install
  - `update:error` — `{ message: string }`
- Handle IPC requests from renderer:
  - `update:check` — manually trigger a check
  - `update:download` — start downloading the update
  - `update:install` — quit and install

### Changes to `electron/preload.ts`

Add update methods to `electronAPI`:

```ts
checkForUpdate: () => ipcRenderer.invoke('update:check'),
downloadUpdate: () => ipcRenderer.invoke('update:download'),
installUpdate: () => ipcRenderer.invoke('update:install'),
onUpdateAvailable: (cb) => { /* IPC listener, returns cleanup fn */ },
onUpdateDownloadProgress: (cb) => { /* IPC listener, returns cleanup fn */ },
onUpdateDownloaded: (cb) => { /* IPC listener, returns cleanup fn */ },
onUpdateError: (cb) => { /* IPC listener, returns cleanup fn */ },
```

Follows the existing listener pattern (e.g., `onWaveformChunk`, `onExportProgress`).

### Changes to `electron/main.ts`

- Import and call `initUpdater(mainWindow)` inside `app.whenReady()`, after `registerIpcHandlers()`
- No other changes to main.ts

### New file: `src/lib/stores/updater.svelte.ts`

Reactive store for update state. Tracks:
- `status`: `'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error'`
- `availableVersion`: string | null
- `downloadPercent`: number
- `errorMessage`: string | null

Exposes actions: `checkForUpdate()`, `downloadUpdate()`, `installUpdate()`, `dismiss()`

### New component: `src/lib/components/UpdateNotification.svelte`

Small notification bar that appears at the top of the app when an update is available. States:

1. **Available:** "Update v{version} available" + [Download] button + [x] dismiss
2. **Downloading:** "Downloading update..." + progress bar showing percent
3. **Ready:** "Update ready" + [Restart] button
4. **Error:** "Update check failed" + [x] dismiss (non-blocking, silent)

Styling: subtle bar at the top of `.app-shell`, above the titlebar drag area. Uses existing CSS variables (`--bg-surface`, `--text-secondary`, `--accent`). Does not shift the layout significantly.

### Changes to `src/lib/components/AppShell.svelte`

- Import `UpdateNotification`
- Render `<UpdateNotification />` at the top of both `.app-shell.has-project` and `.app-shell.empty` layouts

### Changes to `electron-builder.config.js`

```js
publish: [{
  provider: 'github',
  owner: 'Ffinnis',
  repo: 'freecut'
}],
mac: {
  target: ['dmg', 'zip'],
  category: 'public.app-category.video'
}
```

### New dependency

```
pnpm add electron-updater
```

`electron-updater` is a runtime dependency (not devDependency) because it runs in the packaged app's main process.

## Update Flow

```
App launches
  -> 3s delay (don't block startup)
  -> autoUpdater.checkForUpdates()
  -> GitHub API: latest release tag vs package.json version
    -> No update: done (silent)
    -> Update found: IPC 'update:available' { version, releaseNotes }
      -> Renderer shows notification bar
      -> User clicks "Download"
        -> IPC 'update:download'
        -> autoUpdater.downloadUpdate()
        -> Progress events -> renderer updates bar
        -> Download complete -> IPC 'update:downloaded'
        -> User clicks "Restart"
          -> IPC 'update:install'
          -> autoUpdater.quitAndInstall()
```

## Release Workflow

1. Bump version in `package.json`
2. `pnpm package` (builds DMG + ZIP with update metadata)
3. Create GitHub Release with tag matching the version (e.g., `v0.2.0`)
4. Upload the built artifacts from `release/` to the GitHub Release
   - Or use `pnpm package -- -p always` to auto-publish (requires `GH_TOKEN`)

## Dev Mode Behavior

`electron-updater` skips update checks when `app.isPackaged === false`. No special handling needed — updates only run in production builds.

## Files to Create/Modify

| File | Action |
|------|--------|
| `electron/updater.ts` | Create |
| `electron/preload.ts` | Modify — add update API methods |
| `electron/main.ts` | Modify — import and init updater |
| `src/lib/stores/updater.svelte.ts` | Create |
| `src/lib/components/UpdateNotification.svelte` | Create |
| `src/lib/components/AppShell.svelte` | Modify — add UpdateNotification |
| `electron-builder.config.js` | Modify — add publish + zip target |
| `package.json` | Modify — add electron-updater dependency |

## Verification

1. `pnpm build` — confirm TypeScript compiles cleanly
2. `pnpm check` — Svelte type checking passes
3. `pnpm dev` — app launches without errors (updater silently skips in dev)
4. `pnpm package` — builds DMG + ZIP, `release/` contains both artifacts plus `latest-mac.yml`
5. Create a test GitHub Release with a higher version number, run the packaged app, confirm it detects the update and shows the notification
