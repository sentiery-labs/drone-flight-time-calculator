import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    rollupOptions: {
      input: {
        calculator: fileURLToPath(new URL("./index.html", import.meta.url)),
        advanced: fileURLToPath(new URL("./advanced.html", import.meta.url))
      }
    }
  }
});
