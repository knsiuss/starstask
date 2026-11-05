import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "id.starstask.mobile",
  appName: "StarsTask",
  webDir: "dist",
  android: {
    allowMixedContent: false,
  },
  ios: {
    contentInset: "always",
    backgroundColor: "#fafaf8",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: "#fafaf8",
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
