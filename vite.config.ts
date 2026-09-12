import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'sync-projects-api',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/api/ping' || req.url === '/api/health') {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ status: 'ok', service: 'AegisQA Vite Dev Server', timestamp: new Date().toISOString() }));
            return;
          }

          if (req.url && req.url.startsWith('/api/')) {
            const endpointPath = req.url.split('/api/')[1].split('?')[0]; // e.g. "projects" or "auth/login"
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', async () => {
              if (body) {
                try {
                  (req as any).body = JSON.parse(body);
                } catch (e) {
                  (req as any).body = {};
                }
              }
              
              try {
                // Dynamic import of the Vercel handler
                const modulePath = path.resolve(process.cwd(), 'api', `${endpointPath}.js`);
                if (!fs.existsSync(modulePath)) {
                   res.statusCode = 404;
                   res.setHeader('Content-Type', 'application/json');
                   res.end(JSON.stringify({ error: `API endpoint not found: ${endpointPath}` }));
                   return;
                }

                // Append cache bust to avoid Vite caching issues
                const fileUrl = url.pathToFileURL(modulePath).href + `?t=${Date.now()}`;
                const handler = await import(fileUrl);
                
                // Polyfill Vercel res methods
                (res as any).status = (code: number) => {
                  res.statusCode = code;
                  return res;
                };
                (res as any).json = (data: any) => {
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify(data));
                };
                
                await handler.default(req, res);
              } catch (e: any) {
                console.error(`Error in /api/${endpointPath}:`, e);
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: e?.message || 'Server error' }));
              }
            });
            return;
          }

          next();
        });
      },
    },
  ],
})
