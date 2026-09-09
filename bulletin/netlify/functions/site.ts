import type { Config } from '@netlify/functions';
import { json, masterPassword } from './_lib/auth';
import { boardTtlDays, signupMode } from './_lib/store';
import { SITE_DEFAULT_NAME, type SiteInfo } from '../../shared/types';

/**
 * What the login screen needs before anyone has signed in: whether boards can
 * be made, whether that needs a code, and how long an untouched board lasts.
 *
 * Deliberately says nothing about which boards exist or how many.
 */
export default async (): Promise<Response> => {
  const mode = signupMode();
  const info: SiteInfo = {
    signupMode: mode,
    canCreate: Boolean(masterPassword()) && mode !== 'closed',
    needsInvite: mode === 'invite',
    ttlDays: boardTtlDays(),
    recoveryAvailable: Boolean(process.env.NOTIFY_EMAIL && process.env.RESEND_API_KEY),
    title: process.env.SITE_NAME || SITE_DEFAULT_NAME,
  };
  return json(info);
};

export const config: Config = { path: '/api/site' };
