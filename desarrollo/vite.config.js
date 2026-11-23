import {defineConfig} from 'vite';
export default defineConfig({base:'./',build:{assetsInlineLimit:5000000,modulePreload:false,chunkSizeWarningLimit:1000,rollupOptions:{output:{inlineDynamicImports:true}}}});
