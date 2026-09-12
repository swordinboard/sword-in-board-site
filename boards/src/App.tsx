import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BoardItem, BoardState, SessionInfo, SiteInfo } from '../shared/types';
import { MAX_BOARD_PICTURES } from '../shared/types';
import { SITE_NAME } from './lib/config';
import * as api from './lib/api';
import Board, { type BoardHandle } from './components/Board';
import LoginGate from './components/LoginGate';
import SidePanel from './components/SidePanel';
import SubmitDialog from './components/SubmitDialog';
import AddItemDialog, { type ItemDraft } from './components/AddItemDialog';
import InboxDialog from './components/InboxDialog';
import ItemInspector from './components/ItemInspector';
import GalleryDialog from './components/GalleryDialog';
import BoardsDialog from './components/BoardsDialog';
import KeysDialog from './components/KeysDialog';
import InvitesDialog from './components/InvitesDialog';
import ReportDialog from './components/ReportDialog';
import ReportsDialog from './components/ReportsDialog';
import { shareBoard } from './lib/share';

type Dialog = 'submit' | 'add' | 'inbox' | 'boards' | 'keys' | 'invites' | 'report' | 'reports' | null;

interface Toast {
  text: string;
  tone: 'ok' | 'error';
}

const SAVE_DELAY_MS = 600;
/**
 * How often an open page re-checks that its key still opens this board.
 *
 * Short enough that "immediately" in the revoke warning is honest, long
 * enough that a board left up all evening is not making a request a second.
 */
const SESSION_CHECK_MS = 45_000;

/*
 * Zoom runs from 8% to 300%, so a slider that moved through it linearly would
 * spend two thirds of its travel above 100% and squeeze everything below into
 * a sliver. Stepping by a constant ratio instead gives each end of the range
 * the same amount of thumb.
 */
const ZOOM_MIN = 0.08;
const ZOOM_MAX = 3;
const zoomToSlider = (z: number) =>
  Math.round((Math.log(z / ZOOM_MIN) / Math.log(ZOOM_MAX / ZOOM_MIN)) * 1000);
const sliderToZoom = (value: number) =>
  ZOOM_MIN * (ZOOM_MAX / ZOOM_MIN) ** (value / 1000);

export default function App() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [site, setSite] = useState<SiteInfo | null>(null);
  const [board, setBoard] = useState<BoardState | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [addSrc, setAddSrc] = useState<string | undefined>(undefined);
  const [editMode, setEditMode] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Picking an item and opening its settings are separate on purpose. On a
  // phone the settings panel comes up under the thumb, so opening it on every
  // tap made an item impossible to drag without changing it by accident.
  const [inspectingId, setInspectingId] = useState<string | null>(null);
  const [galleryId, setGalleryId] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [openReports, setOpenReports] = useState(0);
  /**
   * Which board is on screen. The master editor switches this freely; a
   * key-backed session is pinned to its own board by the server regardless.
   */
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const [keysFor, setKeysFor] = useState<{ id: string; title: string } | null>(null);
  const [zoom, setZoom] = useState(0.5);
  const [toast, setToast] = useState<Toast | null>(null);

  const boardHandle = useRef<BoardHandle>(null);
  const boardRef = useRef<BoardState | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  boardRef.current = board;

  const say = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    setToast({ text, tone });
    setTimeout(() => setToast((current) => (current?.text === text ? null : current)), 3600);
  }, []);

  /* ---------- session and initial load ---------- */

  useEffect(() => {
    api.getSite().then(setSite).catch(() => undefined);
    api
      .getSession()
      .then(setSession)
      .catch(() => setSession({ authenticated: false, role: null, master: false, boardId: null }));
  }, []);

  /**
   * Keeps the open page honest about whether its key still opens anything.
   *
   * The server turns a revoked key away on the very next request, but a page
   * already on screen makes almost no requests once it has loaded - a viewer
   * cannot even save - so without this it would sit there showing a board its
   * holder no longer has any right to. Re-checking on a timer and whenever
   * the tab is looked at again closes that gap; a 401 from any other call
   * closes it immediately.
   */
  useEffect(() => {
    if (!session?.authenticated) return;

    const lostIt = () => {
      setSession({ authenticated: false, role: null, master: false, boardId: null });
      setBoard(null);
      setDialog(null);
      say('That password no longer opens this board.', 'error');
    };

    const recheck = async () => {
      try {
        const now = await api.getSession();
        if (!now.authenticated) lostIt();
      } catch {
        // A network blip is not a revocation; the next check settles it.
      }
    };

    const timer = setInterval(recheck, SESSION_CHECK_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void recheck();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener(api.SIGNED_OUT, lostIt);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener(api.SIGNED_OUT, lostIt);
    };
  }, [session?.authenticated, say]);

  const refreshReports = useCallback(async () => {
    try {
      const all = await api.getReports();
      setOpenReports(all.filter((r) => r.status === 'open').length);
    } catch {
      // Only the master can read these; for anyone else the badge stays at zero.
    }
  }, []);

  const refreshPending = useCallback(async () => {
    try {
      const subs = await api.getSubmissions(activeBoardId);
      setPendingCount(subs.filter((entry) => entry.status === 'new').length);
    } catch {
      // A viewer cannot read the inbox; the badge simply stays at zero.
    }
  }, [activeBoardId]);

  // A review link from a notification names the board it belongs to.
  useEffect(() => {
    if (!session?.authenticated || !session.master) return;
    const requested = new URLSearchParams(window.location.search).get('board');
    if (requested) setActiveBoardId(requested);
  }, [session]);

  useEffect(() => {
    if (!session?.authenticated) return;
    setBoard(null);
    api
      .getBoard(activeBoardId)
      .then((next) => {
        setBoard(next);
        setActiveBoardId(next.id);
      })
      .catch((e: Error) => say(e.message, 'error'));
    if (session.master) void refreshReports();
    if (session.role === 'editor') {
      void refreshPending();
      if (new URLSearchParams(window.location.search).has('review')) setDialog('inbox');
    }
  }, [session, activeBoardId, refreshPending, refreshReports, say]);

  /* ---------- persistence ---------- */

  const persist = useCallback(
    (next: BoardState, when: 'now' | 'debounced') => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const run = async () => {
        try {
          const saved = await api.saveBoard(next, next.id);
          // Keep the server's timestamp without clobbering in-flight edits.
          setBoard((current) =>
            current ? { ...current, updatedAt: saved.updatedAt } : saved,
          );
        } catch (e) {
          say((e as Error).message, 'error');
        }
      };
      if (when === 'now') void run();
      else saveTimer.current = setTimeout(run, SAVE_DELAY_MS);
    },
    [say],
  );

  /** Saves whatever the board currently holds. Used at the end of a drag. */
  const commit = useCallback(() => {
    const current = boardRef.current;
    if (current) persist(current, 'debounced');
  }, [persist]);

  const moveItem = useCallback((id: string, x: number, y: number) => {
    setBoard((current) =>
      current
        ? {
            ...current,
            items: current.items.map((item) => (item.id === id ? { ...item, x, y } : item)),
          }
        : current,
    );
  }, []);

  const patchItem = useCallback((id: string, patch: Partial<BoardItem>) => {
    setBoard((current) =>
      current
        ? {
            ...current,
            items: current.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
          }
        : current,
    );
  }, []);

  const placeDraft = useCallback(
    async (draft: ItemDraft) => {
      const current = boardRef.current;
      if (!current) return;
      const center = boardHandle.current?.centerPoint() ?? {
        x: current.width / 2,
        y: current.height / 2,
      };
      const maxZ = current.items.reduce((top, item) => Math.max(top, item.z), 0);
      const item: BoardItem = {
        ...draft,
        id: crypto.randomUUID(),
        x: Math.round(center.x - draft.w / 2),
        y: Math.round(center.y - draft.h / 2),
        z: maxZ + 1,
        createdAt: new Date().toISOString(),
      };
      const next = { ...current, items: [...current.items, item] };
      setBoard(next);
      setSelectedId(item.id);
      setDialog(null);
      setAddSrc(undefined);
      persist(next, 'now');
      say('Pinned up. Drag it where you want it.');
    },
    [persist, say],
  );

  const removeSelected = useCallback(() => {
    const current = boardRef.current;
    if (!current || !selectedId) return;
    const next = { ...current, items: current.items.filter((item) => item.id !== selectedId) };
    setBoard(next);
    setSelectedId(null);
    setInspectingId(null);
    persist(next, 'now');
    say('Taken down.');
  }, [selectedId, persist, say]);

  /** How many more pictures this board will take before it is full. */
  const roomForPictures = useMemo(() => {
    const used = (board?.items ?? []).reduce(
      (total, item) => total + (item.mediaIds?.length ?? (item.mediaId ? 1 : 0)),
      0,
    );
    return Math.max(0, MAX_BOARD_PICTURES - used);
  }, [board]);

  /** The clock every whiteboard on this board counts against. */
  const setTimeZone = useCallback(
    (zone: string) => {
      const current = boardRef.current;
      if (!current) return;
      const next = { ...current, timeZone: zone };
      setBoard(next);
      persist(next, 'now');
    },
    [persist],
  );

  const bringToFront = useCallback(() => {
    const current = boardRef.current;
    if (!current || !selectedId) return;
    const maxZ = current.items.reduce((top, item) => Math.max(top, item.z), 0);
    patchItem(selectedId, { z: maxZ + 1 });
    commit();
  }, [selectedId, patchItem, commit]);

  const share = useCallback(async () => {
    const outcome = await shareBoard(boardRef.current?.title ?? SITE_NAME);
    if (outcome === 'copied') say('Link copied. The password still has to come from you.');
    else if (outcome === 'failed') say('Could not share the link on this device.', 'error');
  }, [say]);

  /* ---------- gates ---------- */

  const title = board?.title ?? SITE_NAME;

  if (session === null) {
    return <div className="gate" />;
  }

  if (!session.authenticated) {
    return (
      <LoginGate
        title={site?.title || SITE_NAME}
        site={site}
        onEntered={(next) => {
          setSession(next);
          say('Welcome in.');
        }}
        onCreated={(result) => {
          setBoard(result.board);
          setActiveBoardId(result.board.id);
          setSession({
            authenticated: true,
            role: 'editor',
            master: false,
            boardId: result.board.id,
          });
          setEditMode(true);
          say('Your board is up. Pin something to it.');
        }}
      />
    );
  }

  if (!board) {
    return (
      <div className="gate">
        <div className="gate-card">
          <h1>{SITE_NAME}</h1>
          <p>Putting the board up...</p>
        </div>
      </div>
    );
  }

  const inspecting = board.items.find((item) => item.id === inspectingId) ?? null;
  const gallery = board.items.find((item) => item.id === galleryId) ?? null;
  const canEdit = session.role === 'editor' && editMode;

  return (
    <>
      <Board
        ref={boardHandle}
        board={board}
        editable={canEdit}
        selectedId={canEdit ? selectedId : null}
        onSelect={(id) => {
          setSelectedId(id);
          if (id !== inspectingId) setInspectingId(null);
        }}
        onOpenSettings={(id) => {
          setSelectedId(id);
          setInspectingId(id);
        }}
        onOpenGallery={setGalleryId}
        onMoveItem={moveItem}
        onCommit={commit}
        onZoomChange={setZoom}
      />

      <div className="chrome">
        <button
          className="tridot"
          type="button"
          onClick={() => setPanelOpen(true)}
          aria-label="Open menu"
        >
          <span className="dot" />
          <span className="dot" />
          <span className="dot" />
          {pendingCount > 0 ? <span className="badge">{pendingCount}</span> : null}
        </button>

        {canEdit ? <div className="mode-flag">Editing</div> : null}

        <div className="zoom-bar">
          <input
            type="range"
            min={0}
            max={1000}
            value={zoomToSlider(zoom)}
            aria-label="Zoom"
            onChange={(e) => boardHandle.current?.zoomTo(sliderToZoom(Number(e.target.value)))}
          />
          <span className="level">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => boardHandle.current?.fit()} aria-label="Fit board">
            &#9635;
          </button>
        </div>
      </div>

      {gallery ? <GalleryDialog item={gallery} onClose={() => setGalleryId(null)} /> : null}

      {canEdit && inspecting ? (
        <ItemInspector
          item={inspecting}
          boardId={board?.id ?? ''}
          roomForPictures={roomForPictures}
          timeZone={board?.timeZone}
          onTimeZone={setTimeZone}
          onChange={(patch) => patchItem(inspecting.id, patch)}
          onCommit={commit}
          onDelete={removeSelected}
          onBringToFront={bringToFront}
          onClose={() => setInspectingId(null)}
        />
      ) : null}

      {panelOpen ? (
        <SidePanel
          role={session.role!}
          master={session.master}
          mail={site?.mail}
          title={title}
          expiresAt={board.expiresAt}
          official={board.official}
          itemCount={board.items.length}
          pendingCount={pendingCount}
          editMode={editMode}
          onClose={() => setPanelOpen(false)}
          onShare={() => {
            setPanelOpen(false);
            void share();
          }}
          onSubmit={() => {
            setPanelOpen(false);
            setDialog('submit');
          }}
          onAdd={() => {
            setPanelOpen(false);
            setAddSrc(undefined);
            setEditMode(true);
            setDialog('add');
          }}
          onInbox={() => {
            setPanelOpen(false);
            setDialog('inbox');
          }}
          onBoards={() => {
            setPanelOpen(false);
            setDialog('boards');
          }}
          onKeys={() => {
            setPanelOpen(false);
            setKeysFor({ id: board.id, title: board.title });
            setDialog('keys');
          }}
          onInvites={() => {
            setPanelOpen(false);
            setDialog('invites');
          }}
          onReport={() => {
            setPanelOpen(false);
            setDialog('report');
          }}
          onReports={() => {
            setPanelOpen(false);
            setDialog('reports');
          }}
          openReports={openReports}
          onToggleEdit={() => {
            setEditMode((on) => !on);
            setSelectedId(null);
            setInspectingId(null);
          }}
          onFit={() => {
            setPanelOpen(false);
            boardHandle.current?.fit();
          }}
          onLogout={async () => {
            await api.logout().catch(() => undefined);
            window.location.reload();
          }}
        />
      ) : null}

      {dialog === 'submit' ? (
        <SubmitDialog
          boardId={board.id}
          onClose={() => setDialog(null)}
          onDone={(message) => {
            setDialog(null);
            say(message);
            if (session.role === 'editor') void refreshPending();
          }}
        />
      ) : null}

      {dialog === 'add' ? (
        <AddItemDialog
          boardId={board.id}
          timeZone={board.timeZone}
          initialSrc={addSrc}
          onPlace={placeDraft}
          onClose={() => {
            setDialog(null);
            setAddSrc(undefined);
          }}
        />
      ) : null}

      {dialog === 'report' ? (
        <ReportDialog
          boardTitle={board.title}
          onClose={() => setDialog(null)}
          onDone={(message) => {
            setDialog(null);
            say(message);
            if (session.master) void refreshReports();
          }}
        />
      ) : null}

      {dialog === 'reports' ? (
        <ReportsDialog
          onOpenBoard={(id) => {
            setActiveBoardId(id);
            setSelectedId(null);
            setInspectingId(null);
            setDialog(null);
          }}
          onChanged={refreshReports}
          onClose={() => setDialog(null)}
        />
      ) : null}

      {dialog === 'invites' ? (
        <InvitesDialog site={site} onClose={() => setDialog(null)} />
      ) : null}

      {dialog === 'boards' ? (
        <BoardsDialog
          currentId={board.id}
          onOpen={(id) => {
            setActiveBoardId(id);
            setSelectedId(null);
            setInspectingId(null);
            setDialog(null);
          }}
          onManageKeys={(summary) => {
            setKeysFor({ id: summary.id, title: summary.title });
            setDialog('keys');
          }}
          onClose={() => setDialog(null)}
        />
      ) : null}

      {dialog === 'keys' && keysFor ? (
        <KeysDialog
          boardId={keysFor.id}
          boardTitle={keysFor.title}
          onClose={() => {
            setKeysFor(null);
            setDialog(null);
          }}
        />
      ) : null}

      {dialog === 'inbox' ? (
        <InboxDialog
          boardId={board.id}
          onClose={() => setDialog(null)}
          onChanged={refreshPending}
          onPlaceMedia={(src) => {
            setAddSrc(src);
            setEditMode(true);
            setDialog('add');
          }}
        />
      ) : null}

      {toast ? (
        <div className={`toast${toast.tone === 'error' ? ' error' : ''}`}>{toast.text}</div>
      ) : null}
    </>
  );
}
