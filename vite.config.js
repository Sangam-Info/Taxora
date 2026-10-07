import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const page = (file) => fileURLToPath(new URL(file, import.meta.url));
const cleanPages = { signup: 'signup.html', dashboard: 'dashboard.html', client: 'client.html' };

// Lets /signup, /dashboard and /client work locally, matching Cloudflare's clean URLs.
function cleanUrls() {
  const rewrite = (req, _res, next) => {
    const [path, query] = req.url.split('?');
    const target = cleanPages[path.replace(/^\/|\/$/g, '')];
    if (target) req.url = `/${target}${query ? `?${query}` : ''}`;
    next();
  };
  return {
    name: 'clean-urls',
    configureServer(server) {
      server.middlewares.use(rewrite);
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewrite);
    },
  };
}

export default defineConfig({
  plugins: [cleanUrls()],
  build: {
    target: 'es2022',
    // Firebase Auth + Firestore is ~150 KB gzipped; expected for this stack.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: {
        main: page('./index.html'),
        signup: page('./signup.html'),
        dashboard: page('./dashboard.html'),
        client: page('./client.html'),
      },
    },
  },
});
