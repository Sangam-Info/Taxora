// Handles both the Sign In page (index.html) and the Sign Up page (signup.html).
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  deleteUser,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { auth, db, isConfigured } from './firebase.js';
import { EMAIL_PATTERN, setFieldError, clearErrors, showAlert, setLoading, friendlyAuthError } from './ui.js';

const signInForm = document.getElementById('signin-form');
const signUpForm = document.getElementById('signup-form');

// Prevents the "already signed in → go to dashboard" redirect from firing mid sign-up.
let signUpInProgress = false;

function warnIfNotConfigured(form) {
  if (!isConfigured) {
    showAlert(form, 'Firebase is not configured yet. Add your project values to public/js/config.js.');
    return true;
  }
  return false;
}

// ───────────── SIGN IN ─────────────
if (signInForm) {
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const submitButton = signInForm.querySelector('button[type="submit"]');

  // Already signed in? Skip the form.
  onAuthStateChanged(auth, (user) => {
    if (user) window.location.replace('/dashboard');
  });

  if (!warnIfNotConfigured(signInForm) && new URLSearchParams(window.location.search).get('registered') === '1') {
    showAlert(signInForm, 'Account created successfully. Please sign in.', 'success');
  }

  signInForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitButton.disabled) return;
    clearErrors(signInForm);

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    let valid = true;

    if (!email) { setFieldError(emailInput, 'Email is required.'); valid = false; }
    else if (!EMAIL_PATTERN.test(email)) { setFieldError(emailInput, 'Please enter a valid email address.'); valid = false; }
    if (!password) { setFieldError(passwordInput, 'Password is required.'); valid = false; }

    if (!valid) { signInForm.querySelector('[aria-invalid="true"]')?.focus(); return; }
    if (warnIfNotConfigured(signInForm)) return;

    setLoading(submitButton, true, 'Signing in...');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      window.location.replace('/dashboard');
    } catch (error) {
      showAlert(signInForm, friendlyAuthError(error));
      setLoading(submitButton, false);
    }
  });
}

// ───────────── SIGN UP ─────────────
if (signUpForm) {
  const nameInput = document.getElementById('name');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const confirmInput = document.getElementById('confirm-password');
  const submitButton = signUpForm.querySelector('button[type="submit"]');

  onAuthStateChanged(auth, (user) => {
    if (user && !signUpInProgress) window.location.replace('/dashboard');
  });

  warnIfNotConfigured(signUpForm);

  signUpForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitButton.disabled) return;
    clearErrors(signUpForm);

    const name = nameInput.value.trim().replace(/\s+/g, ' ');
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmInput.value;
    let valid = true;

    if (!name) { setFieldError(nameInput, 'Please enter your name.'); valid = false; }
    else if (name.length > 100) { setFieldError(nameInput, 'Name must be 100 characters or fewer.'); valid = false; }

    if (!EMAIL_PATTERN.test(email)) { setFieldError(emailInput, 'Please enter a valid email address.'); valid = false; }

    if (!password) { setFieldError(passwordInput, 'Password is required.'); valid = false; }
    else if (password.length < 6) { setFieldError(passwordInput, 'Password is too weak. Use at least 6 characters.'); valid = false; }

    if (!confirmPassword) { setFieldError(confirmInput, 'Please confirm your password.'); valid = false; }
    else if (password && password !== confirmPassword) { setFieldError(confirmInput, 'Passwords do not match.'); valid = false; }

    if (!valid) { signUpForm.querySelector('[aria-invalid="true"]')?.focus(); return; }
    if (warnIfNotConfigured(signUpForm)) return;

    signUpInProgress = true;
    setLoading(submitButton, true, 'Creating account...');

    let createdUser = null;
    try {
      // 1. Firebase Authentication creates the user and stores the password securely.
      //    Duplicate emails are rejected here with auth/email-already-in-use.
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      createdUser = credential.user;

      // 2. Store basic profile data in Firestore. No password is ever written.
      await setDoc(doc(db, 'users', createdUser.uid), {
        uid: createdUser.uid,
        name,
        email: createdUser.email,
        createdAt: serverTimestamp()
      });

      // 3. Firebase signs new users in automatically; sign out so the flow is Sign Up → Sign In.
      await signOut(auth);
      window.location.replace('/signin?registered=1');
    } catch (error) {
      // If the Firestore write failed, roll back the Auth user so the email can be reused.
      if (createdUser) {
        try { await deleteUser(createdUser); } catch { await signOut(auth).catch(() => {}); }
      }
      signUpInProgress = false;
      showAlert(signUpForm, friendlyAuthError(error));
      setLoading(submitButton, false);
    }
  });
}
