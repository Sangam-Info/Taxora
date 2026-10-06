# Authentication Project — Sign Up & Sign In

A clean, minimal authentication foundation built with **HTML/CSS/JavaScript**, **Node.js + Express**, and **Firebase Authentication + Firestore**.

It does exactly four things: **Sign Up**, **Sign In**, **Logout**, and a **protected Dashboard**. Nothing else, so it can be extended safely later.

---

## 1. Project overview

| Flow | What happens |
|---|---|
| Sign Up | Firebase Auth creates the user → basic profile saved to Firestore `users/{uid}` → user is signed out → redirected to Sign In with a success message |
| Sign In | Firebase Auth checks email/password → redirected to Dashboard |
| Dashboard | Shows `Welcome, [Name]`. Hidden until Firebase confirms a signed-in user; otherwise redirects to `/signin` |
| Logout | Firebase `signOut()` → redirected to Sign In |

Passwords are handled **only** by Firebase Authentication. They are never stored in Firestore or anywhere else.

## 2. Technologies used

- Frontend: HTML, CSS, vanilla JavaScript (ES modules)
- Firebase Web SDK v10 (modular), loaded from Google's CDN — no frontend build step
- Backend: Node.js + Express (serves the app with clean URLs and basic security headers)
- Database: Cloud Firestore
- Node.js **18 or newer** (20 LTS or 22 LTS recommended)

## 3. Folder structure

```text
authentication-project/
├── public/                 # Everything the browser loads
│   ├── index.html          # Sign In page   → /signin
│   ├── signup.html         # Sign Up page   → /signup
│   ├── dashboard.html      # Protected page → /dashboard
│   ├── css/style.css
│   └── js/
│       ├── config.js       # ← YOUR Firebase web config goes here
│       ├── firebase.js     # Initialises Firebase (Auth + Firestore)
│       ├── ui.js           # Validation helpers, loading states, error messages
│       ├── auth.js         # Sign In + Sign Up logic
│       └── dashboard.js    # Route guard, welcome name, logout
├── server/
│   └── server.js           # Express server
├── firestore.rules         # Firestore security rules (paste into Firebase Console)
├── .env.example            # Environment variables template
├── .gitignore
├── package.json
└── README.md
```

## 4. Firebase project setup

1. Go to <https://console.firebase.google.com> → **Add project** → give it a name → create it (Google Analytics is optional).
2. In the project, click the **Web** icon (`</>`) under "Get started by adding Firebase to your app".
3. Register the app with any nickname. Do **not** enable Firebase Hosting (not needed).
4. Firebase shows a `firebaseConfig` object. Keep this tab open — you need it in step 7.

## 5. Enable Email/Password Authentication

1. Firebase Console → **Build → Authentication** → **Get started**.
2. **Sign-in method** tab → **Email/Password** → turn on **Enable** (leave "Email link" off) → **Save**.
3. **Settings → Authorized domains**: `localhost` is included by default. When you deploy, add your real domain here.

## 6. Create Firestore

1. Firebase Console → **Build → Firestore Database** → **Create database**.
2. Choose a location close to your users (e.g. `asia-south1` for India). This cannot be changed later.
3. Start in **production mode**.
4. Open the **Rules** tab, replace everything with the contents of `firestore.rules`, and click **Publish**.

### What the rules do

- A signed-in user can **read** only `users/{their own uid}`.
- A user can **create** only their own document, only with the fields `uid`, `name`, `email`, `createdAt`. The email must match their Firebase Auth email, `createdAt` must be the server time, and a `password` field is impossible to write.
- A user can **update** only their own `name`.
- **Delete** is blocked, and **every other path in the database is closed**.

The key check is `request.auth.uid == userId`: Firestore compares the logged-in user's ID with the document ID they are trying to access.

## 7. Add your Firebase configuration

Open `public/js/config.js` and replace every `REPLACE_WITH_...` value with the values from step 4.

**Are these values secret?** No. The web `firebaseConfig` (apiKey, authDomain, projectId, etc.) only identifies your Firebase project. Google designs it to be public, and it is visible in every Firebase web app. Your data is protected by **Authentication + Firestore Rules**, not by hiding this config.

**What must stay private:** service-account JSON files / Firebase Admin SDK private keys. This project does not use them. Never put them in `public/`, never commit them (`.gitignore` already blocks common filenames).

Until the config is filled in, the pages show: *"Firebase is not configured yet."*

## 8. Install dependencies

```bash
cd authentication-project
npm install
```

## 9. Run the project

```bash
cp .env.example .env     # Windows: copy .env.example .env
npm start
```

Open <http://localhost:3000>. To use another port, change `PORT` in `.env`.

For auto-restart while editing server code: `npm run dev`.

## 10. Test Sign Up

1. Open <http://localhost:3000/signup>.
2. Submit empty → each field shows its own error.
3. Enter mismatched passwords → "Passwords do not match."
4. Enter valid details → button shows "Creating account..." → you land on Sign In with "Account created successfully."
5. Check Firebase Console → **Authentication → Users** (user exists) and **Firestore → users** (document with `uid`, `name`, `email`, `createdAt`, and **no password**).
6. Sign up again with the same email → "An account with this email already exists."

## 11. Test Sign In

1. Wrong password or unknown email → "Invalid email or password." (the same message for both, so nobody can probe which emails exist)
2. Correct credentials → button shows "Signing in..." → Dashboard shows "Welcome, [Your Name]".
3. Refresh the Dashboard → you stay signed in (Firebase keeps the session in the browser).

## 12. Test Logout

1. Click **Logout** → you return to Sign In.
2. Type <http://localhost:3000/dashboard.html> (or `/dashboard`) in the address bar → you are redirected to `/signin`.

## 13. How protected routes work

- `dashboard.html` starts with `class="is-guarded"`, which hides the content.
- `dashboard.js` uses Firebase's `onAuthStateChanged`. If there is no user, it redirects to `/signin`. If there is a user, it loads their name from Firestore and reveals the page.
- The page's HTML is a public file, but it contains **no user data**. The real protection is server-side in **Firestore Rules**: even if someone bypasses the redirect, Firestore refuses to return any user's data without a valid signed-in session for that exact user.
- Signed-in users who open Sign In or Sign Up are sent straight to the Dashboard.

## 14. Security considerations

- Passwords are handled only by Firebase Authentication (hashed by Google). Never stored in Firestore.
- No Firebase Admin credentials exist in this project.
- `.env` is git-ignored; only `.env.example` is committed.
- Inputs are validated on the client; Firestore Rules validate again on the server (field whitelist, name length, email match).
- User data is written into the page with `textContent`, so names are never interpreted as HTML (prevents XSS).
- Raw Firebase errors are mapped to friendly messages; technical details never reach the UI.
- If the Firestore profile write fails after the Auth account is created, the Auth account is deleted again so the user can simply retry.
- Express sends `X-Content-Type-Options`, `X-Frame-Options: DENY`, and `Referrer-Policy` headers and hides `X-Powered-By`.
- Firebase requires passwords of at least 6 characters. For stronger rules, configure a **Password policy** in Authentication → Settings.

## 15. Common errors and solutions

| Problem | Fix |
|---|---|
| "Firebase is not configured yet." | Fill in `public/js/config.js` (step 7). |
| "Sign-in is not set up correctly yet." | Email/Password provider is not enabled (step 5), or the API key / config is wrong. Open the browser console (F12) for the exact code. |
| Sign Up shows "Something went wrong" / profile not saved | Firestore was not created, or the rules from `firestore.rules` were not published (step 6). |
| Name shows as your email on the Dashboard | The Firestore `users/{uid}` document is missing or rules are blocking the read. Re-publish the rules. |
| Blank page / module errors in console | Open the site via `npm start` (http://localhost:3000), not by double-clicking the HTML file. ES modules do not work from `file://`. |
| `auth/unauthorized-domain` after deploying | Add your domain in Authentication → Settings → Authorized domains. |
| "Too many attempts" | Firebase temporarily throttles repeated failed logins. Wait a few minutes. |
| `EADDRINUSE: port 3000` | Another app uses port 3000. Change `PORT` in `.env`. |
| `npm` / `node` not found | Install Node.js 20 LTS from <https://nodejs.org>. |
