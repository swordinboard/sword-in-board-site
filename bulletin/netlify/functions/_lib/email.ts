/**
 * Submission notifications.
 *
 * Netlify functions cannot send mail on their own, so delivery goes through
 * Resend's REST API. Both variables below are optional: with them unset the
 * submission is still stored and reviewable in the editor, and the failure to
 * notify is logged rather than surfaced to the person submitting.
 *
 *   NOTIFY_EMAIL   destination address for notifications
 *   RESEND_API_KEY Resend API key
 *   NOTIFY_FROM    verified sender, defaults to Resend's shared onboarding address
 */

export interface NotificationInput {
  submitter: string;
  contact?: string;
  note: string;
  mediaCount: number;
  reviewUrl: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function notifySubmission(input: NotificationInput): Promise<void> {
  const to = process.env.NOTIFY_EMAIL;
  const apiKey = process.env.RESEND_API_KEY;
  if (!to || !apiKey) {
    console.log(
      `[submission] stored but not emailed (NOTIFY_EMAIL/RESEND_API_KEY unset) from ${input.submitter}`,
    );
    return;
  }

  const from = process.env.NOTIFY_FROM || 'onboarding@resend.dev';
  const contact = input.contact ? escapeHtml(input.contact) : 'not provided';
  const html = [
    `<h2>New bulletin submission</h2>`,
    `<p><strong>From:</strong> ${escapeHtml(input.submitter)}<br>`,
    `<strong>Contact:</strong> ${contact}<br>`,
    `<strong>Attachments:</strong> ${input.mediaCount}</p>`,
    `<p><strong>What they are going for:</strong></p>`,
    `<blockquote style="border-left:3px solid #ccc;padding-left:12px;white-space:pre-wrap">${escapeHtml(input.note)}</blockquote>`,
    `<p><a href="${input.reviewUrl}">Review it in the editor</a></p>`,
  ].join('\n');

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `Bulletin submission from ${input.submitter}`,
        html,
      }),
    });
    if (!res.ok) {
      console.error(`[submission] notification failed: ${res.status} ${await res.text()}`);
    }
  } catch (error) {
    console.error('[submission] notification threw', error);
  }
}
