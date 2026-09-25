import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [svelte()],
  // Vitest/jsdom needs the Svelte SDK's browser entry: the package's
  // "svelte" condition points at a server module with no mount(). Vue's
  // package has no such split, so vue-sdk does not need this override.
  resolve: process.env.VITEST ? { conditions: ["browser"] } : undefined,
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.js"],
  },
});
