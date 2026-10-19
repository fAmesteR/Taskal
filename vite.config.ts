import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const REQUIRED_ENV = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
];

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  // Fail the production build if the Firebase config is missing. Without this,
  // `vite build` succeeds, gets deployed, and the live site is a blank page.
  if (command === "build") {
    const env = loadEnv(mode, process.cwd(), "VITE_");
    const missing = REQUIRED_ENV.filter((k) => !env[k]);
    if (missing.length) {
      throw new Error(
        `Missing ${missing.join(", ")}. Create .env from .env.example ` +
          `(Firebase console > Project settings > Your apps) before building.`,
      );
    }
  }

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(
      Boolean,
    ),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
