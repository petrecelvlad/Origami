# DB_Fix.md

## Identification of Current Implementation Issues

After scanning the codebase, the following issues were identified regarding persistence and IndexedDB usage:

1.  **Disconnected Logic**: The `usePersistence.ts` hook only handles manual file downloads/uploads (using `JSZip` and `Blob`) and **does not** utilize the `LocalVault` class in `src/infrastructure/local/LocalVault.ts`. The `LocalVault` class is completely unused in the UI/Application layer.
2.  **Lack of Autostart Hooks**: There is no mechanism in `useSimulationEngine` or the `App` component that triggers an auto-save or auto-load sequence.
3.  **No Persistence Loop**: No background task runs to periodically call `LocalVault.saveAllChampions()`.
4.  **No Boot-time Loading**: The application does not check IndexedDB upon initialization to restore the session from the last saved champion(s).

## Proposed Fixes
1.  **Refactor `usePersistence`**: Integrate `localVault` into `usePersistence.ts` to allow both manual and automatic saving.
2.  **Expose Vault Methods**: Update `usePersistence` to expose `loadLocalChampions` and `autosaveChampions` functions.
3.  **Implement Engine Integration**: Create a separate hook or extension for `SimulationEngine` that utilizes `usePersistence` to call the autosave function on a timer, and the load function on `useEffect` mount.
4.  **UI Feedback**: Add integration to `ToolDock` or `SettingsDrawer` to inform users about autosave state.
