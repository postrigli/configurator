import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

import commonjs from 'vite-plugin-commonjs';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: '/configurator/',
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(), 
        tailwindcss(),
        commonjs(),
        nodePolyfills({
          include: ['buffer', 'stream', 'zlib', 'util'],
        })
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      optimizeDeps: {
        include: ['@react-pdf/renderer']
      },
      build: {
        outDir: 'dist',
        assetsDir: '',
        commonjsOptions: {
          transformMixedEsModules: true
        },
        rollupOptions: {
          output: {
            entryFileNames: 'configurator.js',
            chunkFileNames: 'chunks/[name].js',
            assetFileNames: (assetInfo) => {
              if (assetInfo.name && assetInfo.name.endsWith('.css')) {
                return 'configurator.css';
              }
              return '[name].[ext]';
            }
          }
        }
      }
    };
});
