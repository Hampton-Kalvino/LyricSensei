import { generatePasswordResetEmail } from "./email-templates";
import { getUncachableResendClient } from "../resend-client";

export async function sendPasswordResetEmail(
  email: string,
  userName: string,
  resetToken: string
): Promise<boolean> {
  const resetUrl = `${process.env.FRONTEND_URL || 'https://lyricsensei.com'}/#/auth/reset-password?token=${resetToken}`;

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
      console.error('[Email] Resend error details:', clientError);
      console.error('[Email] Error message:', clientError?.message);
      console.error('[Email] Error status:', clientError?.status);
      console.error('[Email] Error response:', clientError?.response);
      console.error('[Email] Full error:', JSON.stringify(clientError, null, 2));
      return false;
    }
  } catch (error) {
    console.error('[Email] Unexpected error sending password reset email:', error);
    return false;
  }
}
