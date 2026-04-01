import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jane.lotterygenerator',
  appName: '彩票助手',
  webDir: 'dist',
  plugins: {
    StatusBar: {
      overlaysWebView: true
    },
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    }
  }
};

export default config;
