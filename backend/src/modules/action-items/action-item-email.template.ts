/**
 * Professional HTML Email Templates for Action Item Notifications.
 *
 * Matching ReflectOne CRM branding with clean responsive layouts,
 * high-contrast priority tags, and email-client-friendly tables.
 */

export interface ActionItemEmailBaseParams {
  id: string;
  actionItemNumber?: string;
  title: string;
  notes?: string;
  accountName: string;
  opportunityName?: string;
  projectId?: string;
  priority: string;
  status: string;
  dueDate?: string;
  ownerName: string;
  frontendUrl?: string;
}

export interface ActionItemCreatedEmailParams extends ActionItemEmailBaseParams {
  creatorName: string;
  createdAt?: string;
}

export interface ActionItemDueReminderEmailParams extends ActionItemEmailBaseParams {
  isOverdue?: boolean;
}

/** Resolves the direct URL to view the action item in ReflectOne */
export function resolveActionItemWebUrl(
  actionItemId: string,
  projectId?: string | null,
  rawFrontendUrl?: string,
): string {
  const base = (rawFrontendUrl || process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
  if (projectId) {
    return `${base}/project-action-items/${actionItemId}`;
  }
  return `${base}/action-items/${actionItemId}`;
}

function getPriorityBadgeHtml(priority: string): string {
  const p = (priority || '').toLowerCase();
  if (p === 'high') {
    return `<span style="background-color: #fef2f2; color: #dc2626; border: 1px solid #fecaca; padding: 3px 8px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase;">High</span>`;
  }
  if (p === 'medium') {
    return `<span style="background-color: #fffbeb; color: #d97706; border: 1px solid #fde68a; padding: 3px 8px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase;">Medium</span>`;
  }
  return `<span style="background-color: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; padding: 3px 8px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase;">${escapeHtml(priority || 'Low')}</span>`;
}

function getStatusBadgeHtml(status: string): string {
  const s = (status || '').toLowerCase();
  let bg = '#f1f5f9';
  let color = '#475569';
  let border = '#cbd5e1';

  if (s === 'completed') {
    bg = '#ecfdf5';
    color = '#059669';
    border = '#a7f3d0';
  } else if (s === 'in progress') {
    bg = '#eff6ff';
    color = '#2563eb';
    border = '#bfdbfe';
  } else if (s === 'blocked') {
    bg = '#fef2f2';
    color = '#e11d48';
    border = '#fecdd3';
  }

  return `<span style="background-color: ${bg}; color: ${color}; border: 1px solid ${border}; padding: 3px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600;">${escapeHtml(status || 'To Do')}</span>`;
}

function escapeHtml(text?: string | null): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Builds the Creation Notification email for newly assigned Action Items.
 */
export function renderActionItemCreatedEmail(
  params: ActionItemCreatedEmailParams,
): { subject: string; html: string } {
  const subject = `New Action Item Assigned: ${params.title}`;
  const actionUrl = resolveActionItemWebUrl(params.id, params.projectId, params.frontendUrl);
  const senderEmail = process.env.GRAPH_SENDER_EMAIL || 'noreply@reflectionsinfos.com';

  const creationDateDisplay = params.createdAt
    ? new Date(params.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${escapeHtml(subject)}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; -webkit-font-smoothing: antialiased;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; padding: 32px 16px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 620px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
              <!-- Header Bar -->
              <tr>
                <td style="background-color: #ffffff; padding: 28px 32px 20px 32px; border-bottom: 2px solid #2563eb;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td>
                        <span style="font-size: 22px; font-weight: 800; color: #2563eb; letter-spacing: -0.025em;">ReflectOne</span>
                        <span style="font-size: 13px; font-weight: 600; color: #64748b; margin-left: 8px;">| CRM Action Items</span>
                      </td>
                      <td align="right">
                        <span style="background-color: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase;">
                          New Assignment
                        </span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Main Content -->
              <tr>
                <td style="padding: 32px;">
                  <h2 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 700; color: #0f172a;">
                    Hello ${escapeHtml(params.ownerName)},
                  </h2>
                  <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                    A new action item has been created and assigned to you in ReflectOne. Please review the assignment details below.
                  </p>

                  <!-- Details Card -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #e2e8f0; border-radius: 8px; background-color: #f8fafc; margin-bottom: 28px; overflow: hidden;">
                    ${
                      params.actionItemNumber
                        ? `
                    <tr>
                      <td style="padding: 12px 16px; width: 34%; font-size: 12px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Action Item #</td>
                      <td style="padding: 12px 16px; font-size: 13px; font-weight: 700; color: #2563eb; font-family: monospace; border-bottom: 1px solid #e2e8f0;">${escapeHtml(params.actionItemNumber)}</td>
                    </tr>`
                        : ''
                    }
                    <tr>
                      <td style="padding: 12px 16px; width: 34%; font-size: 12px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Title</td>
                      <td style="padding: 12px 16px; font-size: 14px; font-weight: 700; color: #1e293b; border-bottom: 1px solid #e2e8f0;">${escapeHtml(params.title)}</td>
                    </tr>
                    <tr>
                      <td style="padding: 12px 16px; font-size: 12px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0; vertical-align: top;">Description</td>
                      <td style="padding: 12px 16px; font-size: 13px; color: #334155; line-height: 1.5; border-bottom: 1px solid #e2e8f0;">${escapeHtml(params.notes || 'None')}</td>
                    </tr>
                    <tr>
                      <td style="padding: 12px 16px; font-size: 12px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Associated Account</td>
                      <td style="padding: 12px 16px; font-size: 13px; font-weight: 600; color: #1e293b; border-bottom: 1px solid #e2e8f0;">${escapeHtml(params.accountName || '—')}</td>
                    </tr>
                    ${
                      params.opportunityName
                        ? `
                    <tr>
                      <td style="padding: 12px 16px; font-size: 12px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Associated Opportunity</td>
                      <td style="padding: 12px 16px; font-size: 13px; color: #1e293b; border-bottom: 1px solid #e2e8f0;">${escapeHtml(params.opportunityName)}</td>
                    </tr>`
                        : ''
                    }
                    <tr>
                      <td style="padding: 12px 16px; font-size: 12px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Assigned Owner</td>
                      <td style="padding: 12px 16px; font-size: 13px; font-weight: 600; color: #1e293b; border-bottom: 1px solid #e2e8f0;">${escapeHtml(params.ownerName)}</td>
                    </tr>
                    <tr>
                      <td style="padding: 12px 16px; font-size: 12px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Priority</td>
                      <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">${getPriorityBadgeHtml(params.priority)}</td>
                    </tr>
                    <tr>
                      <td style="padding: 12px 16px; font-size: 12px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Status</td>
                      <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">${getStatusBadgeHtml(params.status)}</td>
                    </tr>
                    <tr>
                      <td style="padding: 12px 16px; font-size: 12px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Due Date</td>
                      <td style="padding: 12px 16px; font-size: 13px; font-weight: 700; color: #b91c1c; border-bottom: 1px solid #e2e8f0;">${escapeHtml(params.dueDate || 'Not set')}</td>
                    </tr>
                    <tr>
                      <td style="padding: 12px 16px; font-size: 12px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Created By</td>
                      <td style="padding: 12px 16px; font-size: 13px; color: #334155; border-bottom: 1px solid #e2e8f0;">${escapeHtml(params.creatorName || 'System')}</td>
                    </tr>
                    <tr>
                      <td style="padding: 12px 16px; font-size: 12px; font-weight: 600; color: #64748b;">Creation Date</td>
                      <td style="padding: 12px 16px; font-size: 13px; color: #64748b;">${escapeHtml(creationDateDisplay)}</td>
                    </tr>
                  </table>

                  <!-- CTA Button -->
                  <div style="text-align: center; margin: 32px 0 20px 0;">
                    <a href="${actionUrl}" style="background-color: #2563eb; color: #ffffff; padding: 14px 28px; font-size: 14px; font-weight: 600; border-radius: 8px; text-decoration: none; display: inline-block; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);">
                      Open Action Item in ReflectOne
                    </a>
                  </div>
                  <p style="text-align: center; font-size: 11px; color: #94a3b8; margin: 0;">
                    If the button does not work, visit: <a href="${actionUrl}" style="color: #2563eb; word-break: break-all;">${actionUrl}</a>
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f8fafc; padding: 20px 32px; border-top: 1px solid #e2e8f0; text-align: center;">
                  <p style="font-size: 11px; color: #94a3b8; line-height: 1.5; margin: 0;">
                    This is an automated operational notification sent by ReflectOne CRM.<br />
                    Sender: ${escapeHtml(senderEmail)} • Please do not reply directly to this message.
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

  return { subject, html };
}

/**
 * Builds the Due Date Reminder email when an Action Item's due date arrives.
 */
export function renderActionItemDueReminderEmail(
  params: ActionItemDueReminderEmailParams,
): { subject: string; html: string } {
  const isOverdue = Boolean(params.isOverdue);
  const subject = isOverdue
    ? `Action Item Due Date Expired: ${params.title}`
    : `Action Item Due Today: ${params.title}`;
  const badgeText = isOverdue ? 'Due Date Expired' : 'Due Today';
  const introText = isOverdue
    ? 'This is an automated reminder that the scheduled due date for the following action item assigned to you has passed.'
    : 'This is an automated reminder that the following action item assigned to you has reached its scheduled due date today.';
  const actionUrl = resolveActionItemWebUrl(params.id, params.projectId, params.frontendUrl);
  const senderEmail = process.env.GRAPH_SENDER_EMAIL || 'noreply@reflectionsinfos.com';

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${escapeHtml(subject)}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; -webkit-font-smoothing: antialiased;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; padding: 32px 16px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 620px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
              <!-- Header Bar -->
              <tr>
                <td style="background-color: #ffffff; padding: 28px 32px 20px 32px; border-bottom: 2px solid #dc2626;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td>
                        <span style="font-size: 22px; font-weight: 800; color: #2563eb; letter-spacing: -0.025em;">ReflectOne</span>
                        <span style="font-size: 13px; font-weight: 600; color: #64748b; margin-left: 8px;">| Reminder</span>
                      </td>
                      <td align="right">
                        <span style="background-color: #fef2f2; color: #dc2626; border: 1px solid #fecaca; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase;">
                          ${badgeText}
                        </span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Main Content -->
              <tr>
                <td style="padding: 32px;">
                  <h2 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 700; color: #0f172a;">
                    Hello ${escapeHtml(params.ownerName)},
                  </h2>
                  <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                    ${introText}
                  </p>

                  <!-- Details Card -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #e2e8f0; border-radius: 8px; background-color: #f8fafc; margin-bottom: 28px; overflow: hidden;">
                    ${
                      params.actionItemNumber
                        ? `
                    <tr>
                      <td style="padding: 12px 16px; width: 34%; font-size: 12px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Action Item #</td>
                      <td style="padding: 12px 16px; font-size: 13px; font-weight: 700; color: #2563eb; font-family: monospace; border-bottom: 1px solid #e2e8f0;">${escapeHtml(params.actionItemNumber)}</td>
                    </tr>`
                        : ''
                    }
                    <tr>
                      <td style="padding: 12px 16px; width: 34%; font-size: 12px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Title</td>
                      <td style="padding: 12px 16px; font-size: 14px; font-weight: 700; color: #1e293b; border-bottom: 1px solid #e2e8f0;">${escapeHtml(params.title)}</td>
                    </tr>
                    <tr>
                      <td style="padding: 12px 16px; font-size: 12px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0; vertical-align: top;">Description</td>
                      <td style="padding: 12px 16px; font-size: 13px; color: #334155; line-height: 1.5; border-bottom: 1px solid #e2e8f0;">${escapeHtml(params.notes || 'None')}</td>
                    </tr>
                    <tr>
                      <td style="padding: 12px 16px; font-size: 12px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Associated Account</td>
                      <td style="padding: 12px 16px; font-size: 13px; font-weight: 600; color: #1e293b; border-bottom: 1px solid #e2e8f0;">${escapeHtml(params.accountName || '—')}</td>
                    </tr>
                    ${
                      params.opportunityName
                        ? `
                    <tr>
                      <td style="padding: 12px 16px; font-size: 12px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Associated Opportunity</td>
                      <td style="padding: 12px 16px; font-size: 13px; color: #1e293b; border-bottom: 1px solid #e2e8f0;">${escapeHtml(params.opportunityName)}</td>
                    </tr>`
                        : ''
                    }
                    <tr>
                      <td style="padding: 12px 16px; font-size: 12px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Priority</td>
                      <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">${getPriorityBadgeHtml(params.priority)}</td>
                    </tr>
                    <tr>
                      <td style="padding: 12px 16px; font-size: 12px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Current Status</td>
                      <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">${getStatusBadgeHtml(params.status)}</td>
                    </tr>
                    <tr>
                      <td style="padding: 12px 16px; font-size: 12px; font-weight: 600; color: #64748b;">Due Date</td>
                      <td style="padding: 12px 16px; font-size: 13px; font-weight: 800; color: #dc2626;">
                        ${escapeHtml(params.dueDate || 'Today')} <span style="font-size: 11px; font-weight: normal; color: #ef4444;">(${isOverdue ? 'Past Due' : 'Due Today'})</span>
                      </td>
                    </tr>
                  </table>

                  <!-- CTA Button -->
                  <div style="text-align: center; margin: 32px 0 20px 0;">
                    <a href="${actionUrl}" style="background-color: #2563eb; color: #ffffff; padding: 14px 28px; font-size: 14px; font-weight: 600; border-radius: 8px; text-decoration: none; display: inline-block; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);">
                      View Action Item
                    </a>
                  </div>
                  <p style="text-align: center; font-size: 11px; color: #94a3b8; margin: 0;">
                    Direct link: <a href="${actionUrl}" style="color: #2563eb; word-break: break-all;">${actionUrl}</a>
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f8fafc; padding: 20px 32px; border-top: 1px solid #e2e8f0; text-align: center;">
                  <p style="font-size: 11px; color: #94a3b8; line-height: 1.5; margin: 0;">
                    This is an automated operational reminder sent by ReflectOne CRM.<br />
                    Sender: ${escapeHtml(senderEmail)} • Please do not reply directly to this message.
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

  return { subject, html };
}
