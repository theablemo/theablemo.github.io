import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://theablemo.github.io",
  output: "static",
  // Polling also catches new/deleted content in restricted or synced folders.
  vite: { server: { watch: { usePolling: true, useFsEvents: false, interval: 300 } } },
  trailingSlash: "always",
  devToolbar: { enabled: false },
});
