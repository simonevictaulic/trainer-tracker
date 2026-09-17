import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// IMPORTANT: change "trainer-tracker" below to your actual GitHub repo
// name. GitHub Pages serves project sites at
// https://<you>.github.io/<repo-name>/, so this must match exactly
// (including case) or assets will 404 on the deployed site.
export default defineConfig({
  plugins: [react()],
  base: "/trainer-tracker/",
});
