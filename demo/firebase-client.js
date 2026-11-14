import { initializeApp } from "firebase/app";
import { initializeAuth, browserSessionPersistence, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { firebaseConfig } from "./firebase-config.js";

const auth = initializeAuth(initializeApp(firebaseConfig), { persistence: browserSessionPersistence });

export async function getAuthToken(force = false) {
  await auth.authStateReady();
  return auth.currentUser ? auth.currentUser.getIdToken(force) : null;
}

export async function signIn(email, password) {
  await signInWithEmailAndPassword(auth, email, password);
}

export async function signOutAccount() {
  await signOut(auth);
}

export function authError(error) {
  const messages = {
    "auth/invalid-credential": "The email or password is incorrect.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/too-many-requests": "Too many attempts. Please wait before trying again.",
    "auth/network-request-failed": "The sign-in service could not be reached. Check your connection.",
    "auth/user-disabled": "This account is disabled. Contact your team.",
    "auth/operation-not-allowed": "Email sign-in is not available yet. Contact your team.",
  };
  return messages[error.code] || (error.code?.startsWith("auth/") ? "Sign-in could not be completed. Please try again." : error.message);
}
