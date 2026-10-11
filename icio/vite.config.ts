import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' keeps the built bundle portable: it can be served from a domain root
// (econlab/), from a sub-path, or opened from any static host without a rebuild.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: 'dist', assetsDir: 'assets', sourcemap: false },
})
