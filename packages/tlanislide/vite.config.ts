import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/Tlanislide.tsx'),
      name: 'TLAniSlide',
      fileName: 'tlanislide',
    },
    rollupOptions: {
      external: ['react', 'react-dom'],
    },
  }
})
