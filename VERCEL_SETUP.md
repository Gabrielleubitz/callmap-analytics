# Vercel Setup Guide

## Required Environment Variables

### Firebase Service Account Key

The application requires Firebase Admin SDK credentials to authenticate users and access Firestore.

**To set up in Vercel:**

1. **Get your Firebase Service Account Key:**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Select your project
   - Go to **Project Settings** > **Service Accounts**
   - Click **"Generate New Private Key"**
   - Download the JSON file

2. **Add to Vercel:**
   - Go to your Vercel project dashboard
   - Navigate to **Settings** > **Environment Variables**
   - Add a new variable:
     - **Name:** `FIREBASE_SERVICE_ACCOUNT_KEY`
     - **Value:** Paste the entire contents of the downloaded JSON file
     - **Environment:** Select all (Production, Preview, Development)
   - Click **Save**

3. **Important Notes:**
   - The value should be the entire JSON object as a string
   - If pasting directly, make sure all quotes are properly escaped
   - Alternatively, you can use Vercel's "Import from .env" feature if you have a `.env.local` file

### Other Required Environment Variables

- `NEXT_PUBLIC_FIREBASE_PROJECT_ID` - Your Firebase project ID (usually already set)

## Verification

After setting the environment variable:
1. Redeploy your application in Vercel
2. Check the build logs - you should see: `Firebase Admin: Using credentials from FIREBASE_SERVICE_ACCOUNT_KEY`
3. Try logging in - authentication should now work

## Troubleshooting

If you see errors like:
- "Credential implementation provided to initializeApp() failed"
- "Could not load the default credentials"

This means `FIREBASE_SERVICE_ACCOUNT_KEY` is not set or is invalid. Double-check:
1. The environment variable name is exactly `FIREBASE_SERVICE_ACCOUNT_KEY`
2. The value is valid JSON
3. The variable is set for the correct environment (Production/Preview/Development)
4. You've redeployed after adding the variable
