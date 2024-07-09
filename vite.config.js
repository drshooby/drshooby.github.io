import { defineConfig } from 'vite';

export default defineConfig({
    root: 'src',
    build: {
      outDir: '../dist',
    },
    assetsInclude: ['**/*.glb', '**/*.exr'],
    base: '/'
});