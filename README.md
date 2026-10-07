# Taxora Auth

Standalone sign-up / sign-in app for Taxora, built with Vite, Firebase Authentication and Cloud Firestore, deployed on Cloudflare Workers (static assets).

## What it does

- **Sign up** with full name, email and password (validated in the browser, enforced again by Firebase and Firestore rules)
- **Sign in** with "keep me signed in" (device-wide session) or a tab-only session
- **Forgot password** email flow
- **Email confirmation** banner with resend (60-second cooldown) and re-check
- **Protected dashboard** showing the user's Firestore profile; signing out in one tab signs out every tab
- **Firestore profile** at `users/{uid}`: `uid`, `fullName`, `email`, `emailVerified`, `createdAt`, `lastLoginAt`
- If the profile can't be saved during sign-up, the new Auth account is deleted so no half-created accounts remain
- Security headers (CSP, HSTS, no framing) via `public/_headers`

## Project structure

```
index.html            Sign in + reset password
signup.html           Create account
dashboard.html        Protected account page
src/firebase.js       Firebase init (reads VITE_* env vars)
src/services/auth.js  Sign up, sign in, sign out, profile, verification, reset
src/services/session.js  Route guards
src/lib/validation.js Form rules
src/lib/errors.js     Firebase error codes -> plain messages
src/lib/ui.js         Form validator, alerts, busy buttons, show/hide password
src/pages/*.js        One script per page
src/styles.css        All styling (light + dark)
firestore.rules       Database security rules
wrangler.jsonc        Cloudflare Workers deploy config
public/_headers       Cloudflare security + cache headers
```

## 1. Firebase setup (one time)

1. Firebase Console → your project (default in `.firebaserc`: `taxora-547ee`; change it if you use a new project).
2. **Authentication → Sign-in method →** enable **Email/Password**.
3. **Firestore Database →** create database (production mode, region `asia-south1` Mumbai).
4. **Firestore → Rules →** paste the contents of `firestore.rules` → **Publish**.
   (Or from the terminal: `npm run deploy:rules`.)
5. **Project settings → General → Your apps →** add a **Web app** if none exists, and copy its config values.
6. After deploying, add your Cloudflare domain (e.g. `taxora-auth.<your-subdomain>.workers.dev`) under **Authentication → Settings → Authorized domains**.

## 2. Run locally

```bash
npm install
cp .env.example .env      # Windows PowerShell: copy .env.example .env
# fill in the six VITE_FIREBASE_* values
npm run dev               # http://localhost:5173
```

## 3. Push to GitHub

Create an empty repository on GitHub (no README), then:

```bash
git init
git add .
git commit -m "Taxora auth: sign up, sign in, Firestore profiles"
git branch -M main
git remote add origin https://github.com/Sangam-Info/taxora-auth.git
git push -u origin main
```

`.env` is git-ignored, so your keys never reach GitHub.

## 4. Deploy on Cloudflare Workers

`wrangler.jsonc` is already set up: `wrangler deploy` builds the site and uploads `dist/` as static assets.

1. Cloudflare dashboard → **Workers & Pages → Create → Import a repository** → pick `taxora-auth`.
2. Make sure the Worker name matches `"name"` in `wrangler.jsonc` (default `taxora-auth`).
3. **Settings → Build:**
   - Build command: `npm run build` (optional; the deploy step builds too)
   - Deploy command: `npx wrangler deploy`
   - Root directory: `/`
4. **Settings → Build → Variables and secrets:** add all six `VITE_FIREBASE_*` values from your `.env`.
   These must be **build** variables; Vite bakes them in at build time.
5. Push to `main` (or click **Retry deployment**). Every push redeploys automatically.

Then add the `*.workers.dev` URL Cloudflare gives you under Firebase **Authentication → Settings → Authorized domains**.

Manual deploy from your PC: `npx wrangler login`, then `npm run deploy`.

## Notes

- Firebase web config values are not secrets; access is protected by Firebase Auth and `firestore.rules`.
- Turn on **email enumeration protection** (Authentication → Settings) if your project doesn't have it on already.
- The brand name lives in the HTML files and `src/styles.css` comment; search for `Taxora` to rename.
