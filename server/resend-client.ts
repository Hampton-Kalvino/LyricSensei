import { Resend } from 'resend';

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
// Always call this function again to get a fresh client.
export async function getUncachableResendClient() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!hostname) {
    throw new Error('[RESEND] REPLIT_CONNECTORS_HOSTNAME not configured');
  }

  if (!xReplitToken) {
    throw new Error('[RESEND] X_REPLIT_TOKEN not found - Replit environment not properly configured');
  }

  try {
    const response = await fetch(
      `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=resend`,
      {
        headers: {
          'Accept': 'application/json',
          'X_REPLIT_TOKEN': xReplitToken
        }
      }
    );

    if (!response.ok) {
      throw new Error(`[RESEND] Failed to fetch connection settings: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const connectionSettings = data.items?.[0];

    if (!connectionSettings) {
      throw new Error('[RESEND] No Resend connection found in Replit - please set up the Resend integration');
    }

    if (!connectionSettings.settings?.api_key) {
      throw new Error('[RESEND] Resend API key not configured in connection settings');
    }

    if (!connectionSettings.settings?.from_email) {
      throw new Error('[RESEND] Resend from_email not configured in connection settings');
    }

    const apiKey = connectionSettings.settings.api_key;
    const fromEmail = connectionSettings.settings.from_email;

    // Log for debugging (mask the API key for security)
    console.log('[RESEND] Initializing client with API key:', apiKey.substring(0, 10) + '...');
    console.log('[RESEND] From email:', fromEmail);

    const resendClient = new Resend(apiKey);

    return {
      client: resendClient,
      fromEmail: fromEmail,
      apiKey: apiKey
    };
  } catch (error) {
    console.error('[RESEND] Error getting Resend client:', error);
    throw error;
  }
}
