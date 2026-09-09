import type { Role } from '../../shared/types';

interface Props {
  role: Role;
  master: boolean;
  title: string;
  itemCount: number;
  pendingCount: number;
  editMode: boolean;
  onClose: () => void;
  onShare: () => void;
  onSubmit: () => void;
  onAdd: () => void;
  onInbox: () => void;
  onBoards: () => void;
  onKeys: () => void;
  onToggleEdit: () => void;
  onFit: () => void;
  onLogout: () => void;
}

interface NavProps {
  glyph: string;
  label: string;
  hint?: string;
  count?: number;
  onClick: () => void;
}

function NavItem({ glyph, label, hint, count, onClick }: NavProps) {
  return (
    <button className="nav-item" type="button" onClick={onClick}>
      <span className="glyph" aria-hidden>
        {glyph}
      </span>
      <span className="label">
        {label}
        {hint ? <span className="hint">{hint}</span> : null}
      </span>
      {count ? <span className="count">{count}</span> : null}
    </button>
  );
}

export default function SidePanel({
  role,
  master,
  title,
  itemCount,
  pendingCount,
  editMode,
  onClose,
  onShare,
  onSubmit,
  onAdd,
  onInbox,
  onBoards,
  onKeys,
  onToggleEdit,
  onFit,
  onLogout,
}: Props) {
  return (
    <>
      <div className="scrim" onPointerDown={onClose} />
      <nav className="panel" aria-label="Board menu">
        <header>
          <h1>{title}</h1>
          <button type="button" onClick={onClose} aria-label="Close menu">
            &times;
          </button>
        </header>

        <div className="body">
          <div className="section-label">The board</div>
          <NavItem
            glyph="&#8599;"
            label="Share this board"
            hint="Sends the link only — tell them the password yourself"
            onClick={onShare}
          />
          <NavItem
            glyph="&#9998;"
            label="Make a submission"
            hint="Send media and a note for review"
            onClick={onSubmit}
          />
          <NavItem
            glyph="&#9635;"
            label="Fit the whole board"
            hint="Zoom out to see everything"
            onClick={onFit}
          />

          {role === 'editor' ? (
            <>
              <div className="section-label">Editor</div>
              <NavItem
                glyph={editMode ? '◉' : '○'}
                label={editMode ? 'Editing is on' : 'Turn on editing'}
                hint={
                  editMode
                    ? 'Drag items to move them; click one to change it'
                    : 'Unlock dragging and item options'
                }
                onClick={onToggleEdit}
              />
              <NavItem
                glyph="&#43;"
                label="Pin something up"
                hint="Upload, crop, frame, place"
                onClick={onAdd}
              />
              <NavItem
                glyph="&#9993;"
                label="Submissions"
                hint="Review what has come in"
                count={pendingCount}
                onClick={onInbox}
              />
              <NavItem
                glyph="&#9919;"
                label="Keys to this board"
                hint="Make and revoke passwords"
                onClick={onKeys}
              />
            </>
          ) : null}

          {master ? (
            <>
              <div className="section-label">All boards</div>
              <NavItem
                glyph="&#9707;"
                label="Switch or add a board"
                hint="Each one has its own passwords"
                onClick={onBoards}
              />
            </>
          ) : null}

          <div className="section-label">Session</div>
          <NavItem
            glyph="&#8592;"
            label="Sign out"
            hint="Clears the saved password on this device"
            onClick={onLogout}
          />

          <p className="meta">
            {itemCount} {itemCount === 1 ? 'item' : 'items'} on the board.
            <br />
            Drag the cork to pan. Scroll or pinch to zoom.
          </p>
        </div>
      </nav>
    </>
  );
}
