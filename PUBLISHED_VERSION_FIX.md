# Fixing 500 Error on Published Version (.replit.app)

## Problem

The published version of LyricSync shows a **500 error** when trying to recognize songs on mobile Chrome or the downloaded PWA version, while the preview URL (.replit.dev) works fine.

## Root Cause

The published deployment is **missing environment variables/secrets** that are only available in the development environment. Specifically:

1. **ACRCloud API credentials** (ACRCLOUD_ACCESS_KEY, ACRCLOUD_ACCESS_SECRET, ACRCLOUD_HOST)
2. **Azure Translator credentials** (AZURE_TRANSLATOR_KEY, AZURE_TRANSLATOR_REGION) 
3. **Stripe credentials** (may also be missing on production)

## Solution

You need to ensure all secrets are available in the **published deployment**. Replit deployments sync secrets automatically, but you must verify they're configured correctly.

### Step 1: Verify Secrets Are Added

1. Open your Replit project
2. Click on **"Secrets" (🔒)** in the left sidebar (Tools section)
3. Verify these secrets exist:
   - `ACRCLOUD_ACCESS_KEY`
   - `ACRCLOUD_ACCESS_SECRET`
   - `ACRCLOUD_HOST`
   - `AZURE_TRANSLATOR_KEY`
   - `AZURE_TRANSLATOR_REGION`
   - `STRIPE_SECRET_KEY`
   - `STRIPE_PRICE_ID`
   - `STRIPE_WEBHOOK_SECRET`
   - `SESSION_SECRET`

4. **If any are missing**, add them now by clicking "Add a new secret"

### Step 2: Re-publish Your App

After adding/verifying secrets:

1. Click the **"Publish"** button (🚀) at the top of your Replit workspace
2. If already published, click **"Re-publish"** or **"Update deployment"**
3. Wait for the deployment to complete (usually 1-3 minutes)
4. The secrets will automatically sync to the published version

### Step 3: Test the Health Endpoint

Open your published app URL and add `/api/health` to check configuration:

```
https://your-app-name.replit.app/api/health
```

You should see:

```json
{
  "status": "ok",
  "environment": "production",
  "acrcloud": {
    "configured": true,
    "accessKeySet": true,
    "secretSet": true,
    "hostSet": true
  },
  "azureTranslator": {
    "configured": true,
    "keySet": true,
    "regionSet": true
  },
  "database": {
    "configured": true
  },
  "session": {
    "configured": true
  }
}
```

**If you see `"configured": false` for any service**, that secret is missing from your published deployment.

### Step 4: Check Deployment Logs

If the health endpoint shows all secrets configured but you still get 500 errors:

1. In Replit, click **"Deployments"** in the left sidebar
2. Click on your active deployment
3. Click **"Logs"** tab
4. Look for error messages that indicate what's failing

Common errors:
- `"credentials not configured"` → Secrets not synced
- `"Invalid access"` → Wrong API keys
- `"Limit exceeded"` → Free tier quota reached

### Step 5: Force Secret Sync (If Needed)

If secrets still aren't syncing to production:

1. Go to **Secrets** pane
2. Click on each secret
3. Click **"Unsync from deployment"** if available
4. Then immediately **"Sync to deployment"**
5. Re-publish the app

---

## Prevention

To avoid this issue in the future:

1. **Always test the published version** after making changes
2. **Use the health endpoint** (`/api/health`) to verify configuration
3. **Check deployment logs** if something breaks
4. **Document all required secrets** in your project README

---

## Quick Troubleshooting Checklist

- [ ] All secrets added in Replit Secrets pane
- [ ] App re-published after adding secrets
- [ ] Health endpoint shows all services configured
- [ ] Deployment logs show no errors
- [ ] Tested on mobile Chrome and PWA
- [ ] Recognition works on published URL

---

## How Secrets Work in Replit

**Development Environment (.replit.dev):**
- Uses secrets from the "Secrets" pane
- Available immediately when added
- Used by the preview URL

**Published Deployment (.replit.app):**
- **Automatically syncs** secrets from workspace
- Requires **re-publishing** to pick up new secrets
- Uses the same secret values as development
- Can be manually unsynced/synced if needed

**Note:** Static deployments (HTML/CSS/JS only) **do not support secrets**. LyricSync uses a full deployment because it has a backend server.

---

## Testing Mobile/PWA Specifically

The 500 error specifically happens on:
- **Mobile Chrome** (not desktop Chrome)
- **Downloaded PWA** version

This is because mobile browsers/PWAs:
- Use the published URL (.replit.app)
- Don't have access to development secrets
- Require the backend to be properly deployed

**To test:**
1. Publish your app
2. Open the published URL on mobile Chrome
3. Try recognizing a song
4. It should work without 500 errors

---

## Additional Notes

- **Microphone permissions** are different from the 500 error
  - Microphone needs HTTPS (both preview and published have this)
  - If you get mic permission errors, check browser settings
  
- **500 errors** specifically mean the backend crashed
  - Usually due to missing environment variables
  - Check server logs to see the exact error
  
- **Recognition works in preview** but not published
  - This confirms it's a deployment configuration issue
  - Not a code problem

---

## Related Documentation

- [Replit Secrets Documentation](https://docs.replit.com/programming-ide/workspace-features/secrets)
- [Replit Deployments Guide](https://docs.replit.com/hosting/deployments/about-deployments)
