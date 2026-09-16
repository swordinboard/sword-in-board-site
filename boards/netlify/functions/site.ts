import type { Config } from '@netlify/functions';
import { json, masterPassword, sessionFor } from './_lib/auth';
import { boardTtlDays, signupMode } from './_lib/store';
import { SITE_DEFAULT_NAME, type MailStatus, type SiteInfo } from '../../shared/types';

/**
 * What the login screen needs before anyone has signed in: whether boards can
 * be made, whether that needs a code, and how long an untouched board lasts.
 *
 * Deliberately says nothing about which boards exist or how many. The mail
 * diagnosis is the one part held back for a developer session.
 */

function mailStatus(): MailStatus {
  const hasKey = Boolean(process.env.RESEND_API_KEY?.trim());
  const hasSender = Boolean(process.env.NOTIFY_FROM?.trim());
  return { hasKey, hasSender, ownInboxOnly: hasKey && !hasSender };
}

export default async (req: Request): Promise<Response> => {
  const mode = signupMode();
  const mail = mailStatus();
  const info: SiteInfo = {
    signupMode: mode,
    canCreate: Boolean(masterPassword()) && mode !== 'closed',
    needsInvite: mode === 'invite',
    ttlDays: boardTtlDays(),
    // Recovery has to reach a stranger's inbox, which the shared resend.dev
    // sender refuses. Offering it while it cannot deliver is worse than not
    // offering it: the reply is identical either way, so nobody finds out.
    recoveryAvailable: mail.hasKey && mail.hasSender,
    /*
     * PINHOLD_NAME rather than SITE_NAME: Netlify sets SITE_NAME itself, to
     * the site's own slug, so reading it put "pinhold-swordinboard" on the
     * sign-in screen of every deployment that had never set it. A variable
     * the host already owns is not a variable this app can have.
     */
    title: process.env.PINHOLD_NAME?.trim() || SITE_DEFAULT_NAME,
  };

  const session = await sessionFor(req);
  if (session?.master) info.mail = mail;

  return json(info);
};

export const config: Config = { path: '/api/site' };
