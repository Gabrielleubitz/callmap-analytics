/**
 * Firebase Client SDK Initialization
 * 
 * This is the SINGLE source of truth for Firebase client app initialization.
 * All client-side Firebase operations MUST use getFirebaseApp() or getFirebaseAuth()
 * to ensure they use the same app instance.
 * 
 * BUG FIX: Previously, lib/auth/client.ts was trying to initialize its own Firebase app,
 * which caused "default Firebase app does not exist" errors when User objects from
 * one app instance were used with functions expecting a different app instance.
 */

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, Firestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
}

// Singleton Firebase app instance
let app: FirebaseApp | null = null

/**
 * Get or initialize the Firebase app instance
 * This ensures we only have ONE app instance across the entire client application
 */
export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    // Use existing app if available, otherwise initialize new one
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)
  }
  return app
}

/**
 * Get Firebase Auth instance from the singleton app
 * This ensures all auth operations use the same app instance
 */
export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp())
}

// Export the app for backward compatibility (but prefer using getFirebaseApp())
export { app as firebaseApp }

// Initialize Firestore using the singleton app
export const db = getFirestore(getFirebaseApp())

