import { useEffect, useState } from 'react';
import { REPORT_REASONS, type Report, type ReportStatus } from '../../shared/types';
import * as api from '../lib/api';
import Scrim from './Scrim';

interface Props {
  onOpenBoard: (boardId: string) => void;
  onClose: () => void;
  onChanged: () => void;
}

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

const labelFor = (value: string) =>
  REPORT_REASONS.find((r) => r.value === value)?.label ?? value;

export default function ReportsDialog({ onOpenBoard, onClose, onChanged }: Props) {
  const [reports, setReports] = useState<Report[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showClosed, setShowClosed] = useState(false);

  const load = () =>
    api
      .getReports()
      .then(setReports)
      .catch((e: Error) => setError(e.message));

  useEffect(() => {
    void load();
  }, []);

  const set = async (id: string, status: ReportStatus) => {
    try {
      await api.setReportStatus(id, status);
      await load();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const visible = (reports ?? []).filter((r) => showClosed || r.status === 'open');

  return (
    <Scrim label="Reports" onClose={onClose}>
        <h2>Reports</h2>
        <p className="lede">
          Boards someone has flagged as possibly illegal. Open one to see it &mdash; your master
          password shows any board &mdash; then act on it or dismiss it.
        </p>

        <div className="chooser" style={{ marginBottom: 18 }}>
          <button type="button" className={showClosed ? '' : 'on'} onClick={() => setShowClosed(false)}>
            Open
          </button>
          <button type="button" className={showClosed ? 'on' : ''} onClick={() => setShowClosed(true)}>
            Everything
          </button>
        </div>

        {error ? <p className="error-text">{error}</p> : null}

        {reports === null ? (
          <p className="empty-state">Loading...</p>
        ) : visible.length === 0 ? (
          <p className="empty-state">
            {showClosed ? 'No reports at all.' : 'Nothing open. Nobody has flagged anything.'}
          </p>
        ) : (
          visible.map((report) => (
            <div className="row-card" key={report.id}>
              <div className="row-head">
                <div>
                  <div className="row-title">
                    {report.boardTitle}
                    {report.reason === 'csam' ? <span className="tag warn">urgent</span> : null}
                  </div>
                  <div className="row-sub">
                    {labelFor(report.reason)} &middot; {when(report.createdAt)}
                  </div>
                </div>
                <span className={`status ${report.status === 'open' ? 'new' : 'archived'}`}>
                  {report.status}
                </span>
              </div>

              {report.detail ? <p className="note">{report.detail}</p> : null}

              <div className="actions">
                <button className="btn ghost" onClick={() => onOpenBoard(report.boardId)}>
                  Open the board
                </button>
                {report.status === 'open' ? (
                  <>
                    <button className="btn ghost" onClick={() => set(report.id, 'actioned')}>
                      Mark dealt with
                    </button>
                    <button className="btn ghost" onClick={() => set(report.id, 'dismissed')}>
                      Dismiss
                    </button>
                  </>
                ) : (
                  <button className="btn ghost" onClick={() => set(report.id, 'open')}>
                    Reopen
                  </button>
                )}
              </div>
            </div>
          ))
        )}

        <div className="btn-row">
          <button className="btn ghost" type="button" onClick={onClose}>
            Close
          </button>
        </div>
    </Scrim>
  );
}
