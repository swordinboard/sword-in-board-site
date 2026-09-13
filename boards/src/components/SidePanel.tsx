import type { MailStatus, Role } from '../../shared/types';

interface Props {
  role: Role;
  master: boolean;
  /** Only ever supplied to a developer session. */
  mail?: MailStatus;
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
  onInvites: () => void;
  onReport: () => void;
  onReports: () => void;
  openReports?: number;
  expiresAt?: string;
  official?: boolean;
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
  mail,
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
  onInvites,
  onReport,
  onReports,
  openReports,
  expiresAt,
  official,
  onToggleEdit,
  onFit,
  onLogout,
}: Props) {
  return (
    <>
      <div className="scrim" onPointerDown={onClose} />
      <nav className="panel" aria-label="Board menu">
        <header>
          <h1>
            {/* The name on its own, so badges beside it do not run into it. */}
            <span className="panel-title">{title}</span>
            {official ? (
              <span className="official" title="A board run by this site">
                official
              </span>
            ) : null}
            {master ? (
              <span className="devtag" title="Signed in with the developer password">
                dev
              </span>
            ) : null}
          </h1>
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
              <div className="section-label">Developer</div>
              {mail && (!mail.hasKey || !mail.hasSender) ? (
                <p className="panel-warning">
                  {!mail.hasKey
                    ? 'No mail is going out at all: RESEND_API_KEY is unset. Submissions, reports and passphrase recovery are all silent.'
                    : 'Mail can only reach your own inbox. The shared resend.dev sender refuses every other address, so nobody else can recover a passphrase. Verify a domain in Resend and set NOTIFY_FROM.'}
                </p>
              ) : null}
              <NavItem
                glyph="&#9707;"
                label="Switch or add a board"
                hint="Each one has its own passwords"
                onClick={onBoards}
              />
              <NavItem
                glyph="&#9993;"
                label="Invite codes"
                hint="Let other people put up boards"
                onClick={onInvites}
              />
              <NavItem
                glyph="&#9873;"
                label="Reports"
                hint="Boards flagged as possibly illegal"
                count={openReports}
                onClick={onReports}
              />
            </>
          ) : null}

          <div className="section-label">This board</div>
          <NavItem
            glyph="&#9873;"
            label="Report this board"
            hint="For content that may be against the law"
            onClick={onReport}
          />

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
            {expiresAt ? (
              <>
                <br />
                <br />
                Kept until{' '}
                {new Date(expiresAt).toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
                . Looking at it pushes that back.
              </>
            ) : official ? (
              <>
                <br />
                <br />
                Kept for as long as the site is, being one of its own.
              </>
            ) : null}
          </p>
        </div>
      </nav>
    </>
  );
}
