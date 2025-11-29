import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lyricsensei.app',
  appName: 'Lyric Sensei',
  webDir: 'dist/public',
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#7c3aed",
      showSpinner: false,
    },
    SpeechRecognition: {
      language: 'en-US',
      maxResults: 5,
      popup: true,
      partialResults: true,
    },
    GoogleAuth: {
      clientId: process.env.ANDROID_GOOGLE_CLIENT_ID || '281268228006-dhr8pq76f13us6nh5er5r3djc0u0245o.apps.googleusercontent.com',
    },
  },
  server: {
    androidScheme: 'https',
    cleartext: true,
    allowNavigation: [
      'lyricsensei.com',
      'localhost',
      '127.0.0.1',
      '10.0.2.2'
    ]
  },
};

export default config;
