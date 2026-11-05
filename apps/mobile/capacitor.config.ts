import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "id.starstask.mobile",
  appName: "StarsTask",
  webDir: "dist",
  ios: {
    minimumVersion: "15.0",
    deploymentTarget: "15.0",
    contentInset: "always",
    allowsInlineMediaPlayback: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1000,
      launchAutoHide: true,
    },
  },
};

export default config;
