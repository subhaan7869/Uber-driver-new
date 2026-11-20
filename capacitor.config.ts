import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.uberdriver.uk',
  appName: 'Uber Driver',
  webDir: 'dist',
  android: {
    backgroundColor: '#000000',
    allowMixedContent: false,
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
