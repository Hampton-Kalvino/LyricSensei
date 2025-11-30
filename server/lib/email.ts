import { generatePasswordResetEmail } from "./email-templates";
import { getUncachableResendClient } from "../resend-client";

export async function sendPasswordResetEmail(
  email: string,
  userName: string,
  resetToken: string
): Promise<boolean> {
  // FIXED: Token in path instead of query parameter (prevents hash router stripping)
  const resetUrl = `${process.env.FRONTEND_URL || 'https://lyricsensei.com'}/#/auth/reset-password/${resetToken}`;
  console.log('[Email] Reset URL with token in path:', resetUrl);

  try {
    if (!process.env.REPLIT_CONNECTORS_HOSTNAME) {
      console.warn('[Email] Resend not configured (REPLIT_CONNECTORS_HOSTNAME missing)');
      return false;
    }

    console.log('[Email] Attempting to send password reset email to:', email);
    
    try {
      const { client, fromEmail, apiKey } = await getUncachableResendClient();
      
      console.log('[Email] Client initialized, attempting to send email');
      console.log('[Email] From:', `lyric sensei <${fromEmail}>`);
      console.log('[Email] To:', email);
      console.log('[Email] Subject: Reset your lyric sensei password');

      const response = await client.emails.send({
        from: `lyric sensei <${fromEmail}>`,
        to: email,
        subject: 'Reset your lyric sensei password',
        html: generatePasswordResetEmail(userName, resetUrl),
      });

      console.log('[Email] Resend response:', JSON.stringify(response));
      console.log('[Email] Password reset email sent successfully to:', email);
      return true;
    } catch (clientError: any) {
      console.error('[Email] ❌ RESEND EMAIL FAILED');
      console.error('[Email] Error status:', clientError?.status);
      console.error('[Email] Error message:', clientError?.message);
      
      if (clientError?.status === 403) {
        console.error('[Email] 403 FORBIDDEN - This indicates an authorization issue:');
        console.error('[Email] - Check that your Resend API key in the Replit integration is valid');
        console.error('[Email] - Verify the API key has "Sending access" permission for lyricsensei.com');
        console.error('[Email] - Or use an API key with "Full access" permissions');
        console.error('[Email] - You may need to generate a new API key in your Resend dashboard');
      }
      
      console.error('[Email] Error details:', clientError);
      console.error('[Email] Full error JSON:', JSON.stringify(clientError, null, 2));
      return false;
    }
  } catch (error) {
    console.error('[Email] Unexpected error sending password reset email:', error);
    return false;
  }
}
