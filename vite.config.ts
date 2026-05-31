import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" makes the build work under a project page path
// (https://<user>.github.io/<repo>/) as well as a user/org page or a
// custom domain, without hardcoding the repo name. If you deploy to a
// project page and assets 404, set base to "/<repo-name>/" explicitly.
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "dist",
    sourcemap: false,
    target: "es2020",
  },
});
