import { useEffect, useState } from 'react';
import type { Invite, SiteInfo } from '../../shared/types';
import * as api from '../lib/api';
import { copyText } from '../lib/share';

interface Props {
  site: SiteInfo | null;
  onClose: () => void;
}

const when = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export default function InvitesDialog({ site, onClose }: Props) {
  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [label, setLabel] = useState('');
  const [maxUses, setMaxUses] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = () =>
    api
      .getInvites()
      .then(setInvites)
      .catch((e: Error) => setError(e.message));

  useEffect(() => {
    void load();
  }, []);

  const add = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.createInvite({ label: label.trim() || 'Unlabelled', maxUses });
      setLabel('');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const take = async (value: string, id: string) => {
    if (await copyText(value)) {
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 2000);
    }
  };

  const mode = site?.signupMode ?? 'invite';

  return (
    <div className="modal-scrim" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label="Invite codes">
        <h2>Invite codes</h2>
        <p className="lede">
          A code lets somebody put up a board of their own. It is spent when they do, and opens
          nothing afterwards &mdash; it is not a password.
        </p>

        <div className={`mode-note ${mode}`}>
          {mode === 'invite' ? (
            <>
              <strong>Invite-only.</strong> A code is needed to put up a board. This is the
              setting to leave it on unless you mean to open it up.
            </>
          ) : mode === 'open' ? (
            <>
              <strong>Open to anyone.</strong> Codes are not being asked for &mdash; anybody who
              finds the site can put up a board, and upload to it.
            </>
          ) : (
            <>
              <strong>Closed.</strong> Nobody can put up a board, codes included. Only you can
              make them.
            </>
          )}
          <span className="how">
            Change it with the <code>SIGNUP_MODE</code> setting in Netlify.
          </span>
        </div>

        {error ? <p className="error-text">{error}</p> : null}

        {invites === null ? (
          <p className="empty-state">Loading...</p>
        ) : invites.length === 0 ? (
          <p className="empty-state">No codes yet. Nobody but you can put up a board.</p>
        ) : (
          invites.map((invite) => {
            const spent = invite.maxUses > 0 && invite.uses >= invite.maxUses;
            return (
              <div className="row-card" key={invite.id}>
                <div className="row-head">
                  <div>
                    <div className="row-title">
                      {invite.label}
                      {spent ? <span className="tag">used up</span> : null}
                    </div>
                    <div className="row-sub">
                      {invite.maxUses === 0
                        ? `${invite.uses} used · no limit`
                        : `${invite.uses} of ${invite.maxUses} used`}
                      {' · made '}
                      {when(invite.createdAt)}
                    </div>
                  </div>
                </div>

                {invite.code ? (
                  <button
                    className="secret"
                    type="button"
                    onClick={() => take(invite.code as string, invite.id)}
                  >
                    <code>{invite.code}</code>
                    <span>{copied === invite.id ? 'copied' : 'copy'}</span>
                  </button>
                ) : null}

                <div className="actions">
                  <button
                    className="btn ghost"
                    onClick={async () => {
                      await api.revokeInvite(invite.id).catch(() => undefined);
                      await load();
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })
        )}

        <div className="section-rule" />

        <div className="field">
          <label>Who is it for</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="A name, so you know who used it"
          />
        </div>

        <div className="field">
          <label>How many boards it can make</label>
          <div className="chooser">
            {[1, 5, 25, 0].map((n) => (
              <button
                type="button"
                key={n}
                className={maxUses === n ? 'on' : ''}
                onClick={() => setMaxUses(n)}
              >
                {n === 0 ? 'No limit' : n === 1 ? 'Just one' : `${n}`}
              </button>
            ))}
          </div>
        </div>

        <div className="btn-row">
          <button className="btn" type="button" onClick={add} disabled={busy}>
            {busy ? 'Making it...' : 'Make a code'}
          </button>
          <button className="btn ghost" type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
