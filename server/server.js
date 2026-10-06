import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PORT = Number(process.env.PORT) || 3000;

const app = express();
app.disable('x-powered-by');

// Basic security headers (no extra dependency needed)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Clean URLs for the three pages
const sendPage = (file) => (req, res) => res.sendFile(path.join(PUBLIC_DIR, file));
app.get('/', (req, res) => res.redirect('/signin'));
app.get('/signin', sendPage('index.html'));
app.get('/signup', sendPage('signup.html'));
app.get('/dashboard', sendPage('dashboard.html'));

// Static assets (css, js, and the .html files themselves)
app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));

// Anything else → sign in
app.use((req, res) => res.redirect('/signin'));

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
