import { useEffect, useState } from 'react';
import type { AccessKey, Role } from '../../shared/types';
import { KEY_MIN_LENGTH } from '../../shared/types';
import { strengthOf } from '../lib/strength';
import * as api from '../lib/api';
import { copyText } from '../lib/share';

interface Props {
  boardId: string;
  boardTitle: string;
  onClose: () => void;
  onChanged?: () => void;
}

const when = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export default function KeysDialog({ boardId, boardTitle, onClose, onChanged }: Props) {
  const [keys, setKeys] = useState<AccessKey[] | null>(null);
  const [label, setLabel] = useState('');
  const [role, setRole] = useState<Role>('viewer');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [acceptWeak, setAcceptWeak] = useState(false);

  const load = () =>
    api
      .getKeys(boardId)
      .then(setKeys)
      .catch((e: Error) => setError(e.message));

  useEffect(() => {
    void load();
    // Reload whenever the dialog is pointed at a different board.
  }, [boardId]);

  const add = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.createKey({
        boardId,
        label: label.trim() || 'Unlabelled',
        role,
        password: password.trim() || undefined,
        acknowledgeWeak: acceptWeak || undefined,
      });
      setLabel('');
      setPassword('');
      setRole('viewer');
      setAcceptWeak(false);
      await load();
      onChanged?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (key: AccessKey) => {
    try {
      await api.revokeKey(key.id);
      setConfirming(null);
      await load();
      onChanged?.();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // Warn about a weak custom password before the form is sent; the server
  // makes the actual decision.
  // Strength is shown as advice. A weak password is allowed once it has been
  // confirmed, because a board meant to be handed round freely may want one.
  const strength = password.trim() ? strengthOf(password) : null;
  const needsConfirming = strength !== null && !strength.ok;

  const take = async (value: string, id: string) => {
    if (await copyText(value)) {
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 2000);
    }
  };

  return (
    <div className="modal-scrim" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label="Access keys">
        <h2>Keys for {boardTitle}</h2>
        <p className="lede">
          Each password opens this board and no other. Hand one to each person, then revoke just
          theirs later without disturbing anybody else. Share the link with the button in the
          menu, and tell them the password some other way.
        </p>

        {error ? <p className="error-text">{error}</p> : null}

        {keys === null ? (
          <p className="empty-state">Loading...</p>
        ) : keys.length === 0 ? (
          <p className="empty-state">No keys yet. Nobody can open this board but you.</p>
        ) : (
          keys.map((key) => (
            <div className="row-card" key={key.id}>
              <div className="row-head">
                <div>
                  <div className="row-title">
                    {key.label}
                    {key.role === 'editor' ? <span className="tag warn">can edit</span> : null}
                  </div>
                  <div className="row-sub">
                    Made {when(key.createdAt)}
                    {key.lastUsedAt ? ` · last used ${when(key.lastUsedAt)}` : ' · never used'}
                  </div>
                </div>
              </div>

              {key.secret ? (
                <button
                  className="secret"
                  type="button"
                  title="Copy this password"
                  onClick={() => take(key.secret as string, key.id)}
                >
                  <code>{key.secret}</code>
                  <span>{copied === key.id ? 'copied' : 'copy'}</span>
                </button>
              ) : null}

              {confirming === key.id ? (
                <div className="danger-zone">
                  <p>
                    Revoke <strong>{key.label}</strong>? Anyone using it is locked out
                    immediately, even if they are looking at the board right now.
                  </p>
                  <div className="actions">
                    <button className="btn danger" onClick={() => revoke(key)}>
                      Revoke it
                    </button>
                    <button className="btn ghost" onClick={() => setConfirming(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="actions">
                  <button className="btn ghost" onClick={() => setConfirming(key.id)}>
                    Revoke
                  </button>
                </div>
              )}
            </div>
          ))
        )}

        <div className="section-rule" />

        <div className="field">
          <label>Who is this key for</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="A name, so you can revoke the right one later"
          />
        </div>

        <div className="field">
          <label>What it lets them do</label>
          <div className="chooser">
            <button
              type="button"
              className={role === 'viewer' ? 'on' : ''}
              onClick={() => setRole('viewer')}
            >
              Look only
              <span className="sub">Can view and submit</span>
            </button>
            <button
              type="button"
              className={role === 'editor' ? 'on' : ''}
              onClick={() => setRole('editor')}
            >
              Edit this board
              <span className="sub">Can rearrange and pin things up</span>
            </button>
          </div>
        </div>

        <div className="field">
          <label>Password (optional)</label>
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Leave blank for one that is easy to say out loud"
          />
          <div className="chooser" style={{ marginTop: 8 }}>
            <button type="button" onClick={() => setPassword(boardTitle)}>
              Use the board's name
            </button>
            <button type="button" onClick={() => setPassword('')}>
              Generate one instead
            </button>
          </div>

          {strength ? (
            <p className={`strength ${strength.ok ? 'ok' : 'weak'}`}>
              {strength.label} &middot; about {strength.bits} bits
            </p>
          ) : null}

          {needsConfirming ? (
            <label className="confirm compact">
              <input
                type="checkbox"
                checked={acceptWeak}
                onChange={(e) => setAcceptWeak(e.target.checked)}
              />
              <span>
                {role === 'editor'
                  ? 'Use it anyway. Anyone who guesses it can change this board.'
                  : 'Use it anyway. This board is meant to be easy to get into.'}
              </span>
            </label>
          ) : null}

          <p className="note">
            At least {KEY_MIN_LENGTH} characters, and it cannot already open another board.
            Anything easy to guess is allowed once you confirm it &mdash; a password opens only
            this board, so a simple one risks nothing else. Leave it blank for a generated
            passphrase like <code>thistle-copper-lantern-4827</code>, about 42 bits.
          </p>
        </div>

        <div className="btn-row">
          <button
            className="btn"
            type="button"
            onClick={add}
            disabled={busy || (needsConfirming && !acceptWeak)}
          >
            {busy ? 'Cutting the key...' : 'Make a key'}
          </button>
          <button className="btn ghost" type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
