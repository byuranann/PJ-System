import { defineConfig } from 'vite';

export default defineConfig({
  base: "/PJ-System/",
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false
  }
});
