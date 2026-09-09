# Bulletin Board

A private, pannable corkboard. Items hang as paper, instant photos, torn clippings, framed
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
git subtree split -P bulletin -b bulletin-only
```

## How it fits together

```
bulletin/
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
    lib/                   api client, image helpers, frame geometry, config
    styles/                cork, wood, frames, chrome
  netlify/functions/
    auth.ts                password check, signed session cookie
    board.ts               read the board; write it as editor
    boards.ts              list, add, rename, delete boards (master only)
    keys.ts                make and revoke access keys (master only)
    media.ts               gated image read; upload; delete
    submissions.ts         create, list, triage, delete
    _lib/                  auth, blob stores, email, guessing defences, wordlist
```

### Boards, keys, and the password gate

There is one **master password**, `EDITOR_PASSWORD`, held in the environment. It opens every
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
thousand-machine botnet stay in the decades. A chosen password is measured before it is
accepted and must clear 32 bits; the check reads the password as a guesser would, scoring
common passwords, keyboard runs, and anything built from the board's own name near zero
rather than trusting length and character classes. It is a floor that turns away bad choices,
not a promise about good ones — the generated option is the reliable one.

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

**Access keys are stored reversibly, on purpose.** They are encrypted at rest with
AES-256-GCM and shown back to you in the keys dialog, so you can read a password out to
someone weeks after making it without having written it down somewhere worse. If you would
rather they were unrecoverable, this is the thing to change.

`AUTH_SECRET` is what protects all of that. Set it, and the key material lives in the
environment where the blob store cannot reach it. Leave it unset and one is generated on
first run and kept in the store beside the data it protects — enough to stop casual reading,
but not defence against someone who already holds the store. Setting it is one variable and
worth doing.

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
2. Set **base directory** to `bulletin`. The build command (`npm run build`), publish
   directory (`dist`), and functions directory are read from `bulletin/netlify.toml`.
3. **Domain** → add `theboroughbulletin.swordinboard.com` as a custom domain on this new
   site, then add the DNS record it asks for wherever `swordinboard.com` is managed.
4. **Blobs** need no setup. `getStore` is wired automatically for functions on the site.
5. Set the environment variables below, then deploy.

### Environment variables

| Variable | Required | What it does |
| --- | --- | --- |
| `EDITOR_PASSWORD` | yes | The master password. Opens every board and manages keys. Keep it to yourself. |
| `AUTH_SECRET` | strongly advised | Signs cookies and protects stored keys. Any long random string. See above for what leaving it unset costs. |
| `BOARD_PASSWORD` | no | Only for upgrades from the first release: it becomes a viewer key on the first board, then the variable can be deleted. |
| `BOARD_TITLE` | no | Board name stored in board state. |
| `VITE_BOARD_TITLE` | no | Board name in the browser tab and login screen. Build-time. |
| `NOTIFY_EMAIL` | no | Where submission notifications are sent. |
| `RESEND_API_KEY` | no | Resend API key. Without it, submissions queue but do not email. |
| `NOTIFY_FROM` | no | Verified sender address. Defaults to Resend's shared onboarding sender. |

`VITE_BOARD_TITLE` is baked into the bundle at build time, so changing it needs a redeploy.
It is a label, not a secret.

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
cd bulletin
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
- Up to 50 boards, and 40 keys per board.
- A password is not a person. Two people handed the same key are indistinguishable, and
  labels are your own record of who has what, not something the app can verify.
- The per-IP counter is not atomic — Netlify Blobs has no compare-and-set — so simultaneous
  requests can slip an extra attempt through. The site-wide ceiling is the real bound.
- Someone sharing an IP with an attacker (office, some mobile networks) can be throttled by
  the per-IP limit even though they are innocent. They wait it out; their password still
  works once the window passes.
- The likeliest way a board leaks is not guessing at all — it is a password forwarded in a
  group chat. Per-person keys and instant revocation are the answer to that, not entropy.
