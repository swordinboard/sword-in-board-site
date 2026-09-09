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

export interface AttackNotice {
  failures: number;
  windowMinutes: number;
  origin: string;
}

/**
 * Sent once an hour at most, when failed logins across the whole site cross the
 * ceiling. Correct passwords keep working throughout, so this is information
 * rather than an emergency.
 */
export async function notifyAttack(notice: AttackNotice): Promise<void> {
  const to = process.env.NOTIFY_EMAIL;
  const apiKey = process.env.RESEND_API_KEY;
  const summary = `${notice.failures} failed logins in ${notice.windowMinutes} minutes at ${notice.origin}`;
  if (!to || !apiKey) {
    console.warn(`[guard] ${summary} (no NOTIFY_EMAIL/RESEND_API_KEY, not emailed)`);
    return;
  }

  const html = [
    `<h2>Unusual login activity</h2>`,
    `<p><strong>${notice.failures}</strong> failed logins in the last`,
    `${notice.windowMinutes} minutes at ${escapeHtml(notice.origin)}.</p>`,
    `<p>Guesses are being refused for now. Anyone with a correct password can still`,
    `get in, so nobody is locked out.</p>`,
    `<p>Nothing needs doing unless this keeps up. If it does, revoking and reissuing`,
    `the keys for the board in question is the direct fix.</p>`,
  ].join('\n');

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: process.env.NOTIFY_FROM || 'onboarding@resend.dev',
        to: [to],
        subject: 'Unusual login activity on your board',
        html,
      }),
    });
    if (!res.ok) console.error(`[guard] alert failed: ${res.status} ${await res.text()}`);
  } catch (error) {
    console.error('[guard] alert threw', error);
  }
}

/**
 * Sends someone the passphrase for boards registered to their address. This is
 * the only way back in for a board whose passphrase has been lost, since there
 * are no accounts to reset.
 */
export async function sendRecovery(
  to: string,
  boards: { title: string; passphrase: string }[],
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`[recovery] ${boards.length} board(s) for a caller, but RESEND_API_KEY is unset`);
    return;
  }

  const rows = boards
    .map(
      (board) =>
        `<li><strong>${escapeHtml(board.title)}</strong><br>` +
        `<code style="font-size:16px">${escapeHtml(board.passphrase)}</code></li>`,
    )
    .join('\n');

  const html = [
    `<h2>Your board${boards.length > 1 ? 's' : ''}</h2>`,
    `<p>Type the passphrase on the board's front page to get back in.</p>`,
    `<ul>${rows}</ul>`,
    `<p style="color:#666;font-size:13px">If you did not ask for this, nothing has changed`,
    `and you can ignore it. Anyone holding a passphrase can open that board, so keep it`,
    `to yourself.</p>`,
  ].join('\n');

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: process.env.NOTIFY_FROM || 'onboarding@resend.dev',
        to: [to],
        subject: 'Getting back into your board',
        html,
      }),
    });
    if (!res.ok) console.error(`[recovery] send failed: ${res.status} ${await res.text()}`);
  } catch (error) {
    console.error('[recovery] send threw', error);
  }
}
