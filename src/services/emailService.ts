import { Resend } from 'resend';

// Configuration Resend - Lazy initialization pour s'assurer que dotenv est chargé
let resendInstance: Resend | null = null;

const getResend = (): Resend => {
  if (!resendInstance) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is not defined in environment variables');
    }
    resendInstance = new Resend(apiKey);
  }
  return resendInstance;
};

export const sendVerificationEmail = async (
  email: string,
  code: string,
  name: string
): Promise<void> => {
  try {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Code de vérification</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                  <!-- Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #6B46C1 0%, #8B5CF6 100%); padding: 40px 40px 30px; text-align: center;">
                      <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 800; letter-spacing: -1px;">Lokky</h1>
                      <p style="margin: 8px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 16px; font-weight: 500;">Ta ville, tes rencontres</p>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px;">
                      <h2 style="margin: 0 0 16px; color: #111827; font-size: 24px; font-weight: 700;">Bonjour ${name} 👋</h2>
                      <p style="margin: 0 0 24px; color: #6B7280; font-size: 16px; line-height: 24px;">
                        Bienvenue sur Lokky ! Pour finaliser ton inscription, utilise le code de vérification ci-dessous :
                      </p>
                      
                      <!-- Code Box -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="margin: 32px 0;">
                        <tr>
                          <td align="center" style="background-color: #F3F0FF; border-radius: 12px; padding: 32px;">
                            <p style="margin: 0 0 8px; color: #6B7280; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Ton code de vérification</p>
                            <p style="margin: 0; color: #6B46C1; font-size: 48px; font-weight: 900; letter-spacing: 8px; font-family: 'Courier New', monospace;">${code}</p>
                          </td>
                        </tr>
                      </table>
                      
                      <p style="margin: 24px 0 0; color: #6B7280; font-size: 14px; line-height: 20px;">
                        Ce code expire dans <strong>10 minutes</strong>. Si tu n'as pas demandé ce code, tu peux ignorer cet email en toute sécurité.
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #F9FAFB; padding: 24px 40px; border-top: 1px solid #E5E7EB;">
                      <p style="margin: 0; color: #9CA3AF; font-size: 12px; line-height: 18px; text-align: center;">
                        © ${new Date().getFullYear()} Lokky. Tous droits réservés.<br>
                        Cet email a été envoyé à ${email}
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

    // Envoyer l'email avec Resend
    // Pour la production, utilisez un sous-domaine : noreply@mail.akylian.com
    // Cela évite les conflits avec Zoho Mail sur akylian.com
    const resend = getResend();
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'Lokky <onboarding@resend.dev>',
      to: email,
      subject: 'Code de vérification Lokky',
      html: htmlContent,
    });

    if (error) {
      throw error;
    }

  } catch (error) {
    console.error('Error sending verification email:', error);
    throw error;
  }
};

export const sendPasswordResetEmail = async (
  email: string,
  code: string,
  name: string
): Promise<void> => {
  try {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Réinitialisation de mot de passe</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                  <!-- Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #6B46C1 0%, #8B5CF6 100%); padding: 40px 40px 30px; text-align: center;">
                      <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 800; letter-spacing: -1px;">Lokky</h1>
                      <p style="margin: 8px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 16px; font-weight: 500;">Ta ville, tes rencontres</p>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px;">
                      <h2 style="margin: 0 0 16px; color: #111827; font-size: 24px; font-weight: 700;">Bonjour ${name} 👋</h2>
                      <p style="margin: 0 0 24px; color: #6B7280; font-size: 16px; line-height: 24px;">
                        Tu as demandé à réinitialiser ton mot de passe. Utilise le code ci-dessous pour créer un nouveau mot de passe :
                      </p>
                      
                      <!-- Code Box -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="margin: 32px 0;">
                        <tr>
                          <td align="center" style="background-color: #F3F0FF; border-radius: 12px; padding: 32px;">
                            <p style="margin: 0 0 8px; color: #6B7280; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Code de réinitialisation</p>
                            <p style="margin: 0; color: #6B46C1; font-size: 48px; font-weight: 900; letter-spacing: 8px; font-family: 'Courier New', monospace;">${code}</p>
                          </td>
                        </tr>
                      </table>
                      
                      <p style="margin: 24px 0 0; color: #6B7280; font-size: 14px; line-height: 20px;">
                        Ce code expire dans <strong>10 minutes</strong>. Si tu n'as pas demandé cette réinitialisation, tu peux ignorer cet email en toute sécurité.
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #F9FAFB; padding: 24px 40px; border-top: 1px solid #E5E7EB;">
                      <p style="margin: 0; color: #9CA3AF; font-size: 12px; line-height: 18px; text-align: center;">
                        © ${new Date().getFullYear()} Lokky. Tous droits réservés.<br>
                        Cet email a été envoyé à ${email}
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

    // Envoyer l'email avec Resend
    // Pour la production, utilisez un sous-domaine : noreply@mail.akylian.com
    // Cela évite les conflits avec Zoho Mail sur akylian.com
    const resend = getResend();
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'Lokky <onboarding@resend.dev>',
      to: email,
      subject: 'Réinitialisation de mot de passe - Lokky',
      html: htmlContent,
    });

    if (error) {
      throw error;
    }

  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw error;
  }
};
