import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  cacheDir: `.cache/vite-${process.env.VITE_CACHE_KEY ?? 'development'}`,
  plugins: [svelte()],
  build: { target: 'es2022', assetsInlineLimit: 0 },
  worker: { format: 'es' },
});
