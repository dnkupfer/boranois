import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/migrate.ts", "src/analyse.ts"],
  format: "esm",
  target: "node22",
  platform: "node",
  // Bundle the workspace package; keep real npm deps external.
  noExternal: ["@boranois/shared"],
  clean: true,
});
