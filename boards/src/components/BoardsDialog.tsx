import { useEffect, useState } from 'react';
import type { BoardSummary } from '../../shared/types';
import * as api from '../lib/api';

interface Props {
  currentId: string | null;
  onOpen: (boardId: string) => void;
  onManageKeys: (board: BoardSummary) => void;
  onClose: () => void;
}

export default function BoardsDialog({ currentId, onOpen, onManageKeys, onClose }: Props) {
  const [boards, setBoards] = useState<BoardSummary[] | null>(null);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const load = () =>
    api
      .getBoards()
      .then(setBoards)
      .catch((e: Error) => setError(e.message));

  useEffect(() => {
    void load();
  }, []);

  const add = async () => {
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const board = await api.createBoard(title.trim());
      setTitle('');
      await load();
      onOpen(board.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const rename = async (board: BoardSummary) => {
    const next = window.prompt('Rename this board', board.title);
    if (!next?.trim() || next.trim() === board.title) return;
    try {
      await api.renameBoard(board.id, next.trim());
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const remove = async (board: BoardSummary) => {
    try {
      await api.deleteBoard(board.id);
      setConfirming(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="modal-scrim" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label="Boards">
        <h2>Boards</h2>
        <p className="lede">
          Each board has its own passwords. Someone holding a key for one board cannot see that
          any of the others exist.
        </p>

        {error ? <p className="error-text">{error}</p> : null}

        {boards === null ? (
          <p className="empty-state">Loading...</p>
        ) : (
          boards.map((board) => (
            <div className={`row-card${board.id === currentId ? ' current' : ''}`} key={board.id}>
              <div className="row-head">
                <div>
                  <div className="row-title">
                    {board.title}
                    {board.official ? <span className="tag official-tag">official</span> : null}
                    {board.id === currentId ? <span className="tag">open</span> : null}
                  </div>
                  <div className="row-sub">
                    {board.itemCount} {board.itemCount === 1 ? 'item' : 'items'} &middot;{' '}
                    {board.keyCount} {board.keyCount === 1 ? 'key' : 'keys'}
                  </div>
                </div>
              </div>

              {confirming === board.id ? (
                <div className="danger-zone">
                  <p>
                    Delete <strong>{board.title}</strong>? Its items, images, submissions, and
                    every key that opens it go too. This cannot be undone.
                  </p>
                  <div className="actions">
                    <button className="btn danger" onClick={() => remove(board)}>
                      Delete it
                    </button>
                    <button className="btn ghost" onClick={() => setConfirming(null)}>
                      Keep it
                    </button>
                  </div>
                </div>
              ) : (
                <div className="actions">
                  {board.id === currentId ? null : (
                    <button className="btn ghost" onClick={() => onOpen(board.id)}>
                      Open
                    </button>
                  )}
                  <button className="btn ghost" onClick={() => onManageKeys(board)}>
                    Keys
                  </button>
                  <button className="btn ghost" onClick={() => rename(board)}>
                    Rename
                  </button>
                  <button
                    className="btn ghost"
                    title="Mark this as a board run by the site rather than by a person"
                    onClick={async () => {
                      await api
                        .setBoardOfficial(board.id, !board.official)
                        .catch((e: Error) => setError(e.message));
                      await load();
                    }}
                  >
                    {board.official ? 'Unmark official' : 'Mark official'}
                  </button>
                  <button className="btn ghost" onClick={() => setConfirming(board.id)}>
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))
        )}

        <div className="field" style={{ marginTop: 22 }}>
          <label>New board</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void add()}
            placeholder="What is this one called?"
          />
        </div>

        <div className="btn-row">
          <button className="btn" type="button" onClick={add} disabled={busy || !title.trim()}>
            {busy ? 'Putting it up...' : 'Put up a new board'}
          </button>
          <button className="btn ghost" type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
