import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";

// Stamps a unique BUILD_ID into public/sw.js on each production build so a
// new service worker is detected by browsers and silently activated.
function swBuildIdPlugin(): Plugin {
  const buildId = Date.now().toString(36);
  return {
    name: "pt-sw-build-id",
    apply: "build",
    closeBundle() {
      const out = path.resolve(__dirname, "dist/sw.js");
      try {
        if (fs.existsSync(out)) {
          const src = fs.readFileSync(out, "utf8");
          fs.writeFileSync(out, src.replace(/__BUILD_ID__/g, buildId));
        }
      } catch { /* ignore */ }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger(), swBuildIdPlugin()].filter(Boolean),

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: "es2020",
    cssCodeSplit: true,
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "query": ["@tanstack/react-query"],
          "supabase": ["@supabase/supabase-js"],
          "pdf": ["jspdf", "jspdf-autotable"],
          "xlsx": ["xlsx"],
          "charts": ["recharts"],
          "ui-radix": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-popover",
            "@radix-ui/react-select",
            "@radix-ui/react-tabs",
            "@radix-ui/react-tooltip",
          ],
        },
      },
    },
  },
}));
