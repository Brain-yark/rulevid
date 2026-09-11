import { Resend } from 'resend';
import { logger } from '../logger';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Ruleboard <onboarding@resend.dev>';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://ruleboard.site';

const resendClient = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

export const emailService = {
  /**
   * Send account verification email to newly registered user
   */
  async sendVerificationEmail(to: string, name: string | null, token: string): Promise<boolean> {
    const verificationUrl = `${FRONTEND_URL}/login?verify=${encodeURIComponent(token)}`;
    logger.info({ to, verificationUrl }, '[Email] Preparing verification email');

    if (!resendClient) {
      logger.warn('[Email] RESEND_API_KEY not configured. Verification email logged to console only.');
      return false;
    }

    try {
      const displayName = name ? name.trim() : 'there';
      const result = await resendClient.emails.send({
        from: FROM_EMAIL,
        to: [to],
        subject: 'Verify your Ruleboard account',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #0b0f19; color: #f3f4f6; border-radius: 12px; border: 1px solid #1f2937;">
            <div style="text-align: center; margin-bottom: 32px;">
              <h1 style="color: #6366f1; font-size: 28px; font-weight: 800; margin: 0; letter-spacing: -0.5px;">Ruleboard</h1>
              <p style="color: #9ca3af; font-size: 14px; margin-top: 6px;">Live Experience & Collaborative Events Platform</p>
            </div>

            <div style="background-color: #111827; border-radius: 8px; padding: 32px; border: 1px solid #374151;">
              <h2 style="color: #ffffff; font-size: 20px; margin-top: 0; margin-bottom: 16px;">Welcome, ${displayName}! 👋</h2>
              <p style="color: #d1d5db; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
                Thank you for creating an account on <strong>Ruleboard</strong>. To activate your account and start joining rooms and events, please confirm your email address:
              </p>

              <div style="text-align: center; margin: 32px 0;">
                <a href="${verificationUrl}" style="background-color: #6366f1; color: #ffffff; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px; display: inline-block; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);">
                  Confirm Email Address
                </a>
              </div>

              <p style="color: #9ca3af; font-size: 13px; line-height: 1.5; margin-bottom: 16px;">
                Or copy and paste this verification link into your browser:<br/>
                <a href="${verificationUrl}" style="color: #818cf8; word-break: break-all;">${verificationUrl}</a>
              </p>

              <p style="color: #6b7280; font-size: 12px; margin-top: 24px; border-top: 1px solid #1f2937; padding-top: 16px;">
                ⏱️ This verification link expires in 24 hours.<br/>
                If you did not request this account, you can safely ignore this email.
              </p>
            </div>

            <div style="text-align: center; margin-top: 32px; color: #6b7280; font-size: 12px;">
              &copy; ${new Date().getFullYear()} Ruleboard. All rights reserved.
            </div>
          </div>
        `,
      });

      if (result.error) {
        logger.error({ error: result.error, to }, '[Email] Resend API returned error');
        return false;
      }

      logger.info({ id: result.data?.id, to }, '[Email] Verification email sent successfully');
      return true;
    } catch (err: any) {
      logger.error({ error: err.message, to }, '[Email] Failed to send verification email');
      return false;
    }
  },

  /**
   * Send a welcome confirmation email once verified
   */
  async sendWelcomeEmail(to: string, name: string | null): Promise<boolean> {
    if (!resendClient) return false;

    try {
      const displayName = name ? name.trim() : 'there';
      await resendClient.emails.send({
        from: FROM_EMAIL,
        to: [to],
        subject: 'Your Ruleboard account is verified! 🎉',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #0b0f19; color: #f3f4f6; border-radius: 12px; border: 1px solid #1f2937;">
            <div style="text-align: center; margin-bottom: 32px;">
              <h1 style="color: #6366f1; font-size: 28px; font-weight: 800; margin: 0;">Ruleboard</h1>
            </div>
            <div style="background-color: #111827; border-radius: 8px; padding: 32px; border: 1px solid #374151;">
              <h2 style="color: #10b981; font-size: 20px; margin-top: 0;">🎉 You are all set, ${displayName}!</h2>
              <p style="color: #d1d5db; font-size: 15px; line-height: 1.6;">
                Your email has been verified and your account is active. You can now participate in live interactive events, video rooms, and messaging.
              </p>
              <div style="text-align: center; margin: 28px 0;">
                <a href="${FRONTEND_URL}/login" style="background-color: #10b981; color: #ffffff; font-weight: 600; text-decoration: none; padding: 12px 28px; border-radius: 8px; display: inline-block;">
                  Sign In to Ruleboard
                </a>
              </div>
            </div>
          </div>
        `,
      });
      return true;
    } catch (err: any) {
      logger.error({ error: err.message, to }, '[Email] Failed to send welcome email');
      return false;
    }
  },
};
