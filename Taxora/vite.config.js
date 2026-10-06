import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const root = import.meta.dirname;
const cleanPages = { signup: 'signup.html', dashboard: 'dashboard.html' };

// Lets /signup and /dashboard work locally, matching Cloudflare Pages' clean URLs.
function cleanUrls() {
  const rewrite = (req, _res, next) => {
    const [path, query] = req.url.split('?');
    const page = cleanPages[path.replace(/^\/|\/$/g, '')];
    if (page) req.url = `/${page}${query ? `?${query}` : ''}`;
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
        main: resolve(root, 'index.html'),
        signup: resolve(root, 'signup.html'),
        dashboard: resolve(root, 'dashboard.html'),
      },
    },
  },
});
