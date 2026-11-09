import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cs8079.banwutong',
  appName: '班务通',
  webDir: 'dist',
  backgroundColor: '#f2f0e9',
  android: {
    allowMixedContent: false,
    backgroundColor: '#f2f0e9',
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
