import { defineConfig } from "vitest/config";

/**
 * Next keeps `jsx: preserve` for the app build. Vitest has to transform JSX
 * itself, or importing a component fails before the test runs.
 */
export default defineConfig({
  oxc: { jsx: { runtime: "automatic" } },
  test: { environment: "node" },
});
