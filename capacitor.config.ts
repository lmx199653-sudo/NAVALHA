import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.navalhapro.oficial',
  appName: 'NAVALHA PRO',
  webDir: 'dist',
  server: {
    url: 'https://pronavalha.lovable.app',
    cleartext: false,
    androidScheme: 'https'
  }
};

export default config;
