import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Refuse to start with an incomplete config — otherwise Firebase fails later
// with cryptic errors. These are build-time (VITE_*) values baked by Vite.
const missing = Object.entries(firebaseConfig)
  .filter(([, v]) => !v)
  .map(([k]) => k);
if (missing.length) {
  throw new Error(
    `Missing Firebase config: ${missing.join(", ")}. ` +
      `Set the matching VITE_FIREBASE_* vars in .env (see .env.example) before building.`,
  );
}
export const app = initializeApp(firebaseConfig);

// App Check blocks scripted / non-app clients from calling Auth, Firestore, and
// callable functions — the main defense against mass signup and API-cost abuse.
// Inert until VITE_RECAPTCHA_SITE_KEY is set AND enforcement is enabled per
// service in the Firebase console.
// ponytail: turn on enforcement per-service after verifying real traffic passes.
const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
if (recaptchaSiteKey) {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(recaptchaSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, "us-central1");
