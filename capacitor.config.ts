import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jane.lotterygenerator',
  appName: '彩票助手',
  webDir: 'dist',
  plugins: {
    StatusBar: {
      overlaysWebView: true
    }
  }
};

export default config;
