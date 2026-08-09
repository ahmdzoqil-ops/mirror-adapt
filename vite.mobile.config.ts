/**
 * إعداد بناء مستقل لنسخة أندرويد (Capacitor).
 * ينتج ملفات ثابتة في dist-mobile دون أي تعديل على بناء الويب.
 */
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  build: {
    outDir: "dist-mobile",
    emptyOutDir: true,
    rollupOptions: { input: fileURLToPath(new URL("./index.mobile.html", import.meta.url)) },
  },
});
