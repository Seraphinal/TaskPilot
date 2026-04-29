import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  build: {
    outDir: 'dist-renderer',
  },
  server: {
    port: 5173,
    strictPort: true,
  },
})

