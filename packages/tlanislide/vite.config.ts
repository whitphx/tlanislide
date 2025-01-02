import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";
import path from "node:path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    dts({
      tsconfigPath: "./tsconfig.app.json",
    }),
  ],
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      name: "TLAniSlide",
      fileName: "tlanislide",
    },
    rollupOptions: {
      external: ["react", "react-dom", "tldraw"],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          tldraw: "tldraw",
        },
      },
    },
  },
});
