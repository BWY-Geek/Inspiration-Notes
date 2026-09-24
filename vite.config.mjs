import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // 打包后主进程用 file:// 加载，必须用相对路径
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: 'index.html',
        quick: 'quick.html',
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
})
