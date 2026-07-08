import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

// Dev: `npm run dev` here + `npm start` at the repo root (API on :3000).
// Prod: `npm run build` -> Express automatically serves web/dist.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
      "/deploy": "http://localhost:3000",
      "/health": "http://localhost:3000"
    }
  },
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ["three", "@react-three/fiber"],
          motion: ["framer-motion"]
        }
      }
    }
  }
})
