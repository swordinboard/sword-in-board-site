import { useState } from 'react';
import type { NewBoardResult, SessionInfo, SiteInfo } from '../../shared/types';
import * as api from '../lib/api';
import { copyText } from '../lib/share';

interface Props {
  title: string;
  site: SiteInfo | null;
  onEntered: (session: SessionInfo) => void;
  onCreated: (result: NewBoardResult) => void;
}

type Panel = 'enter' | 'create' | 'recover';

export default function LoginGate({ title, site, onEntered, onCreated }: Props) {
  const [panel, setPanel] = useState<Panel>('enter');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create
  const [boardName, setBoardName] = useState('');
  const [invite, setInvite] = useState('');
  const [email, setEmail] = useState('');
  const [made, setMade] = useState<NewBoardResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [noEmail, setNoEmail] = useState(false);

  // Recover
  const [recoverEmail, setRecoverEmail] = useState('');
  const [recoverNote, setRecoverNote] = useState<string | null>(null);

  const go = async (run: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await run();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const enter = (event: React.FormEvent) => {
    event.preventDefault();
    if (!password) return;
    void go(async () => onEntered(await api.login(password)));
  };

  const create = (event: React.FormEvent) => {
    event.preventDefault();
    if (!boardName.trim()) return;
    void go(async () => {
      setMade(
        await api.createOwnBoard({
          title: boardName.trim(),
          invite: invite.trim() || undefined,
          email: email.trim() || undefined,
        }),
      );
    });
  };

  const recover = (event: React.FormEvent) => {
    event.preventDefault();
    if (!recoverEmail.trim()) return;
    void go(async () => {
      const res = await api.recoverByEmail(recoverEmail.trim());
      setRecoverNote(res.message);
    });
  };

  /* ---------- the passphrase, shown exactly once ---------- */

  if (made) {
    return (
      <div className="gate">
        <div className="gate-card wide">
          <h1>{made.board.title}</h1>
          <p>
            This is the passphrase that opens and edits your board. Write it down now &mdash; it
            is the only way back in.
          </p>

          <button
            className="secret standalone"
            type="button"
            onClick={async () => {
              if (await copyText(made.passphrase)) {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }
            }}
          >
            <code>{made.passphrase}</code>
            <span>{copied ? 'copied' : 'copy'}</span>
          </button>

          <p className="fine">
            {made.recoveryEmailSaved
              ? 'A copy can be sent to the address you gave, if you lose it.'
              : 'You gave no email, so nobody can send this back to you if it is lost.'}
          </p>

          <label className="confirm">
            <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
            <span>I have saved it somewhere</span>
          </label>

          <button
            className="btn"
            type="button"
            disabled={!saved}
            onClick={() => onCreated(made)}
          >
            Go to my board
          </button>
        </div>
      </div>
    );
  }

  /* ---------- make a board ---------- */

  if (panel === 'create') {
    return (
      <div className="gate">
        <form className="gate-card wide" onSubmit={create}>
          <h1>Put up a board</h1>
          <p>
            You will get one passphrase. It opens the board and lets you change it, and you can
            make separate look-only passwords afterwards.
          </p>

          <div className="field">
            <label htmlFor="board-name">What is it called</label>
            <input
              id="board-name"
              type="text"
              value={boardName}
              onChange={(e) => setBoardName(e.target.value)}
              placeholder="The kitchen wall"
              autoFocus
            />
          </div>

          {site?.needsInvite ? (
            <div className="field">
              <label htmlFor="invite-code">Invite code</label>
              <input
                id="invite-code"
                type="text"
                value={invite}
                onChange={(e) => setInvite(e.target.value)}
                placeholder="The code you were given"
              />
            </div>
          ) : null}

          <div className="field">
            <label htmlFor="recovery-email">
              Email {site?.recoveryAvailable ? '(strongly advised)' : '(optional)'}
            </label>
            <input
              id="recovery-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
            <p className="note">
              {site?.recoveryAvailable
                ? 'Never a login and never shown to anyone. Its only use is sending your passphrase back if you lose it. One address can hold as many boards as you like — asking for it later sends every one of them back.'
                : 'Recovery email is not working on this site at the moment, so an address saved now cannot be used to get back in. Write the passphrase down.'}
            </p>
          </div>

          {/*
            Going without is allowed, but not by default and not by accident:
            the passphrase is shown once and there is genuinely nothing behind
            it. Somebody who skips this on the way past has lost the board the
            moment they close the tab.
          */}
          {!email.trim() && site?.recoveryAvailable ? (
            <label className="confirm compact">
              <input
                type="checkbox"
                checked={noEmail}
                onChange={(e) => setNoEmail(e.target.checked)}
              />
              <span>
                No email. I understand the passphrase is shown once and there is no way back
                without it.
              </span>
            </label>
          ) : null}

          <p className="fine">
            Boards are cleared after {site ? Math.round(site.ttlDays / 30) : 6} months with
            nobody looking at them. Whoever runs this site can see any board on it, so keep
            anything private off it.
          </p>

          {error ? <p className="error-text">{error}</p> : null}

          <button
            className="btn"
            type="submit"
            disabled={
              busy ||
              !boardName.trim() ||
              (!email.trim() && Boolean(site?.recoveryAvailable) && !noEmail)
            }
          >
            {busy ? 'Putting it up...' : 'Put it up'}
          </button>
          <button className="btn ghost wide-btn" type="button" onClick={() => setPanel('enter')}>
            Back
          </button>
        </form>
      </div>
    );
  }

  /* ---------- lost passphrase ---------- */

  if (panel === 'recover') {
    return (
      <div className="gate">
        <form className="gate-card" onSubmit={recover}>
          <h1>Lost the passphrase</h1>
          <p>
            If you left an email when you made the board, it can be sent back to you. If you did
            not, there is unfortunately no way in.
          </p>
          <div className="field">
            <label htmlFor="recover-email">Your email</label>
            <input
              id="recover-email"
              type="email"
              value={recoverEmail}
              onChange={(e) => setRecoverEmail(e.target.value)}
              autoFocus
            />
          </div>
          {recoverNote ? <p className="fine ok">{recoverNote}</p> : null}
          {error ? <p className="error-text">{error}</p> : null}
          <button className="btn" type="submit" disabled={busy || !recoverEmail.trim()}>
            {busy ? 'Looking...' : 'Send it to me'}
          </button>
          <button className="btn ghost wide-btn" type="button" onClick={() => setPanel('enter')}>
            Back
          </button>
        </form>
      </div>
    );
  }

  /* ---------- the ordinary way in ---------- */

  return (
    <div className="gate">
      <form className="gate-card" onSubmit={enter}>
        <img className="gate-logo" src="/logo-light.svg" alt="" width={104} height={91} />
        <h1>{title}</h1>
        <p>This board is private. Enter the password to have a look.</p>
        <div className="field">
          <label htmlFor="board-password">Password</label>
          <input
            id="board-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
        </div>
        <button className="btn" type="submit" disabled={busy || !password}>
          {busy ? 'Checking...' : 'Come in'}
        </button>
        {error ? <p className="error-text">{error}</p> : null}

        {site?.canCreate || site?.recoveryAvailable ? (
          <div className="gate-links">
            {site?.canCreate ? (
              <button type="button" onClick={() => setPanel('create')}>
                Put up a board of your own
              </button>
            ) : null}
            {site?.recoveryAvailable ? (
              <button type="button" onClick={() => setPanel('recover')}>
                Lost the passphrase
              </button>
            ) : null}
          </div>
        ) : null}

        {/*
          The notices, where somebody can read them before they are in rather
          than only after. The first line of the site rules is the one that
          matters - a board is as private as a corkboard in a hallway - and it
          is no use to anyone buried behind a sign-in.
        */}
        <p className="fine gate-legal">
          <a href="/legal/rules.html">Site rules</a>
          {' · '}
          <a href="/legal/privacy.html">Privacy</a>
          {' · '}
          <a href="/legal/reporting.html">Reporting</a>
        </p>
      </form>
    </div>
  );
}
