import { defineConfig,loadEnv } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { locationLookupPlugin } from './api/location-handler';
import { resolveBuildRevision } from './scripts/build-revision';

export default defineConfig(({mode})=>({
  cacheDir: `.cache/vite-${process.env.VITE_CACHE_KEY ?? 'development'}`,
  plugins: [svelte(),locationLookupPlugin()],
  server: { watch: { ignored: ['**/.cache/**','**/release/**','**/test-results/**','**/playwright-report/**','**/dist/**'] } },
  define: { 'import.meta.env.VITE_BUILD_REVISION':JSON.stringify(resolveBuildRevision(process.cwd(),process.env.VITE_BUILD_REVISION??loadEnv(mode,process.cwd(),'VITE_').VITE_BUILD_REVISION)) },
  build: { target: 'es2022', assetsInlineLimit: 0 },
  worker: { format: 'es' },
}));
