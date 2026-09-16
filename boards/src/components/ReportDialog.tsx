import { useState } from 'react';
import { REPORT_REASONS, type ReportReason } from '../../shared/types';
import * as api from '../lib/api';
import Scrim from './Scrim';

interface Props {
  boardTitle: string;
  onClose: () => void;
  onDone: (message: string) => void;
}

export default function ReportDialog({ boardTitle, onClose, onDone }: Props) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (!reason) return;
    setBusy(true);
    setError(null);
    try {
      await api.reportBoard({ reason, detail: detail.trim() || undefined });
      onDone('Reported. It will be looked at.');
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Scrim label="Report this board" onClose={onClose}>
        <h2>Report this board</h2>
        <p className="lede">
          This is for things that may be <strong>against the law</strong> &mdash; not for a board
          you simply dislike or disagree with. Nobody here is judging taste; the point is that
          nothing criminal sits on this site.
        </p>

        <div className="field">
          <label>What is wrong with it</label>
          {REPORT_REASONS.map((option) => (
            <button
              type="button"
              key={option.value}
              className={`reason${reason === option.value ? ' on' : ''}`}
              onClick={() => setReason(option.value)}
            >
              <span className="reason-label">{option.label}</span>
              <span className="reason-hint">{option.hint}</span>
            </button>
          ))}
        </div>

        <div className="field">
          <label>
            Anything else worth knowing{reason === 'other-illegal' ? '' : ' (optional)'}
          </label>
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="Where on the board, and what it is."
          />
        </div>

        <p className="fine">
          Reporting <strong>{boardTitle}</strong>. Your report is not shown to whoever runs this
          board.
        </p>

        {error ? <p className="error-text">{error}</p> : null}

        <div className="btn-row">
          <button className="btn danger" type="button" onClick={send} disabled={busy || !reason}>
            {busy ? 'Sending...' : 'Send the report'}
          </button>
          <button className="btn ghost" type="button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
        </div>
    </Scrim>
  );
}
