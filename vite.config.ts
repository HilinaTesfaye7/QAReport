import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import fs from 'node:fs'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'sync-projects-api',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/api/projects' && req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => { body += chunk; });
            req.on('end', () => {
              try {
                const projects = JSON.parse(body);
                const projectsPath = path.resolve(process.cwd(), 'projects.json');
                const publicProjectsPath = path.resolve(process.cwd(), 'public', 'projects.json');
                
                fs.writeFileSync(projectsPath, JSON.stringify(projects, null, 2), 'utf8');
                fs.writeFileSync(publicProjectsPath, JSON.stringify(projects, null, 2), 'utf8');

                // If any project has assigned member Coco ('usr-347835367'), also update telegram_profiles if needed
                const profilesFile = path.resolve(process.cwd(), 'telegram_profiles.json');
                if (fs.existsSync(profilesFile)) {
                  try {
                    const profiles = JSON.parse(fs.readFileSync(profilesFile, 'utf8'));
                    if (profiles['347835367']) {
                      // Find most recent project assigned to Coco
                      const cocoProjects = projects.filter((p: any) => 
                        p.memberIds && (p.memberIds.includes('usr-347835367') || p.memberIds.includes('usr-coco'))
                      );
                      if (cocoProjects.length > 0) {
                        const latest = cocoProjects[cocoProjects.length - 1];
                        profiles['347835367'].assignedProjectIds = cocoProjects.map((p: any) => p.id);
                        profiles['347835367'].assignedProjects = cocoProjects.map((p: any) => p.name);
                        fs.writeFileSync(profilesFile, JSON.stringify(profiles, null, 2), 'utf8');
                        fs.writeFileSync(path.resolve(process.cwd(), 'public', 'telegram_profiles.json'), JSON.stringify(profiles, null, 2), 'utf8');
                      }
                    }
                  } catch (e) {
                    console.error('Error updating telegram_profiles:', e);
                  }
                }

                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, count: projects.length }));
              } catch (e: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: e?.message }));
              }
            });
            return;
          }

          if (req.url === '/api/projects' && req.method === 'GET') {
            const projectsPath = path.resolve(process.cwd(), 'projects.json');
            const publicProjectsPath = path.resolve(process.cwd(), 'public', 'projects.json');
            for (const file of [projectsPath, publicProjectsPath]) {
              if (fs.existsSync(file)) {
                res.setHeader('Content-Type', 'application/json');
                res.end(fs.readFileSync(file, 'utf8'));
                return;
              }
            }
          }

          next();
        });
      },
    },
  ],
})
