import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.anshthegreat.basalt',
  appName: 'Basalt',
  // electron-forge's Vite plugin outputs the renderer here
  webDir: '.vite/renderer/main_window',
};

export default config;
