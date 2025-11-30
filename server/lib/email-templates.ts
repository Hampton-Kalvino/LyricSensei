export function generatePasswordResetEmail(
  userName: string,
  resetUrl: string
): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background-color: #f5f5f7;
">
  <!-- Main Container -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f7; padding: 40px 0;">
    <tr>
      <td align="center">
        <!-- Email Content -->
        <table width="600" cellpadding="0" cellspacing="0" style="
          background: white;
          border-radius: 16px;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
          overflow: hidden;
        ">
          
          <!-- Header with Gradient -->
          <tr>
            <td style="
              background: linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%);
              padding: 40px 48px;
              text-align: center;
            ">
              <!-- Logo -->
              <div style="font-size: 48px; margin-bottom: 16px;">♪</div>
              
              <h1 style="
                color: white;
                font-size: 32px;
                font-weight: 700;
                margin: 0 0 8px 0;
                letter-spacing: -0.5px;
              ">
                Lyric Sensei
              </h1>
              
              <p style="
                color: rgba(255, 255, 255, 0.9);
                font-size: 16px;
                margin: 0;
              ">
                Master Lyrics in Any Language
              </p>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 48px;">
              
              <!-- Greeting -->
              <h2 style="
                color: #1f2937;
                font-size: 24px;
                font-weight: 600;
                margin: 0 0 16px 0;
              ">
                Reset Your Password
              </h2>

              <p style="
                color: #6b7280;
                font-size: 16px;
                line-height: 1.6;
                margin: 0 0 24px 0;
              ">
                Hi ${userName || 'there'},
              </p>

              <p style="
                color: #6b7280;
                font-size: 16px;
                line-height: 1.6;
                margin: 0 0 32px 0;
              ">
                We received a request to reset your password for your Lyric Sensei account. 
                Click the button below to create a new password.
              </p>

              <!-- Reset Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 0 0 32px 0;">
                    <a 
                      href="${resetUrl.replace(/&/g, '&amp;')}" 
                      style="
                        display: inline-block;
                        background: linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%);
                        color: white;
                        text-decoration: none;
                        padding: 16px 48px;
                        border-radius: 12px;
                        font-size: 16px;
                        font-weight: 600;
                        box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
                        transition: transform 0.2s;
                      "
                    >
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Security Info Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="
                background: #f9fafb;
                border-left: 4px solid #8B5CF6;
                border-radius: 8px;
                margin-bottom: 32px;
              ">
                <tr>
                  <td style="padding: 20px;">
                    <p style="
                      color: #374151;
                      font-size: 14px;
                      margin: 0 0 8px 0;
                      font-weight: 600;
                    ">
                      🔒 Security Reminder
                    </p>
                    <p style="
                      color: #6b7280;
                      font-size: 14px;
                      line-height: 1.5;
                      margin: 0;
                    ">
                      This link will expire in <strong>1 hour</strong> for your security. 
                      If you didn't request this reset, please ignore this email and your password will remain unchanged.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Alternative Link -->
              <p style="
                color: #9ca3af;
                font-size: 14px;
                line-height: 1.6;
                margin: 0 0 8px 0;
              ">
                Button not working? Copy and paste this link into your browser:
              </p>
              
              <p style="
                background: #f9fafb;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                padding: 12px 16px;
                margin: 0 0 32px 0;
                word-break: break-all;
              ">
                <a 
                  href="${resetUrl.replace(/&/g, '&amp;')}" 
                  style="
                    color: #8B5CF6;
                    text-decoration: none;
                    font-size: 13px;
                  "
                >
                  ${resetUrl}
                </a>
              </p>

              <!-- Help Text -->
              <p style="
                color: #9ca3af;
                font-size: 14px;
                line-height: 1.6;
                margin: 0;
              ">
                Need help? Contact us at 
                <a href="mailto:support@lyricsensei.com" style="color: #8B5CF6; text-decoration: none;">
                  support@lyricsensei.com
                </a>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="
              background: #f9fafb;
              padding: 32px 48px;
              text-align: center;
              border-top: 1px solid #e5e7eb;
            ">
              <p style="
                color: #6b7280;
                font-size: 14px;
                margin: 0 0 16px 0;
              ">
                © 2025 Lyric Sensei. All rights reserved.
              </p>
              
              <p style="
                color: #9ca3af;
                font-size: 12px;
                margin: 0 0 16px 0;
              ">
                Learn lyrics in any language with confidence
              </p>

              <p style="
                color: #9ca3af;
                font-size: 11px;
                margin: 16px 0 0 0;
                line-height: 1.5;
              ">
                You received this email because a password reset was requested for your account.
                <br/>
                If you didn't make this request, you can safely ignore this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}
