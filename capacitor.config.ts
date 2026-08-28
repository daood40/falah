import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.falah.studio',
  appName: 'فلاح',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
};

export default config;
