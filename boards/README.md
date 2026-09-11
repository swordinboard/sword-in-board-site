# Pinhold

A private, pannable corkboard. Anyone can put one up; a password opens it. Items hang as paper, instant photos, torn clippings, framed
pieces, or sticky notes, held up by pushpins, tape, or nails. Viewers pan and zoom around a
fixed-size board, so nothing ever reflows to stay readable. Editors crop, frame, and drag
things into place directly on the live board.

Built as a static React app plus Netlify Functions, with Netlify Blobs for storage. No
database, no second service, no monthly cost at small scale.

## Nothing personal lives in this repository

This is deliberate, and worth keeping that way:

- **Secrets and identity** — passwords, notification address, API keys — are Netlify
  environment variables. They are never committed.
- **Content** — every image, caption, coordinate, and submission — lives in Netlify Blobs,
  written at runtime. It is never committed.

So the code is a generic corkboard and an instance is that code plus env vars plus a blob
store. The repository can be published as-is. Note that this only holds if it stays true
from the first commit: anything committed once remains in git history and is painful to
remove later.

To lift this into its own repository later, keeping history:

```
git subtree split -P boards -b boards-only
```

## The mark

`public/` carries three files. `logo.svg` is the full mark for light backgrounds,
`logo-light.svg` the same drawing retoned for dark ones (the app uses this),
and `favicon.svg` the small mark, with `icon-180.png` for a phone home screen.

The drawing is a notice pinned to a crenellated wall — the pin and the hold,
which is the whole name in one picture. There are no letterforms in it, and
that is the point. The mark it replaced drew two B's, which meant it went wrong
the moment the product stopped being called Borough Boards; nothing here
encodes an initial, so the next rename costs the artwork nothing.

The small mark drops the notice, the courses and the pin's stem, keeping only
the wall and the pin: at 16px anything finer closes up into dirt. Its wall also
floats with ground on every side instead of bleeding off the tile, which the
first attempt did — run to the edges it stopped reading as a wall at all and
became a pale block with a dot on it.

`icon-180.png` is generated from `favicon.svg`, not drawn separately. No
rasteriser is installed here, so `scratchpad/mark-shot.mjs` renders it through
Chromium and writes the PNG out at 180px, alongside a contact sheet of every
mark at every size it is actually used.

## How it fits together

```
boards/
  index.html               app shell
  shared/types.ts          types shared by the browser and the functions
  src/
    App.tsx                session, board state, autosave, dialog routing
    components/
      Board.tsx            pan, zoom, pinch, item dragging
      BoardItemView.tsx    one hung item
      Cropper.tsx          crop selection with ratio locking
      SidePanel.tsx        the tridot menu
      AddItemDialog.tsx    upload -> crop -> frame -> place
      SubmitDialog.tsx     the public submission form
      InboxDialog.tsx      editor review queue
      ItemInspector.tsx    edit the selected item
      BoardsDialog.tsx     switch, add, rename, delete boards
      KeysDialog.tsx       make, read back, and revoke passwords
      InvitesDialog.tsx    invite codes and the current signup mode
      ItemFace.tsx         fastener and contents, shared by board and preview
      FramePreview.tsx     the item as it will hang, drawn while choosing
      Scrim.tsx            dialog backdrop and its dismiss rule
      ReportDialog.tsx     flag a board as possibly illegal
      ReportsDialog.tsx    the reports queue (master only)
    lib/                   api client, image helpers, frame geometry, config
    styles/                cork, wood, frames, chrome
  netlify/functions/
    auth.ts                password check, signed session cookie
    board.ts               read the board; write it as editor
    boards.ts              list, add, rename, delete boards (master only)
    keys.ts                make and revoke access keys for a board you own
    site.ts                public: what the login screen needs to know
    create.ts              public: put up a new board
    recover.ts             public: email a forgotten passphrase back
    invites.ts             make and revoke invite codes (master only)
    report.ts              file a report; read and work the queue (master only)
    sweep.ts               scheduled: clear boards nobody has touched
    media.ts               gated image read; upload; delete
    submissions.ts         create, list, triage, delete
    _lib/                  auth, blob stores, email, guessing defences, title guard, wordlist
```

### Frames

Eight, all drawn in CSS with no bitmap assets: paper, instant photo, torn
clipping, framed print, sticky note, notebook page, folder, magazine.

`FRAME_STYLES` in `shared/types.ts` is the one list of them, used by the
browser *and* by the function that validates a save. There used to be a second
copy inside `board.ts`, and when the last three were added it was not updated —
so the server quietly rewrote every folder, magazine and notebook page to
`paper` on the way to storage, and the item came back as something else after a
reload. Nothing on screen was wrong; only the stored copy. `gallery-ui` now
reads the board back from the API rather than trusting the render.

The **notebook page** takes its rag out of the sheet with a `clip-path` rather
than laying a strip over the top: an overlay only ever looks like a strip, and
the points are irregular because an even zigzag reads as pinking shears.

The **folder** and the **magazine** hold a set of pictures rather than one, in
`mediaIds`. A folder is closed, with the top picture taped to its front and the
name on its tab. The picture is held well inside the folder on every side:
the tape rises above it, so anything higher put the strips on the cork and
ran them across the label. A folder's fastener is also dropped down the
item, since its body starts below the tab and a pin placed like every other
frame's pinned the cork above it rather than the folder. a magazine uses the first picture as its cover and is knocked
about a bit — rubbed pale at the outer corners, a crease down from the head,
and a dog-eared corner. That wear is painted with plain low-alpha white rather
than a blend mode, which took its strength from the cover underneath and all
but vanished on a dark photograph.

Both say how many are inside, and tapping either **while viewing** opens the
lot full-screen; in edit mode a tap selects instead, so they can still be
dragged. A folder shows one picture at a time. A magazine opens as facing
pages, two at a time, turning by two so the pairs stay put rather than
re-pairing every picture with the next one along; an odd last page is shown
alone. Each picture goes in whole — cropping sixty of them one at a time is
not something anybody would sit through.

There are no captions. They rarely sat well against the art, and the text a
note or a page carries does the job; on a folder or a magazine the same field
is the name on the tab or the cover.

### The handwriting

Patrick Hand, under the SIL Open Font License, served from `public/fonts`.

It is shipped rather than named because the stack before it led with Bradley
Hand and ended in generic `cursive`: both loop and swirl, and on a phone —
where a note is read at whatever size the board happens to be zoomed to — they
were hard going. This one is a print hand. It is self-hosted because the CSP in
`netlify.toml` sets `font-src` to `'self' data:`, so a font CDN would be
blocked; the licence travels with the files.

### Picking something up, and opening its settings

These are two different actions, deliberately. A single tap picks an item: it
gets a ring and a handle, and can be dragged. The settings panel opens only on
a double tap, or on the handle. Opening it on every tap put a panel under the
thumb that had just selected something, so on a phone an item could not be
moved without changing it by accident.

The ring and the handle are drawn in screen coordinates rather than inside the
board, which matters more than it sounds. Inside the board they scale with the
zoom: at 8% the ring is an invisible hairline, and a handle big enough to tap
grows to cover the whole item, so a tap meant for the item opens its settings
instead. Out in screen space both are a fixed size at any zoom, and the handle
sits wholly outside the item's corner, flipping to whichever side has room.

The board's name sits above the frame on the same principle, counter-scaled so
it reads at a constant size however far out the board is zoomed.

### The preview when pinning something up

`FramePreview` draws the item with the board's own markup - the same `Fastener`
and `Contents` from `ItemFace` that the board uses - on a patch of the same
cork. Frame, fastener, pin colour and caption all show as they will actually
hang. A preview that redrew the frames in its own markup would be a second
implementation, and a second implementation drifts until it is no longer a
preview.

The crop is shown by offsetting the source image inside a clipped box rather
than by re-encoding it: producing a real cropped file on every handle drag
would be far too slow, and what lands on screen is identical.

### Boards, keys, and the password gate

There is one **developer password**, `EDITOR_PASSWORD`, held in the environment. It opens every
board and is the only way to manage boards and keys. Everything else is an **access key**: a
password made inside the app that opens exactly one board, at one role.

**The password is the routing.** There is no board picker on the login screen and no board id
in the link. Whoever you hand a key to types it and lands on that board; they never learn any
other board exists. Two keys can never share a password, so a password is always unambiguous.

A board can hold as many keys as you like, each labelled with who it was for ("Mum", "the
Thursday crowd"). Revoking one locks that person out **immediately**, even mid-session, and
leaves everyone else's key working. A key can be marked viewer or editor; an editor key can
rearrange and pin things up on its own board and nothing else.

Mechanically: the password is POSTed to `/api/auth` and turned into a lookup index with
HMAC-SHA256 under a secret that lives outside the blob store, so a login is one read rather
than a scan, and an index value cannot be worked back to its password. What comes back is an
HMAC-signed cookie (`HttpOnly`, `Secure`, `SameSite=Lax`, six months) carrying the board and
key it opened. Every later request re-checks that the key still exists — that is what makes
revocation instant — and pins the request to that key's board. Media is filed against a board
too, so a key for one board cannot read another board's images even with the exact blob id.

### Guessing

Passwords are the only thing between the internet and a board, and there are many of them at
once — which cuts both ways. With *n* valid passwords live, a guesser only has to hit any one
of them, so the search shortens by a factor of *n*. Entropy has to cover that.

A generated passphrase is three words from an 865-word list plus a four-digit number, about
**42 bits** — `thistle-copper-lantern-4827`. Sized so that even 2,000 live keys and a
thousand-machine botnet stay in the decades. That is the default and the reliable option.

**A chosen password is measured but not policed.** Below 32 bits it is called weak and has to
be confirmed with a tick, and then it is allowed. This is deliberate: boards sit on a
spectrum. Some are genuinely private; others are meant to be handed round freely and want a
password as memorable as the board's own name. Because a password resolves to exactly one
key on one board, guessing a weak one opens that board and gives no help at all against any
other, so the risk is the owner's alone and so is the choice. There is even a button to fill
in the board's title.

Three things stay absolute, tick or no tick: the developer password can never be reused as a
key, a password cannot collide with one that already opens another board, and six characters
is the minimum — that last one guards against collision rather than guessing, since very
short passwords start matching what strangers happen to type.

Two limits sit behind that:

- **Per IP**, 10 attempts per 15 minutes. Bounds what one source can guess, and what it can
  cost in blob reads.
- **Site-wide**, 60 wrong answers per 10 minutes, after which guesses are refused. This is
  the one that matters against a distributed attack, where a per-IP limit does nothing.

The rule that keeps this invisible: **the ceiling is only ever checked after the password has
been resolved, and only on a wrong answer.** A correct password is never refused, no matter
how hard the site is being attacked — so somebody walking up to look at a friend's board
types the right thing and is let in, mid-attack or not. A success also clears that visitor's
own failure count, so mistyping a few times costs nothing. There is deliberately no
artificial delay: sleeping inside a billed function would let an attacker inflate the hosting
bill instead.

When the ceiling trips, you get one email (at most one an hour) via the same Resend setup the
submissions use.

**If you ever want a challenge** — Cloudflare Turnstile or similar, invisible to real people
and appearing only when things look wrong — the seam is already there. The 429 response
carries `challenge: true`, and `challengeSatisfied()` in `netlify/functions/_lib/guard.ts`
documents the four steps. Nothing else has to move.

Whoever holds an editor key manages keys on their own board and no other: they can cut and
revoke passwords for it, but cannot see, make, or revoke a key anywhere else, and cannot
revoke the key they are currently holding, which would lock them out with no way back.

**Access keys are stored reversibly, on purpose.** They are encrypted at rest with
AES-256-GCM and shown back to you in the keys dialog, so you can read a password out to
someone weeks after making it without having written it down somewhere worse. If you would
rather they were unrecoverable, this is the thing to change.

`AUTH_SECRET` is what protects all of that. Set it, and the key material lives in the
environment where the blob store cannot reach it. Leave it unset and one is generated on
first run and kept in the store beside the data it protects — enough to stop casual reading,
but not defence against someone who already holds the store. Setting it is one variable and
worth doing.

### Who can put up a board

`SIGNUP_MODE` decides, and it is a Netlify setting rather than code, so it changes without a
redeploy:

- `closed` — only you, using the developer password.
- `invite` — anyone holding a code you generated. **This is the default**, including when the
  variable is unset or misspelt, because the setting that can surprise nobody is the
  restrictive one.
- `open` — anyone who finds the site.

Putting up a board hands back one passphrase, shown once. It is that board's editor key, so
its holder owns the board: they can pin things up and cut their own viewing keys for it, and
nothing else. They cannot see other boards exist, list them, or make invite codes. Those stay
with the developer password.

Creation is capped at 3 boards per address per day and 60 site-wide per hour.

**Before opening it up**, two things are worth being deliberate about. Any open image upload
eventually attracts material you would not want hosted under your domain and your Netlify
account. And the developer password already opens every board — that is your only way to look at
what has been posted, and the reason the create screen tells people plainly that whoever runs
the site can see their board. Leave `SIGNUP_MODE` on `invite` unless you are prepared to
police it.

### The developer's own boards, and everyone else's

Past a handful of signups a flat list stops being navigable: the boards worth
reaching quickly are the site's own, and they end up buried. So `house` marks
which shelf a board sits on in the developer's list — Mine, People's, or All,
with counts.

It is deliberately **not** the same flag as `official`. `official` is a public
claim, shown to whoever opens the board; `house` is private filing and nobody
but the developer ever sees it. A personal board can be the developer's own
without presenting itself as the site speaking, which is the common case.

Boards put up through the developer's own list get it automatically; boards
from the public signup never do, and neither flag can be smuggled in through
an ordinary board save — `board.ts` takes both from the stored board rather
than from the request. The list opens on whichever shelf holds the board
currently being looked at, rather than always on Mine, since otherwise opening
it while on somebody's board hides the very board in front of you.

### Telling the site's own boards apart

Board titles are labels, not addresses. Nothing routes by them, they need not be unique, and
two boards may share one — so a title cannot be squatted, and pre-making boards to hold names
achieves nothing.

Passwords are the opposite: they are the one globally unique thing here, since each must
resolve to exactly one board. `RESERVED_PASSWORDS` in `shared/types.ts` therefore holds back
the obvious ones — welcome, demo, help, the site's own name — for the site's own boards. Only
the developer may use them. Without that, a stranger claiming "welcome" would mean that
telling somebody "the demo password is welcome" walked them onto that stranger's board.

The durable mark is `official`, a flag on the board that **only the developer can set**.
That is the whole point of it: it is the one thing a person putting up a board cannot award
themselves, by the API or by smuggling the field into a board save. It shows as a badge
beside the board's name, so whoever opens a board can tell whether it is run by the site or
by a person.

### Renaming the product

`scripts/rename-site.py "New Name"` changes the name everywhere it is written
down: `SITE_DEFAULT_NAME`, the `<title>`, the package name, the netlify.toml
header, the README, the alt text on all three SVGs, the name-derived entries in
`RESERVED_PASSWORDS`, and the test fixtures. It reads the current name out of
`SITE_DEFAULT_NAME` rather than assuming one, so it can be run again later.

It cannot do the last of it, and says so when it finishes: the logo draws
letterforms as vector paths and `icon-180.png` is a bitmap, so a name with
different initials needs the mark redrawn; and `SITE_NAME` / `VITE_SITE_NAME`
in Netlify override the built-in default, so a stale value left set there will
look exactly like the rename failed.

Passwords are stored, not derived, so a password that was the old name keeps
working. Reserving the new one only stops it being claimed from now on.

### Names that would speak for the site

A title cannot be squatted, but it can mislead. `titleObjection` in
`netlify/functions/_lib/naming.ts` refuses two kinds of name from anyone but the developer
editor: the site's own name, and the handful of words in `RESERVED_TITLES` — official, admin,
moderator, support, security, billing and their like — which read as a notice from whoever
runs the place rather than from a person.

It compares titles by the shape a person would read them as: case folded, punctuation and
spacing dropped, and every group of glyphs that read as each other — `o`/`0`, `i`/`l`/`1`/`|`/`!`,
`a`/`4`/`@`, and so on — collapsed to one symbol. Both sides go through it, which is the
point: expanding digits back into letters cannot work, because `1` stands for both `i` and
`l`, so mapping it to either lets the other through. Collapsing has no such choice to get
wrong, and `B0r0ugh  B.o.a.r.d.s` is caught alongside the plain spelling. Reserved words
only bind on their own, so *Administrative Nightmares* is fine while a bare *Admin* is not.

The guard runs on `/api/create` and again on any rename by a board's own editor, since a
guard only on creation would be worth nothing — name it plainly, rename it after. A save that
leaves the title alone never trips it, so ordinary autosaves cannot fail on it. The master
editor passes through neither check: the site's own boards are precisely the ones that should
carry the site's name.

### Reporting a board

Anyone holding a password to a board can report **that** board, and no other — `/api/report`
takes the board from the session and ignores any board named in the request, because a
reporter can see nothing else anyway.

The reasons are deliberately confined to things that may be against the law: sexual content
involving a child, threats or incitement to violence, stolen or copyrighted material, and
anything else illegal, which has to say what it is. The dialog says plainly that this is not
for a board somebody merely dislikes. The site does not arbitrate taste; it declines to host
crime, and that is the whole of the policy.

Reports go to a queue only the developer can read, work or delete — a board's own owner
cannot see reports against it or clear them, and is never told who filed one. Each report
carries the board's title as it stood, the reason, whatever detail was given, and the key that
sent it. Deleting a reported board settles any open report against it, so the badge does not
stay lit over work already done, while the record stays.

Notification goes out by the same Resend path as submissions and is deliberately **not** rate
limited: a report going unseen is the failure worth avoiding. Filing is limited to ten an hour
per address.

### Two kinds of password, and why the names matter

`DEV_PASSWORD` is the **developer** password: one per deployment, held by
whoever runs the site, and the only thing that sees more than one board. Every
other way in is an **access key** — a password that resolves to exactly one
board, in either the `viewer` or `editor` role. An editor key edits that board
and nothing else.

Both used to be called "editor", which was genuinely confusing, since one of
them is site-wide and the other is the narrower of the two per-board roles.

Only a developer session can list boards, switch between them, mark one
official, or read reports: `boards.ts` and the rest simply refuse anyone else.
A key holder is pinned to their board server-side and cannot even learn that
the others exist — the `board` query parameter is ignored for them. So yes:
without the developer password, moving between boards means signing out and
entering the other board's password.

### Forgetting the passphrase

There are no accounts, so there is nothing to reset. The create screen offers an email; it is
never a login, never shown to anyone, and used for exactly one thing — sending passphrases
back. Skipping it needs an explicit tick acknowledging there is no way back, because the
passphrase is shown once and a board whose passphrase is lost is simply gone.

**One address holds as many boards as its owner made.** Nobody is going to invent a new
address per board, so asking for recovery sends back every board registered to that address,
each with its title beside its passphrase. That index is the only thing in the system that
links boards together; otherwise each is reached by its own password alone.

Recovery needs `NOTIFY_FROM` set to a sender on a domain verified in Resend. On the shared
`onboarding@resend.dev` sender, Resend delivers only to your own account address and rejects
everyone else, so recovery would fail silently for every real user. When that is the case
`recoveryAvailable` comes back false, the gate stops offering recovery, and the developer's
menu says why.

`/api/recover` answers identically whether or not it recognises an address, so it cannot be
used to find out who has a board here, and passphrases only ever leave by email.

### Boards that go quiet

A board is cleared once nobody has **looked at or changed it** for `BOARD_TTL_DAYS`, which
defaults to 180. Viewing counts, so only genuinely abandoned boards ever expire, and the date
sits in the board's own menu because with no accounts there is no way to warn anyone first.
Clearing takes the board's items, images, submissions and keys with it. `sweep.ts` runs daily
on Netlify's scheduler; there is nothing else to host.

### Sharing

The share button in the menu hands out the site link and nothing else — no password, no board
id, no hint about which boards exist. On a phone it opens the system share sheet; elsewhere
it copies to the clipboard. The password travels separately, by word of mouth, so a forwarded
link is worthless to whoever it reaches.

### Submissions

The form uploads media, then posts a note. Both land in Blobs, and the queue is reviewed in
the editor's inbox: click any submitted image to drop it straight into the crop-and-frame
flow. Statuses are new, reviewed, placed, and archived.

**No Claude API call happens anywhere in this flow.** Submissions queue up and cost nothing.
If you later want AI help drafting or tidying an entry, wire it as an explicit button in the
editor so it only spends tokens when you press it — never on the submission path, where
anyone submitting would be spending your budget.

Notification email goes through Resend. If `NOTIFY_EMAIL` and `RESEND_API_KEY` are unset,
submissions are still stored and reviewable; the function logs instead of emailing.

## Netlify setup

The Hugo site at the repository root and this app are two separate Netlify sites from the
same repository.

1. **Create a second Netlify site** from `swordinboard/sword-in-board-site`.
2. Set **base directory** to `boards`. The build command (`npm run build`), publish
   directory (`dist`), and functions directory are read from `boards/netlify.toml`.
3. **Domain** → add `boards.swordinboard.com` as a custom domain on this new
   site, then add the DNS record it asks for wherever `swordinboard.com` is managed.
4. **Blobs** need no setup. `getStore` is wired automatically for functions on the site.
5. Set the environment variables below, then deploy.

### Environment variables

| Variable | Required | What it does |
| --- | --- | --- |
| `DEV_PASSWORD` | yes | The developer password. Opens every board and manages keys. Keep it to yourself. `EDITOR_PASSWORD` is the name it was first given and still works. |
| `AUTH_SECRET` | strongly advised | Signs cookies and protects stored keys. Any long random string. See above for what leaving it unset costs. |
| `BOARD_PASSWORD` | no | Only for upgrades from the first release: it becomes a viewer key on the first board, then the variable can be deleted. |
| `SIGNUP_MODE` | no | `closed`, `invite`, or `open`. Defaults to `invite`. |
| `BOARD_TTL_DAYS` | no | Days untouched before a board is cleared. Defaults to 180. |
| `BOARD_TITLE` | no | Fallback title for a board made without one. Boards put up through the app are named by their author, so this is rarely used. |
| `SITE_NAME` | no | What the app is called, as the server reports it. |
| `VITE_SITE_NAME` | no | What the app is called, in the browser tab and on the login screen. Baked in at build time, so changing it needs a redeploy. |
| `NOTIFY_EMAIL` | no | Where submission notifications are sent. |
| `RESEND_API_KEY` | no | Resend API key. Without it, submissions queue but do not email. |
| `NOTIFY_FROM` | for recovery | A sender on a domain you have verified in Resend. Without it mail falls back to the shared `onboarding@resend.dev`, which **only delivers to your own Resend account address** — so passphrase recovery cannot reach anybody else. |

`VITE_BOARD_TITLE` is still read as a fallback for `VITE_SITE_NAME`, left over from the
first release. Either is a label, not a secret, and both are baked into the bundle at build
time.

### Sending mail

Resend's free tier covers 3,000 emails a month. Without a verified domain you can only send
to your own Resend account address, which is fine if that is where notifications go anyway.
To send from your own domain, verify `swordinboard.com` in Resend and set `NOTIFY_FROM` to
an address on it.

## Using it

**Everyone.** Drag the cork to pan, scroll or pinch to zoom, and use the zoom bar to fit the
whole board. The tridot button opens the menu; "Make a submission" sends media and a note for
review, and "Share this board" passes on the link.

**Handing out access.** Open a board, then "Keys to this board". Name who it is for, choose
viewer or editor, and either type a password or leave it blank for a generated one like
`cedar-lantern-harbour-42` that survives being read down a phone line. Share the link with
the share button, say the password out loud, and revoke that one key when you are done.

**Editors.** Turn on editing in the menu. Drag items to move them, arrow keys to nudge
(hold shift for ten pixels at a time), and click one to open the inspector for frame,
fastener, pin colour, size, tilt, caption, layering, and removal. Every change autosaves.
"Pin something up" runs upload, crop, frame, and place.

## Local development

```
cd boards
npm install
npm run dev        # UI only; API calls 404 without the Netlify dev server
npm run build
npm run typecheck
```

For the functions and Blobs locally, use the Netlify CLI (`netlify dev`) from this
directory, with the environment variables set.

## Limits worth knowing

- Uploads are capped at 4.5MB per image; Netlify's synchronous function body limit is 6MB.
  Images are re-encoded to WebP in the browser and bounded to 1600px on the long edge before
  upload, so ordinary photos land well under.
- A board holds up to 400 items.
- Submissions are limited to 12 per IP per hour, and 8 images each.
- Board layout is a single JSON document, so two editors saving at the same time means last
  write wins. Fine for one editor; something to revisit if that changes.
- Up to 50 boards from the developer, 40 keys per board, and 100 invite codes.
- Images are served through a function rather than off a CDN, because they are gated. That is
  the right trade for a private board and the thing that scales worst: at real adoption it is
  what would push this off a free tier.
- Deleting a board is immediate and total. There is no undo and no bin.
- The daily sweep clears at most 25 boards per run, and reads the media store's
  metadata once per run rather than once per board, because a scheduled function has a
  hard time limit. A larger backlog drains over successive days.
- A password is not a person. Two people handed the same key are indistinguishable, and
  labels are your own record of who has what, not something the app can verify.
- The per-IP counter is not atomic — Netlify Blobs has no compare-and-set — so simultaneous
  requests can slip an extra attempt through. The site-wide ceiling is the real bound.
- Someone sharing an IP with an attacker (office, some mobile networks) can be throttled by
  the per-IP limit even though they are innocent. They wait it out; their password still
  works once the window passes.
- The likeliest way a board leaks is not guessing at all — it is a password forwarded in a
  group chat. Per-person keys and instant revocation are the answer to that, not entropy.
