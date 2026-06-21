import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-vite-plugin";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    TanStackRouterVite({
      routesDirectory: "./src/routes",
      generatedRouteTree: "./src/routeTree.gen.ts"
    })
  ],
  resolve: {
    alias: {
      "@localmind/registry-schema": path.resolve(__dirname, "../../packages/registry-schema/src/index.ts"),
      "@localmind/shared-types": path.resolve(__dirname, "../../packages/shared-types/src/index.ts")
    }
  },
  server: {
    port: 5173
  }
});
