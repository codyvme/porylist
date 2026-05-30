import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.png", "apple-touch-icon.png"],
      manifest: {
        name: "Porylist",
        short_name: "Porylist",
        description:
          "Pokémon reference and playthrough companion — Pokédex, moves, abilities, items, team builder, breeding tracker, and route encounter tables.",
        theme_color: "#0d1721",
        background_color: "#0d1721",
        display: "standalone",
        scope: "/",
        start_url: "/",
        orientation: "portrait",
        icons: [
          { src: "/icon-192.png",          sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icon-512.png",          sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Precache the app shell + the small top-level JSON files we read at
        // runtime. The per-entity /data/pokemon, /data/ability, /data/item …
        // directories are build pipeline artifacts (compiled into the bundled
        // pokemon-summary.json), not runtime-fetched, so they're skipped.
        globPatterns: [
          "assets/**/*.{js,css,woff2}",
          "*.{html,ico,png,svg,webmanifest}",
          "data/moves.json",
          "data/abilities.json",
          "data/items.json",
          "data/version-exclusives.json",
          "data/route-data/*.json",
        ],
        // Generous per-file cap so the larger bundled JS chunks fit.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        // SPA: any navigation falls back to index.html
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/data\//, /^\/api\//],
        runtimeCaching: [
          // PokéAPI — stale-while-revalidate so the app stays usable offline
          {
            urlPattern: /^https:\/\/pokeapi\.co\/api\/v2\//,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "pokeapi",
              expiration: { maxEntries: 1000, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // jsDelivr PokéAPI sprites — cache-first, they never change for a given URL
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/gh\/PokeAPI\/sprites/,
            handler: "CacheFirst",
            options: {
              cacheName: "pokeapi-sprites",
              expiration: { maxEntries: 2000, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // jsDelivr PokéAPI cries
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/gh\/PokeAPI\/cries/,
            handler: "CacheFirst",
            options: {
              cacheName: "pokeapi-cries",
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Type icons + any other jsDelivr-hosted asset
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\//,
            handler: "CacheFirst",
            options: {
              cacheName: "jsdelivr-misc",
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Google Fonts CSS + WOFF2
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "google-fonts-stylesheets",
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-files",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        enabled: false, // keep dev server zippy; preview/production has PWA
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
