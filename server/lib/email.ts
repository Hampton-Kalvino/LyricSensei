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
      const { client, fromEmail } = await getUncachableResendClient();
      
      await client.emails.send({
        from: `lyric sensei <${fromEmail}>`,
        to: email,
        subject: 'Reset your lyric sensei password',
        html: generatePasswordResetEmail(userName, resetUrl),
      });

      console.log('[Email] Password reset email sent successfully to:', email);
      return true;
    } catch (clientError) {
      console.error('[Email] Failed to get Resend client or send email:', clientError);
      return false;
    }
  } catch (error) {
    console.error('[Email] Unexpected error sending password reset email:', error);
    return false;
  }
}
