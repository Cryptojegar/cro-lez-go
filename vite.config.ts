import { defineConfig, loadEnv, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
// @ts-expect-error plain JS module shared with the production server
import { createApiHandler } from "./server/api.mjs";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    {
      // Same /api as production (server.mjs); secrets come from a git-ignored .env.local
      name: "audits-api",
      configureServer(server: ViteDevServer) {
        server.middlewares.use(createApiHandler({ ...process.env, ...loadEnv(mode, process.cwd(), "") }));
      },
    },
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
