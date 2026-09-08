import { useState } from 'react';
import type { SessionInfo } from '../../shared/types';
import { login } from '../lib/api';

interface Props {
  title: string;
  onEntered: (session: SessionInfo) => void;
}

export default function LoginGate({ title, onEntered }: Props) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!password) return;
    setBusy(true);
    setError(null);
    try {
      onEntered(await login(password));
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="gate">
      <form className="gate-card" onSubmit={submit}>
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
      </form>
    </div>
  );
}
