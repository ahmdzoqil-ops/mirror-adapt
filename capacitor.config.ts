import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.daftari.app",
  appName: "دفتري",
  webDir: "dist-mobile",
  android: {
    allowMixedContent: true,
  },
};

export default config;
