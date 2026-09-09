import { useEffect, useState } from 'react';
import type { Submission, SubmissionStatus } from '../../shared/types';
import { deleteSubmission, getSubmissions, mediaUrl, setSubmissionStatus } from '../lib/api';

interface Props {
  boardId: string;
  onClose: () => void;
  onPlaceMedia: (src: string) => void;
  onChanged: () => void;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

export default function InboxDialog({ boardId, onClose, onPlaceMedia, onChanged }: Props) {
  const [items, setItems] = useState<Submission[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    getSubmissions(boardId)
      .then(setItems)
      .catch((e: Error) => setError(e.message));
  }, [boardId]);

  const update = async (id: string, status: SubmissionStatus) => {
    try {
      const next = await setSubmissionStatus(id, status);
      setItems((current) =>
        current ? current.map((item) => (item.id === id ? next : item)) : current,
      );
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteSubmission(id);
      setItems((current) => (current ? current.filter((item) => item.id !== id) : current));
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const visible = (items ?? []).filter(
    (item) => showArchived || item.status !== 'archived',
  );

  return (
    <div className="modal-scrim" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label="Submissions">
        <h2>Submissions</h2>
        <p className="lede">
          Everything sent in, waiting on you. Click any image to crop and pin it up.
        </p>

        <div className="chooser" style={{ marginBottom: 18 }}>
          <button
            type="button"
            className={showArchived ? '' : 'on'}
            onClick={() => setShowArchived(false)}
          >
            Active
          </button>
          <button
            type="button"
            className={showArchived ? 'on' : ''}
            onClick={() => setShowArchived(true)}
          >
            Everything
          </button>
        </div>

        {error ? <p className="error-text">{error}</p> : null}

        {items === null ? (
          <p className="empty-state">Loading...</p>
        ) : visible.length === 0 ? (
          <p className="empty-state">Nothing waiting. The inbox is clear.</p>
        ) : (
          visible.map((item) => (
            <div className="sub-card" key={item.id}>
              <div className="head">
                <div>
                  <div className="who">{item.submitter}</div>
                  <div className="when">{formatDate(item.createdAt)}</div>
                </div>
                <span className={`status ${item.status}`}>{item.status}</span>
              </div>

              {item.note ? <p className="note">{item.note}</p> : null}
              {item.contact ? <p className="contact">Reach them at {item.contact}</p> : null}

              {item.mediaIds.length > 0 ? (
                <div className="thumb-row">
                  {item.mediaIds.map((id) => (
                    <div
                      className="thumb pickable"
                      key={id}
                      title="Crop and pin this up"
                      onClick={() => onPlaceMedia(mediaUrl(id, boardId))}
                    >
                      <img src={mediaUrl(id, boardId)} alt="" />
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="actions">
                {item.status !== 'reviewed' ? (
                  <button className="btn ghost" onClick={() => update(item.id, 'reviewed')}>
                    Mark reviewed
                  </button>
                ) : null}
                {item.status !== 'placed' ? (
                  <button className="btn ghost" onClick={() => update(item.id, 'placed')}>
                    Mark placed
                  </button>
                ) : null}
                {item.status !== 'archived' ? (
                  <button className="btn ghost" onClick={() => update(item.id, 'archived')}>
                    Archive
                  </button>
                ) : null}
                <button className="btn danger" onClick={() => remove(item.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))
        )}

        <div className="btn-row">
          <button className="btn ghost" type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
