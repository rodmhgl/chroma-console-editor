/// <reference types="vite-plugin-pwa/client" />

/** package.json's version, injected by Vite. */
declare const __APP_VERSION__: string;

/** File System Access API folder picker (Chrome, Edge); not yet in TypeScript's DOM lib. */
interface Window {
  showDirectoryPicker(options?: { id?: string; mode?: 'read' | 'readwrite' }): Promise<FileSystemDirectoryHandle>;
}

/** File System Access API permissions (Chrome, Edge); not yet in TypeScript's DOM lib. */
interface FileSystemHandle {
  queryPermission(options?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission(options?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
}
