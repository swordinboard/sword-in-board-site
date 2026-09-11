import { useEffect, useState } from 'react';
import type { BoardSummary } from '../../shared/types';
import * as api from '../lib/api';
import Scrim from './Scrim';

interface Props {
  currentId: string | null;
  onOpen: (boardId: string) => void;
  onManageKeys: (board: BoardSummary) => void;
  onClose: () => void;
}

type Shelf = 'mine' | 'theirs' | 'all';

export default function BoardsDialog({ currentId, onOpen, onManageKeys, onClose }: Props) {
  const [boards, setBoards] = useState<BoardSummary[] | null>(null);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [shelf, setShelf] = useState<Shelf>('mine');

  const load = () =>
    api
      .getBoards()
      .then((next) => {
        setBoards(next);
        return next;
      })
      .catch((e: Error) => setError(e.message));

  useEffect(() => {
    // Open on whichever shelf the board being looked at is on. Defaulting to
    // "Mine" would otherwise hide the current board the moment it belongs to
    // somebody else, which is the confusing half of the old flat list all
    // over again.
    void load().then((next) => {
      const current = next?.find((b) => b.id === currentId);
      if (current && !current.house) setShelf('theirs');
    });
  }, [currentId]);

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

  const all = boards ?? [];
  const counts = {
    mine: all.filter((b) => b.house).length,
    theirs: all.filter((b) => !b.house).length,
    all: all.length,
  };
  const shown =
    shelf === 'all' ? all : all.filter((b) => (shelf === 'mine' ? b.house : !b.house));

  return (
    <Scrim label="Boards" onClose={onClose}>
        <h2>Boards</h2>
        <p className="lede">
          Each board has its own passwords. Someone holding a key for one board cannot see that
          any of the others exist.
        </p>

        {/*
          Two shelves, because past a handful of signups the list stops being
          navigable: the boards worth reaching quickly are the site's own, and
          they end up buried among other people's. The mark is private - it
          says which shelf a board sits on here, and claims nothing publicly.
        */}
        <div className="chooser shelves">
          {(['mine', 'theirs', 'all'] as Shelf[]).map((option) => (
            <button
              type="button"
              key={option}
              className={shelf === option ? 'on' : ''}
              onClick={() => setShelf(option)}
            >
              {option === 'mine' ? 'Mine' : option === 'theirs' ? "People's" : 'All'}
              {boards ? <span className="count">{counts[option]}</span> : null}
            </button>
          ))}
        </div>


        {boards === null ? (
          <p className="empty-state">Loading...</p>
        ) : shown.length === 0 ? (
          <p className="empty-state">
            {shelf === 'mine'
              ? 'None of the boards are filed as yours yet. Any you put up here will be, and you can move an existing one across with "File as mine".'
              : "Nobody else has put up a board yet."}
          </p>
        ) : (
          shown.map((board) => (
            <div className={`row-card${board.id === currentId ? ' current' : ''}`} key={board.id}>
              <div className="row-head">
                <div>
                  <div className="row-title">
                    {board.title}
                    {board.official ? <span className="tag official-tag">official</span> : null}
                    {board.house && shelf === 'all' ? <span className="tag">mine</span> : null}
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
                    title="Which shelf this sits on in your own list. Nobody else sees it."
                    onClick={async () => {
                      await api
                        .setBoardHouse(board.id, !board.house)
                        .catch((e: Error) => setError(e.message));
                      await load();
                    }}
                  >
                    {board.house ? 'File as theirs' : 'File as mine'}
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

        {error ? <p className="error-text">{error}</p> : null}
        <div className="btn-row">
          <button className="btn" type="button" onClick={add} disabled={busy || !title.trim()}>
            {busy ? 'Putting it up...' : 'Put up a new board'}
          </button>
          <button className="btn ghost" type="button" onClick={onClose}>
            Close
          </button>
        </div>
    </Scrim>
  );
}
