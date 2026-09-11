import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Every shipped dep, pre-bundled up front. Vite discovers deps lazily, so the first
  // import outside the initial graph would trigger a re-optimize + reload mid-session.
  optimizeDeps: {
    include: [
      "@base-ui/react/button",
      "@base-ui/react/checkbox",
      "@base-ui/react/dialog",
      "@base-ui/react/input",
      "@base-ui/react/menu",
      "@base-ui/react/merge-props",
      "@base-ui/react/popover",
      "@base-ui/react/select",
      "@base-ui/react/tabs",
      "@base-ui/react/use-render",
      "@tanstack/react-query",
      "class-variance-authority",
      "clsx",
      "date-fns",
      "lucide-react",
      "motion/react",
      "next-themes",
      "react",
      "react-day-picker",
      "react-dom/client",
      "react-is",
      "react-router-dom",
      "recharts",
      "sonner",
      "tailwind-merge",
    ],
  },
  server: {
    host: true,
    port: 3000,
    // The /api proxy convention: frontend code calls relative /api/*, never an
    // absolute backend URL. Target is the FastAPI dev server running locally.
    proxy: {
      "/api": {
        target: "http://localhost:8001",
        changeOrigin: true,
      },
    },
  },
});
