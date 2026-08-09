// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

// بناء نسخة Android (Capacitor) يحتاج ملف index.html ثابت، لذلك نفعّل وضع SPA
// فقط عند تعيين MOBILE_BUILD=1 — بناء الويب يبقى كما هو تمامًا.
const mobileBuild = process.env["MOBILE_BUILD"] === "1";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    ...(mobileBuild
      ? { spa: { enabled: true, prerender: { outputPath: "/index.html" } } }
      : {}),
  },
  vite: {
    plugins: [
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: null,
        filename: "sw.js",
        devOptions: { enabled: false },
        manifest: false,
        workbox: {
          navigateFallbackDenylist: [/^\/~oauth/, /^\/api\//],
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
          runtimeCaching: [
            {
              urlPattern: ({ request }: { request: Request }) => request.mode === "navigate",
              handler: "NetworkFirst",
              options: { cacheName: "pages", networkTimeoutSeconds: 3 },
            },
            {
              urlPattern: ({ url, request }: { url: URL; request: Request }) =>
                url.origin === self.location.origin &&
                ["script", "style", "font", "image"].includes(request.destination),
              handler: "CacheFirst",
              options: {
                cacheName: "assets",
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 60 },
              },
            },
          ],
        },
      }),
    ],
  },
});
