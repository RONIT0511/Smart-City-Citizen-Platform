import react from '@vitejs/plugin-react';

import tailwindcss from '@tailwindcss/vite';

import path from 'path';

import {
  defineConfig,
  loadEnv
} from 'vite';


export default defineConfig(
  ({ mode }) => {

    // Load Environment Variables
    const env = loadEnv(
      mode,
      process.cwd(),
      ''
    );

    return {

      // Plugins
      plugins: [
        react(),
        tailwindcss()
      ],


      // Environment Variables
      define: {

        'process.env.GEMINI_API_KEY':
          JSON.stringify(
            env.GEMINI_API_KEY
          ),

        'process.env.APP_URL':
          JSON.stringify(
            env.APP_URL
          ),

        'process.env.JWT_SECRET':
          JSON.stringify(
            env.JWT_SECRET
          ),
      },


      // Path Aliases
      resolve: {

        alias: {

          '@': path.resolve(
            __dirname,
            './src'
          ),
        },
      },


      // Development Server
      server: {

        host: '0.0.0.0',

        port: 5173,

        strictPort: true,

        open: false,

        hmr:
          process.env.DISABLE_HMR !==
          'true',
      },


      // Preview Server
      preview: {

        host: '0.0.0.0',

        port: 4173,
      },


      // Build Settings
      build: {

        outDir: 'dist',

        sourcemap: false,

        emptyOutDir: true,
      },


      // Optimize Dependencies
      optimizeDeps: {

        include: [
          'react',
          'react-dom',
          'react-router-dom',
          'leaflet',
          'react-leaflet',
          'lucide-react'
        ],
      },
    };
  }
);