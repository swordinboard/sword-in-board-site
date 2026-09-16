Fonts served by Pinhold.

Six hands are offered for a board's name. Four of them are files here; the
other two are the app's own marker hand (Patrick Hand, also here) and a plain
serif taken from whatever the reader's machine already has.

  patrick-hand*.woff2    the hand items are written in
  cinzel*.woff2          Roman inscriptional caps, for a medieval sign
  orbitron.woff2         squared and wide, for the sci-fi panel
  rye*.woff2             wood type, for the western board
  black-ops-one*.woff2   stencilled, for the industrial board

All of them are under the SIL Open Font License 1.1, which allows use in a
commercial product and embedding in a web page. Copyright notices and the
full licence text are in OFL.txt beside them, which is what that licence
asks for. None of the files has been modified; they are the latin and
latin-ext subsets published by Google Fonts, taken as they are.

Served from this site rather than a font CDN because the Content-Security-
Policy in netlify.toml sets font-src to 'self' and data: only. A browser only
fetches a face when it has something to draw with it, so offering six costs
one download rather than six.
