import { defineConfig } from 'vite';

/**
 * Vite configuration.
 *
 * `base: './'` makes every asset URL relative, so the built site works when
 * hosted from a sub-path such as GitHub Pages (https://user.github.io/repo/).
 */
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
          mediapipe: ['@mediapipe/tasks-vision'],
        },
      },
    },
  },
  server: {
    host: true,
  },
});
