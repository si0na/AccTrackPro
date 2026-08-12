import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class GraphMailService {
  private readonly logger = new Logger(GraphMailService.name);

  /**
   * Sends a password reset email via Microsoft Graph API using application permissions.
   * Authentication is performed using Client Credentials flow (Entra ID).
   */
  async sendMail(to: string, subject: string, htmlContent: string): Promise<boolean> {
    const tenantId = process.env.AZURE_TENANT_ID;
    const clientId = process.env.AZURE_CLIENT_ID;
    const clientSecret = process.env.AZURE_CLIENT_SECRET;
    const sender = process.env.GRAPH_SENDER_EMAIL || 'noreply@reflectionsinfos.com';

    if (!tenantId || !clientId || !clientSecret) {
      this.logger.warn(
        `Microsoft Graph email delivery cannot proceed because configurations are incomplete. [hasTenant=${!!tenantId}, hasClient=${!!clientId}, hasSecret=${!!clientSecret}]`
      );
      return false;
    }

    try {
      // 1. Authenticate with Microsoft Entra using Client Credentials Flow
      const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
      const params = new URLSearchParams();
      params.append('client_id', clientId);
      params.append('scope', 'https://graph.microsoft.com/.default');
      params.append('client_secret', clientSecret);
      params.append('grant_type', 'client_credentials');

      const tokenRes = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      if (!tokenRes.ok) {
        throw new Error(`Token fetch failed with status ${tokenRes.status}`);
      }

      const tokenData = (await tokenRes.json()) as { access_token?: string };
      const accessToken = tokenData.access_token;
      if (!accessToken) {
        throw new Error('Access token was missing in the token response');
      }

      // 2. Call Graph API to send email via /users/{sender}/sendMail
      const sendMailUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`;
      const emailBody = {
        message: {
          subject,
          body: {
            contentType: 'HTML',
            content: htmlContent,
          },
          toRecipients: [
            {
              emailAddress: {
                address: to,
              },
            },
          ],
        },
        saveToSentItems: 'false',
      };

      const mailRes = await fetch(sendMailUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailBody),
      });

      if (!mailRes.ok) {
        const errorText = await mailRes.text();
        throw new Error(`Graph sendMail API returned status ${mailRes.status}: ${errorText}`);
      }

      this.logger.log(`Password reset email successfully sent to <${to}> via Microsoft Graph API`);
      return true;
    } catch (error: any) {
      // Safe error logging: never expose secret, access token, or user credentials
      this.logger.error(`Failed to send password reset email via Microsoft Graph API. Reason: ${error.message}`);
      return false;
    }
  }
}
