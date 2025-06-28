// vite.config.ts
import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill';
import { NodeModulesPolyfillPlugin } from '@esbuild-plugins/node-modules-polyfill';

export default defineConfig({
     plugins: [
          angular(),
          NodeGlobalsPolyfillPlugin({
               buffer: true,
               process: true,
          }),
          NodeModulesPolyfillPlugin(),
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
               util: 'util/',
               stream: 'stream-browserify',
               buffer: 'buffer',
               crypto: 'crypto-browserify',
               process: 'process/browser',
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
