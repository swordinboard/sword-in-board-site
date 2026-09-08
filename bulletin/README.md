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
    lib/                   api client, image helpers, frame geometry, config
    styles/                cork, wood, frames, chrome
  netlify/functions/
    auth.ts                password check, signed session cookie
    board.ts               read the board; write it as editor
    media.ts               gated image read; upload; delete
    submissions.ts         create, list, triage, delete
    _lib/                  auth, blob stores, email notification
```

### The password gate

There are two passwords: one for viewing, one for editing. An editor password also grants
viewing.

A password is POSTed to `/api/auth`, compared against the environment in constant time, and
exchanged for an HMAC-signed cookie (`HttpOnly`, `Secure`, `SameSite=Lax`, six-month
lifetime). The browser holds it until it expires, the visitor signs out, or their site data
is cleared. Every other endpoint, images included, requires that cookie — so media is not
merely hidden behind an unguessable URL, it is genuinely unreadable without the password.

The signing key is derived from the two passwords, so **changing either password
immediately invalidates every session**. That is the rotation mechanism: change
`BOARD_PASSWORD` in Netlify, and everyone re-enters the new one. Set `AUTH_SECRET` as well
if you would rather rotate keys and passwords independently.

Login is rate-limited to 10 attempts per IP per 15 minutes.

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
| `BOARD_PASSWORD` | yes | Password for viewing. Share this one. |
| `EDITOR_PASSWORD` | yes | Password for editing. Keep this one. |
| `AUTH_SECRET` | no | Extra signing salt, for rotating keys independently of passwords. |
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
whole board. The tridot button opens the menu; "Make a submission" sends media and a note
for review.

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
