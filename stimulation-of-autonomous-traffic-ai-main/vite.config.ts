import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // Load env file from root
    const env = loadEnv(mode, process.cwd(), ''); 
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        // Adding || "" prevents the build from breaking if the key is missing
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || ""),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || "")
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      // Ensures the build works correctly for root-level files
      build: {
        outDir: 'dist',
        rollupOptions: {
          input: {
            main: path.resolve(__dirname, 'index.html'),
          },
        },
      },
    };
});
