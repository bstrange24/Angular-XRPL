// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
     plugins: [
          {
               name: 'suppress-external-warnings',
               configureServer(server) {
                    server.middlewares.use((req, res, next) => {
                         res.setHeader('x-vite-suppress-warnings', 'util,stream,buffer,process');
                         next();
                    });
               },
          },
     ],
     resolve: {
          alias: {
               buffer: 'buffer',
               util: 'util',
               stream: 'stream-browserify',
               process: 'process/browser', // Use process/browser for polyfill
          },
     },
     optimizeDeps: {
          include: ['buffer', 'util', 'stream-browserify', 'process'],
     },
     define: {
          'global.Buffer': 'buffer.Buffer',
          'process.env': '{}', // Provide empty process.env
          'global.process': 'process', // Ensure process is globally available
     },
});
